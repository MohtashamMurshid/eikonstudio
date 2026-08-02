import { createHash, randomBytes, webcrypto } from "node:crypto";

export const CREDENTIAL_ENCRYPTION_VERSION = 2 as const;
export const CREDENTIAL_KEY_VERSION = "primary" as const;
export const CREDENTIAL_NONCE_BYTES = 12;
export const CREDENTIAL_AUTH_TAG_BYTES = 16;
export const CREDENTIAL_SECRET_ENV = "CREDENTIAL_ENCRYPTION_SECRET";
export const LEGACY_CREDENTIAL_SECRET_ENV = "LEGACY_CREDENTIAL_ENCRYPTION_SECRET";

export type CanonicalCredentialProvider = "google" | "openai";

export class CredentialCryptoError extends Error {
  readonly code: "CONFIGURATION" | "DECRYPTION";

  constructor(code: "CONFIGURATION" | "DECRYPTION") {
    super(code === "CONFIGURATION" ? "Credential service is unavailable" : "Credential could not be resolved");
    this.name = "CredentialCryptoError";
    this.code = code;
  }
}

export interface CredentialAad {
  ownerId: string;
  provider: CanonicalCredentialProvider;
  handle: string;
  encryptionVersion: typeof CREDENTIAL_ENCRYPTION_VERSION;
  keyVersion: string;
}

export interface EncryptedCredentialV2 {
  ciphertext: string;
  nonce: string;
  authTag: string;
  encryptionVersion: typeof CREDENTIAL_ENCRYPTION_VERSION;
  keyVersion: string;
}

function decodeConfiguredSecret(encodedSecret: string | undefined): Uint8Array<ArrayBuffer> {
  if (!encodedSecret || encodedSecret.trim() !== encodedSecret || !/^[A-Za-z0-9+/]{43}=$/.test(encodedSecret)) {
    throw new CredentialCryptoError("CONFIGURATION");
  }

  const decoded = Uint8Array.from(Buffer.from(encodedSecret, "base64"));
  if (decoded.byteLength !== 32 || Buffer.from(decoded).toString("base64") !== encodedSecret) {
    throw new CredentialCryptoError("CONFIGURATION");
  }
  return decoded;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = Uint8Array.from(Buffer.from(value, "base64"));
  if (Buffer.from(decoded).toString("base64") !== value) throw new Error("invalid base64");
  return decoded;
}

function encodeBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

export function readCredentialEncryptionSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment[CREDENTIAL_SECRET_ENV];
  decodeConfiguredSecret(value);
  return value!;
}

export function buildCredentialAad(aad: CredentialAad): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify([
    "eikon-provider-credential",
    aad.ownerId,
    aad.provider,
    aad.handle,
    aad.encryptionVersion,
    aad.keyVersion,
  ]));
}

export function createCredentialHandle(): string {
  return `cred_${randomBytes(18).toString("base64url")}`;
}

export async function encryptCredentialV2(
  plaintext: string,
  aad: Omit<CredentialAad, "encryptionVersion"> & { encryptionVersion?: typeof CREDENTIAL_ENCRYPTION_VERSION },
  encodedSecret = readCredentialEncryptionSecret(),
): Promise<EncryptedCredentialV2> {
  const rawKey = decodeConfiguredSecret(encodedSecret);
  const key = await webcrypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const nonce = new Uint8Array(CREDENTIAL_NONCE_BYTES);
  webcrypto.getRandomValues(nonce);
  const normalizedAad: CredentialAad = { ...aad, encryptionVersion: CREDENTIAL_ENCRYPTION_VERSION };
  const sealed = new Uint8Array(await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: buildCredentialAad(normalizedAad), tagLength: CREDENTIAL_AUTH_TAG_BYTES * 8 },
    key,
    new TextEncoder().encode(plaintext),
  ));
  const splitAt = sealed.byteLength - CREDENTIAL_AUTH_TAG_BYTES;
  return {
    ciphertext: encodeBase64(sealed.slice(0, splitAt)),
    nonce: encodeBase64(nonce),
    authTag: encodeBase64(sealed.slice(splitAt)),
    encryptionVersion: CREDENTIAL_ENCRYPTION_VERSION,
    keyVersion: aad.keyVersion,
  };
}

export async function decryptCredentialV2(
  encrypted: EncryptedCredentialV2,
  aad: Omit<CredentialAad, "encryptionVersion" | "keyVersion">,
  encodedSecret = readCredentialEncryptionSecret(),
): Promise<string> {
  try {
    const rawKey = decodeConfiguredSecret(encodedSecret);
    const nonce = decodeBase64(encrypted.nonce);
    const authTag = decodeBase64(encrypted.authTag);
    const ciphertext = decodeBase64(encrypted.ciphertext);
    if (nonce.byteLength !== CREDENTIAL_NONCE_BYTES || authTag.byteLength !== CREDENTIAL_AUTH_TAG_BYTES) {
      throw new Error("invalid credential envelope");
    }
    const key = await webcrypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
    const sealed = new Uint8Array(ciphertext.byteLength + authTag.byteLength);
    sealed.set(ciphertext);
    sealed.set(authTag, ciphertext.byteLength);
    const plaintext = await webcrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: buildCredentialAad({
          ...aad,
          encryptionVersion: CREDENTIAL_ENCRYPTION_VERSION,
          keyVersion: encrypted.keyVersion,
        }),
        tagLength: CREDENTIAL_AUTH_TAG_BYTES * 8,
      },
      key,
      sealed,
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof CredentialCryptoError && error.code === "CONFIGURATION") throw error;
    throw new CredentialCryptoError("DECRYPTION");
  }
}

function deriveLegacyKey(ownerId: string, secret: string): string {
  const combined = `${ownerId}:${secret}:eikon-secure-key`;
  let hash = 0;
  for (let index = 0; index < combined.length; index += 1) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(index);
    hash &= hash;
  }
  return Math.abs(hash).toString(36).padStart(32, "0").slice(0, 32);
}

/** Read-only compatibility for records written before v2. Never use for writes. */
export function decryptLegacyCredential(
  encryptedKey: string,
  iv: string,
  ownerId: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const legacySecret = environment[LEGACY_CREDENTIAL_SECRET_ENV];
  if (!legacySecret) throw new CredentialCryptoError("CONFIGURATION");

  try {
    const encrypted = Buffer.from(encryptedKey, "base64");
    if (encrypted.toString("base64") !== encryptedKey) throw new Error("invalid legacy envelope");
    const fullKey = deriveLegacyKey(ownerId, legacySecret) + iv;
    let plaintext = "";
    for (let index = 0; index < encrypted.length; index += 1) {
      plaintext += String.fromCharCode(encrypted[index] ^ fullKey.charCodeAt(index % fullKey.length));
    }
    return plaintext;
  } catch (error) {
    if (error instanceof CredentialCryptoError) throw error;
    throw new CredentialCryptoError("DECRYPTION");
  }
}

export function fakeSecret(seed: string): string {
  return createHash("sha256").update(seed).digest("base64");
}
