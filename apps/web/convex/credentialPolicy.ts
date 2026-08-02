export type CanonicalProvider = "google" | "openai";
export type ProviderInput = CanonicalProvider | "gemini";
export type CredentialHealth = "active" | "legacy" | "disabled" | "invalid";

export interface CredentialRecordView {
  userId: string;
  provider?: "gemini" | "openai";
  canonicalProvider?: CanonicalProvider;
  credentialHandle?: string;
  encryptionVersion?: number;
  keyVersion?: string;
  health?: CredentialHealth;
  maskedHint?: string;
  createdAt: number;
  updatedAt: number;
  disabledAt?: number;
}

export interface CredentialMetadata {
  handle: string;
  provider: CanonicalProvider;
  configured: boolean;
  health: CredentialHealth;
  maskedHint: string;
  encryptionVersion: number;
  keyVersion: string;
  createdAt: number;
  updatedAt: number;
  disabledAt?: number;
}

export class CredentialResolutionError extends Error {
  constructor() {
    super("Credential is unavailable for this operation");
    this.name = "CredentialResolutionError";
  }
}

export function canonicalizeProvider(provider: ProviderInput): CanonicalProvider {
  return provider === "gemini" ? "google" : provider;
}

export function storageProvider(provider: CanonicalProvider): "gemini" | "openai" {
  return provider === "google" ? "gemini" : "openai";
}

/** Stable non-secret rollout handle for legacy rows before their first v2 rewrite. */
export function legacyCredentialHandle(recordId: string): string {
  return `cred_legacy_${recordId}`;
}

export function recordCanonicalProvider(record: CredentialRecordView): CanonicalProvider {
  return record.canonicalProvider ?? canonicalizeProvider(record.provider ?? "gemini");
}

export function credentialHealth(record: CredentialRecordView): CredentialHealth {
  if (record.disabledAt !== undefined || record.health === "disabled") return "disabled";
  if (record.health) return record.health;
  return record.encryptionVersion === 2 ? "active" : "legacy";
}

export function toCredentialMetadata(record: CredentialRecordView): CredentialMetadata | null {
  if (!record.credentialHandle) return null;
  const health = credentialHealth(record);
  return {
    handle: record.credentialHandle,
    provider: recordCanonicalProvider(record),
    configured: health === "active" || health === "legacy",
    health,
    maskedHint: record.maskedHint ?? "••••",
    encryptionVersion: record.encryptionVersion ?? 1,
    keyVersion: record.keyVersion ?? "legacy",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    disabledAt: record.disabledAt,
  };
}

export function assertCredentialOperationMatch(
  record: CredentialRecordView,
  expected: { ownerId: string; provider: ProviderInput; handle: string },
): void {
  const health = credentialHealth(record);
  if (
    record.userId !== expected.ownerId ||
    recordCanonicalProvider(record) !== canonicalizeProvider(expected.provider) ||
    record.credentialHandle !== expected.handle ||
    (health !== "active" && health !== "legacy")
  ) {
    throw new CredentialResolutionError();
  }
}

export function maskCredentialHint(value: string): string {
  const suffix = value.slice(-4);
  return suffix ? `••••${suffix}` : "••••";
}
