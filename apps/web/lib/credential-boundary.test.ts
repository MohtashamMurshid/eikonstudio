import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CredentialCryptoError,
  decryptCredentialV2,
  decryptLegacyCredential,
  encryptCredentialV2,

  readCredentialEncryptionSecret,
} from "../convex/credentialCrypto";
import {
  CredentialResolutionError,
  assertCredentialOperationMatch,
  canonicalizeProvider,
  legacyCredentialHandle,
  maskCredentialHint,
  toCredentialMetadata,
} from "../convex/credentialPolicy";

const fakeSecret = (seed: string) => createHash("sha256").update(seed).digest("base64");

const secret = fakeSecret("credential-test-primary");
const otherSecret = fakeSecret("credential-test-other");
const aad = {
  ownerId: "user_owner_123",
  provider: "google" as const,
  handle: "cred_test_123456789",
  keyVersion: "primary",
};

function alterBase64(value: string): string {
  const bytes = Buffer.from(value, "base64");
  bytes[0] ^= 1;
  return bytes.toString("base64");
}

function encryptLegacyFixture(plaintext: string, ownerId: string, secretValue: string, iv: string): string {
  const combined = `${ownerId}:${secretValue}:eikon-secure-key`;
  let hash = 0;
  for (let index = 0; index < combined.length; index += 1) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(index);
    hash &= hash;
  }
  const key = Math.abs(hash).toString(36).padStart(32, "0").slice(0, 32) + iv;
  return Buffer.from([...plaintext].map((character, index) => character.charCodeAt(0) ^ key.charCodeAt(index % key.length))).toString("base64");
}

describe("provider credential cryptography", () => {
  it("round-trips AES-256-GCM and never reuses the nonce", async () => {
    const first = await encryptCredentialV2("test-provider-secret", aad, secret);
    const second = await encryptCredentialV2("test-provider-secret", aad, secret);

    expect(first.encryptionVersion).toBe(2);
    expect(Buffer.from(first.nonce, "base64")).toHaveLength(12);
    expect(Buffer.from(first.authTag, "base64")).toHaveLength(16);
    expect(first.nonce).not.toBe(second.nonce);
    await expect(decryptCredentialV2(first, aad, secret)).resolves.toBe("test-provider-secret");
  });

  it.each([
    ["ciphertext", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2({ ...encrypted, ciphertext: alterBase64(encrypted.ciphertext) }, aad, secret);
    }],
    ["authentication tag", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2({ ...encrypted, authTag: alterBase64(encrypted.authTag) }, aad, secret);
    }],
    ["owner AAD", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2(encrypted, { ...aad, ownerId: "user_other_456" }, secret);
    }],
    ["provider AAD", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2(encrypted, { ...aad, provider: "openai" }, secret);
    }],
    ["handle AAD", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2(encrypted, { ...aad, handle: "cred_other_987654321" }, secret);
    }],
    ["wrong secret", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2(encrypted, aad, otherSecret);
    }],
    ["key version", async () => {
      const encrypted = await encryptCredentialV2("test-provider-secret", aad, secret);
      return decryptCredentialV2({ ...encrypted, keyVersion: "rotated" }, aad, secret);
    }],
  ])("rejects modified %s with one safe error", async (_name, operation) => {
    await expect(operation()).rejects.toMatchObject({
      name: "CredentialCryptoError",
      code: "DECRYPTION",
      message: "Credential could not be resolved",
    });
  });

  it("fails closed for missing, malformed, or short server secrets", () => {
    for (const environment of [{}, { CREDENTIAL_ENCRYPTION_SECRET: "not-base64" }, { CREDENTIAL_ENCRYPTION_SECRET: Buffer.alloc(16).toString("base64") }]) {
      expect(() => readCredentialEncryptionSecret(environment as NodeJS.ProcessEnv)).toThrowError("Credential service is unavailable");
    }
  });

  it("decrypts legacy records with the exact historical secret regardless of length", () => {
    const legacySecret = "old-secret";
    const iv = "LegacyIv12345678";
    const encryptedKey = encryptLegacyFixture("legacy-provider-key", aad.ownerId, legacySecret, iv);
    expect(decryptLegacyCredential(encryptedKey, iv, aad.ownerId, {
      NODE_ENV: "test",
      LEGACY_CREDENTIAL_ENCRYPTION_SECRET: legacySecret,
    })).toBe("legacy-provider-key");
  });
});

describe("provider credential boundary policy", () => {
  const record = {
    userId: "user_owner_123",
    provider: "gemini" as const,
    canonicalProvider: "google" as const,
    credentialHandle: "cred_test_123456789",
    encryptionVersion: 2,
    keyVersion: "primary",
    health: "active" as const,
    maskedHint: "••••cret",
    createdAt: 1,
    updatedAt: 2,
  };

  it("canonicalizes Google and emits metadata without envelope material", () => {
    expect(canonicalizeProvider("gemini")).toBe("google");
    expect(canonicalizeProvider("google")).toBe("google");
    expect(maskCredentialHint("test-provider-secret")).toBe("••••cret");
    const metadata = toCredentialMetadata({
      ...record,
      ciphertext: "must-not-escape",
      nonce: "must-not-escape",
      authTag: "must-not-escape",
      encryptedKey: "must-not-escape",
      iv: "must-not-escape",
    } as typeof record);
    expect(metadata).toEqual({
      handle: record.credentialHandle,
      provider: "google",
      configured: true,
      health: "active",
      maskedHint: "••••cret",
      encryptionVersion: 2,
      keyVersion: "primary",
      createdAt: 1,
      updatedAt: 2,
    });
    expect(JSON.stringify(metadata)).not.toMatch(/ciphertext|nonce|authTag|encryptedKey|test-provider-secret/);
  });

  it("gives untouched legacy rows a stable configured metadata handle", () => {
    const handle = legacyCredentialHandle("legacy_record_123");
    const metadata = toCredentialMetadata({
      userId: record.userId,
      provider: "gemini",
      credentialHandle: handle,
      createdAt: 1,
      updatedAt: 2,
    });
    expect(metadata).toMatchObject({ handle, provider: "google", configured: true, health: "legacy" });
    expect(legacyCredentialHandle("legacy_record_123")).toBe(handle);
  });

  it.each([
    { ownerId: "user_other_456", provider: "google" as const, handle: record.credentialHandle },
    { ownerId: record.userId, provider: "openai" as const, handle: record.credentialHandle },
    { ownerId: record.userId, provider: "google" as const, handle: "cred_other_987654321" },
  ])("rejects cross-boundary resolution %#", (expected) => {
    expect(() => assertCredentialOperationMatch(record, expected)).toThrow(CredentialResolutionError);
  });
});

describe("credential source boundary", () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const source = (relativePath: string) => readFileSync(resolve(webRoot, relativePath), "utf8");

  it("does not expose plaintext-read APIs or browser provider-key persistence", () => {
    const apiKeys = source("convex/apiKeys.ts");
    const settings = source("app/studio/settings/page.tsx");
    const apiDocs = source("app/api-docs/page.tsx");
    const layout = source("components/studio/studio-layout-client.tsx");
    const secureStorage = source("lib/secure-storage.ts");

    for (const text of [apiKeys, settings, layout, secureStorage]) {
      expect(text).not.toMatch(/getDecryptedProviderApiKeys|getMyProviderApiKeys|getProviderApiKeys\s*\(/);
    }
    expect(`${settings}\n${layout}\n${apiDocs}`).not.toMatch(/localStorage\.(?:setItem|getItem)\([^\n]*api-key/i);
  });

  it("keeps plaintext out of generation and scheduler argument schemas", () => {
    const generations = source("convex/generations.ts");
    const worker = source("convex/imageGeneration.ts");
    expect(generations).not.toMatch(/apiKey\s*:\s*v\.(?:string|optional)/);
    expect(worker).not.toMatch(/apiKey\s*:\s*v\.(?:string|optional)/);
    expect(generations).toContain("credentialHandle");
    expect(worker).toContain("resolveCredentialForOperation");
  });

  it("contains no legacy fallback secret literal", () => {
    const credentialFiles = [
      source("convex/apiKeys.ts"),
      source("convex/credentialCrypto.ts"),
      source("convex/credentialActions.ts"),
    ].join("\n");
    expect(credentialFiles).not.toContain("eikon-default-secret-change-in-prod");
  });

  it("validates encryption configuration before reserving storage and ignores invalid placeholders", () => {
    const actions = source("convex/credentialActions.ts");
    const apiKeys = source("convex/apiKeys.ts");
    expect(actions.indexOf("const encryptionSecret = readCredentialEncryptionSecret()"))
      .toBeLessThan(actions.indexOf("reserveCredentialHandleInternal"));
    expect(apiKeys).toContain('["active", "legacy"].includes(credentialHealth(record))');
  });
});
