import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { authComponent } from "./auth";
import { api } from "./_generated/api";

/**
 * Server-side encryption utilities
 * Uses a simple but effective encryption scheme:
 * - Key is derived from a combination of user ID and a server secret
 * - Uses XOR cipher with a derived key (simple but effective for this use case)
 * - IV adds randomness to each encryption
 */

// Simple server-side encryption (XOR-based for Convex compatibility)
// In production, you'd use a more robust solution with external KMS
function deriveKey(userId: string, secret: string): string {
  // Create a deterministic but unique key per user
  const combined = `${userId}:${secret}:eikon-secure-key`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(32, '0').slice(0, 32);
}

function encrypt(plaintext: string, key: string, iv: string): string {
  const fullKey = key + iv;
  let encrypted = '';
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length);
    encrypted += String.fromCharCode(charCode);
  }
  // Convert to base64 for safe storage
  return Buffer.from(encrypted, 'binary').toString('base64');
}

function decrypt(ciphertext: string, key: string, iv: string): string {
  const fullKey = key + iv;
  // Decode from base64
  const encrypted = Buffer.from(ciphertext, 'base64').toString('binary');
  let decrypted = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

function generateIV(): string {
  // Generate a random 16-character IV
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let iv = '';
  for (let i = 0; i < 16; i++) {
    iv += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return iv;
}

// Server secret - in production, this would be in environment variables
const SERVER_SECRET = process.env.ENCRYPTION_SECRET || "eikon-default-secret-change-in-prod";

// Save or update API key for current user
export const saveApiKey = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to save API key");
    }

    const iv = generateIV();
    const key = deriveKey(user._id, SERVER_SECRET);
    const encryptedKey = encrypt(args.apiKey, key, iv);

    // Check if user already has an API key
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing key
      await ctx.db.patch(existing._id, {
        encryptedKey,
        iv,
        updatedAt: now,
      });
      return { success: true, updated: true };
    } else {
      // Create new key
      await ctx.db.insert("apiKeys", {
        userId: user._id,
        encryptedKey,
        iv,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, updated: false };
    }
  },
});

// Get decrypted API key for current user
export const getApiKey = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!apiKeyRecord) {
      return null;
    }

    const key = deriveKey(user._id, SERVER_SECRET);
    const decryptedKey = decrypt(apiKeyRecord.encryptedKey, key, apiKeyRecord.iv);

    return {
      apiKey: decryptedKey,
      createdAt: apiKeyRecord.createdAt,
      updatedAt: apiKeyRecord.updatedAt,
    };
  },
});

// Check if user has an API key stored (without decrypting)
export const hasApiKey = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return false;
    }

    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return !!apiKeyRecord;
  },
});

// Delete API key for current user
export const deleteApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to delete API key");
    }

    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (apiKeyRecord) {
      await ctx.db.delete(apiKeyRecord._id);
      return { success: true };
    }

    return { success: false, error: "No API key found" };
  },
});

// Test if an API key is valid by making a simple request to Gemini
export const testApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Make a simple models list request to verify the key works
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${args.apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        return { valid: true, message: "API key is valid" };
      } else {
        const error = await response.json();
        return { 
          valid: false, 
          message: error.error?.message || "Invalid API key" 
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        message: "Failed to verify API key. Please check your internet connection." 
      };
    }
  },
});

