/**
 * Secure Storage Client
 * 
 * Client-side wrapper for securely storing and retrieving API keys
 * via Convex backend with server-side encryption.
 */

import { api } from "@/convex/_generated/api";
import { ConvexReactClient } from "convex/react";

export type ProviderId = "gemini" | "openai";

export interface ApiKeyInfo {
  apiKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface TestResult {
  valid: boolean;
  message: string;
}

export interface ProviderApiKeys {
  gemini: ApiKeyInfo | null;
  openai: ApiKeyInfo | null;
}

/**
 * Save an API key securely to Convex
 * The key will be encrypted server-side before storage
 */
export async function saveApiKey(
  convex: ConvexReactClient,
  apiKey: string
): Promise<{ success: boolean; updated: boolean }> {
  return await convex.mutation(api.apiKeys.saveApiKey, { apiKey });
}

export async function saveProviderApiKey(
  convex: ConvexReactClient,
  provider: ProviderId,
  apiKey: string
): Promise<{ success: boolean; updated: boolean }> {
  return await convex.mutation(api.apiKeys.saveProviderApiKey, { provider, apiKey });
}

/**
 * Get the decrypted API key from Convex
 * Returns null if no key is stored
 */
export async function getApiKey(
  convex: ConvexReactClient
): Promise<ApiKeyInfo | null> {
  return await convex.query(api.apiKeys.getApiKey, {});
}

export async function getProviderApiKeys(
  convex: ConvexReactClient
): Promise<ProviderApiKeys> {
  return await convex.query(api.apiKeys.getMyProviderApiKeys, {});
}

/**
 * Check if user has an API key stored (without retrieving it)
 */
export async function hasApiKey(
  convex: ConvexReactClient
): Promise<boolean> {
  return await convex.query(api.apiKeys.hasApiKey, {});
}

/**
 * Delete the stored API key
 */
export async function deleteApiKey(
  convex: ConvexReactClient
): Promise<{ success: boolean; deleted: boolean }> {
  return await convex.mutation(api.apiKeys.deleteApiKey, {});
}

export async function deleteProviderApiKey(
  convex: ConvexReactClient,
  provider: ProviderId
): Promise<{ success: boolean; deleted: boolean }> {
  return await convex.mutation(api.apiKeys.deleteProviderApiKey, { provider });
}

/**
 * Test if an API key is valid by making a test request to Gemini
 */
export async function testApiKey(
  convex: ConvexReactClient,
  apiKey: string
): Promise<TestResult> {
  return await convex.action(api.apiKeyActions.testProviderApiKey, {
    provider: "gemini",
    apiKey,
  });
}

export async function testProviderApiKey(
  convex: ConvexReactClient,
  provider: ProviderId,
  apiKey: string
): Promise<TestResult> {
  return await convex.action(api.apiKeyActions.testProviderApiKey, {
    provider,
    apiKey,
  });
}

/**
 * Hook-friendly utilities for use with Convex React hooks
 */
export const secureStorageQueries = {
  getApiKey: api.apiKeys.getApiKey,
  hasApiKey: api.apiKeys.hasApiKey,
  getMyProviderApiKeys: api.apiKeys.getMyProviderApiKeys,
};

export const secureStorageMutations = {
  saveApiKey: api.apiKeys.saveApiKey,
  deleteApiKey: api.apiKeys.deleteApiKey,
  saveProviderApiKey: api.apiKeys.saveProviderApiKey,
  deleteProviderApiKey: api.apiKeys.deleteProviderApiKey,
};

export const secureStorageActions = {
  testApiKey: api.apiKeyActions.testProviderApiKey,
};

