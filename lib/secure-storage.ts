/**
 * Secure Storage Client
 * 
 * Client-side wrapper for securely storing and retrieving API keys
 * via Convex backend with server-side encryption.
 */

import { api } from "@/convex/_generated/api";
import { ConvexReactClient } from "convex/react";

export interface ApiKeyInfo {
  apiKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface TestResult {
  valid: boolean;
  message: string;
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

/**
 * Get the decrypted API key from Convex
 * Returns null if no key is stored
 */
export async function getApiKey(
  convex: ConvexReactClient
): Promise<ApiKeyInfo | null> {
  return await convex.query(api.apiKeys.getApiKey, {});
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
): Promise<{ success: boolean; error?: string }> {
  return await convex.mutation(api.apiKeys.deleteApiKey, {});
}

/**
 * Test if an API key is valid by making a test request to Gemini
 */
export async function testApiKey(
  convex: ConvexReactClient,
  apiKey: string
): Promise<TestResult> {
  return await convex.action(api.apiKeys.testApiKey, { apiKey });
}

/**
 * Hook-friendly utilities for use with Convex React hooks
 */
export const secureStorageQueries = {
  getApiKey: api.apiKeys.getApiKey,
  hasApiKey: api.apiKeys.hasApiKey,
};

export const secureStorageMutations = {
  saveApiKey: api.apiKeys.saveApiKey,
  deleteApiKey: api.apiKeys.deleteApiKey,
};

export const secureStorageActions = {
  testApiKey: api.apiKeys.testApiKey,
};

