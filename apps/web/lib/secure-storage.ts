/** Metadata-only client helpers for provider credentials. Saved plaintext is never readable by clients. */
import { api } from "@/convex/_generated/api";
import { ConvexReactClient } from "convex/react";

export type ProviderId = "google" | "gemini" | "openai";
export type CanonicalProviderId = "google" | "openai";

export interface CredentialMetadata {
  handle: string;
  provider: CanonicalProviderId;
  configured: boolean;
  health: "active" | "legacy" | "disabled" | "invalid";
  maskedHint: string;
  encryptionVersion: number;
  keyVersion: string;
  createdAt: number;
  updatedAt: number;
  disabledAt?: number;
}

export interface ProviderCredentials {
  google: CredentialMetadata | null;
  openai: CredentialMetadata | null;
}

export interface TestResult {
  valid: boolean;
  message: string;
}

/** Plaintext exists in the browser only while the user submits this authenticated action. */
export async function saveProviderCredential(
  convex: ConvexReactClient,
  provider: ProviderId,
  secretValue: string,
) {
  return convex.action(api.credentialActions.saveProviderCredential, { provider, secretValue });
}

export async function getProviderCredentials(convex: ConvexReactClient): Promise<ProviderCredentials> {
  return convex.query(api.apiKeys.getMyProviderCredentials, {});
}

export async function hasProviderCredential(convex: ConvexReactClient, provider: ProviderId): Promise<boolean> {
  return convex.query(api.apiKeys.hasProviderCredential, { provider });
}

export async function disableProviderCredential(convex: ConvexReactClient, provider: ProviderId) {
  return convex.mutation(api.apiKeys.disableProviderCredential, { provider });
}

/** Validation sends only the newly typed value over the authenticated TLS action; it is not persisted client-side. */
export async function testProviderCredential(
  convex: ConvexReactClient,
  provider: "gemini" | "openai",
  secretValue: string,
): Promise<TestResult> {
  return convex.action(api.apiKeyActions.testProviderApiKey, { provider, apiKey: secretValue });
}

export const secureStorageQueries = {
  getMyProviderCredentials: api.apiKeys.getMyProviderCredentials,
  hasProviderCredential: api.apiKeys.hasProviderCredential,
};

export const secureStorageMutations = {
  disableProviderCredential: api.apiKeys.disableProviderCredential,
};

export const secureStorageActions = {
  saveProviderCredential: api.credentialActions.saveProviderCredential,
  testProviderCredential: api.apiKeyActions.testProviderApiKey,
};
