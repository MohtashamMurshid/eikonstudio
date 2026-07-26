import { ConvexError, v } from "convex/values";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authComponent } from "./auth";

const providerValidator = v.union(v.literal("gemini"), v.literal("openai"));

const providerKeyInfoValidator = v.object({
  apiKey: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const platformKeySummaryValidator = v.object({
  keyPreview: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
});

type Provider = "gemini" | "openai";
type DbCtx = QueryCtx | MutationCtx;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i] ?? 0;
    const byte2 = bytes[i + 1] ?? 0;
    const byte3 = bytes[i + 2] ?? 0;

    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : "=";
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 0x3f] : "=";
  }

  return output;
}

function decodeBase64(base64: string): Uint8Array {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  if (sanitized.length % 4 !== 0) {
    throw new Error("Invalid base64 input");
  }

  const bytes: number[] = [];

  for (let i = 0; i < sanitized.length; i += 4) {
    const char1 = sanitized[i];
    const char2 = sanitized[i + 1];
    const char3 = sanitized[i + 2];
    const char4 = sanitized[i + 3];

    const enc1 = BASE64_ALPHABET.indexOf(char1);
    const enc2 = BASE64_ALPHABET.indexOf(char2);
    const enc3 = char3 === "=" ? 0 : BASE64_ALPHABET.indexOf(char3);
    const enc4 = char4 === "=" ? 0 : BASE64_ALPHABET.indexOf(char4);

    if (enc1 < 0 || enc2 < 0 || (char3 !== "=" && enc3 < 0) || (char4 !== "=" && enc4 < 0)) {
      throw new Error("Invalid base64 input");
    }

    const triplet = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;

    bytes.push((triplet >> 16) & 0xff);
    if (char3 !== "=") {
      bytes.push((triplet >> 8) & 0xff);
    }
    if (char4 !== "=") {
      bytes.push(triplet & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

function deriveKey(userId: string, secret: string): string {
  const combined = `${userId}:${secret}:eikon-secure-key`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(36).padStart(32, "0").slice(0, 32);
}

function encrypt(plaintext: string, key: string, iv: string): string {
  const fullKey = key + iv;
  const encryptedBytes = new Uint8Array(plaintext.length);

  for (let i = 0; i < plaintext.length; i++) {
    encryptedBytes[i] =
      (plaintext.charCodeAt(i) ^ fullKey.charCodeAt(i % fullKey.length)) & 0xff;
  }

  return encodeBase64(encryptedBytes);
}

function decrypt(ciphertext: string, key: string, iv: string): string {
  const fullKey = key + iv;
  const encrypted = decodeBase64(ciphertext);
  let decrypted = "";

  for (let i = 0; i < encrypted.length; i++) {
    const charCode =
      encrypted[i] ^ fullKey.charCodeAt(i % fullKey.length);
    decrypted += String.fromCharCode(charCode);
  }

  return decrypted;
}

function generateIV(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let iv = "";
  for (let i = 0; i < 16; i++) {
    iv += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return iv;
}

const SERVER_SECRET =
  process.env.ENCRYPTION_SECRET || "eikon-default-secret-change-in-prod";

async function requireUser(ctx: DbCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) {
    throw new ConvexError("Must be authenticated");
  }
  return user;
}

async function getProviderKeyRecord(
  ctx: DbCtx,
  userId: string,
  provider: Provider,
) {
  const records = await ctx.db
    .query("apiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return (
    records.find((record) => record.provider === provider) ??
    (provider === "gemini"
      ? records.find((record) => record.provider === undefined)
      : undefined) ??
    null
  );
}

function formatProviderKeyRecord(
  userId: string,
  encryptedKey: string,
  iv: string,
  createdAt: number,
  updatedAt: number,
) {
  const key = deriveKey(userId, SERVER_SECRET);
  return {
    apiKey: decrypt(encryptedKey, key, iv),
    createdAt,
    updatedAt,
  };
}

async function upsertProviderApiKey(
  ctx: MutationCtx,
  userId: string,
  provider: Provider,
  apiKey: string,
) {
  const existing = await getProviderKeyRecord(ctx, userId, provider);
  const iv = generateIV();
  const key = deriveKey(userId, SERVER_SECRET);
  const encryptedKey = encrypt(apiKey, key, iv);
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      provider,
      encryptedKey,
      iv,
      updatedAt: now,
    });
    return { success: true, updated: true };
  }

  await ctx.db.insert("apiKeys", {
    userId,
    provider,
    encryptedKey,
    iv,
    createdAt: now,
    updatedAt: now,
  });

  return { success: true, updated: false };
}

async function readProviderApiKey(
  ctx: QueryCtx,
  userId: string,
  provider: Provider,
) {
  const record = await getProviderKeyRecord(ctx, userId, provider);
  return record
    ? formatProviderKeyRecord(
        userId,
        record.encryptedKey,
        record.iv,
        record.createdAt,
        record.updatedAt,
      )
    : null;
}

async function deleteProviderApiKeyForUser(
  ctx: MutationCtx,
  userId: string,
  provider: Provider,
) {
  const record = await getProviderKeyRecord(ctx, userId, provider);
  if (!record) {
    return { success: true, deleted: false };
  }

  await ctx.db.delete(record._id);
  return { success: true, deleted: true };
}

export const saveProviderApiKey = mutation({
  args: {
    provider: providerValidator,
    apiKey: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await upsertProviderApiKey(ctx, user._id, args.provider, args.apiKey);
  },
});

export const getMyProviderApiKeys = query({
  args: {},
  returns: v.object({
    gemini: v.union(providerKeyInfoValidator, v.null()),
    openai: v.union(providerKeyInfoValidator, v.null()),
  }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return {
        gemini: null,
        openai: null,
      };
    }

    const [geminiRecord, openaiRecord] = await Promise.all([
      getProviderKeyRecord(ctx, user._id, "gemini"),
      getProviderKeyRecord(ctx, user._id, "openai"),
    ]);

    return {
      gemini: geminiRecord
        ? formatProviderKeyRecord(
            user._id,
            geminiRecord.encryptedKey,
            geminiRecord.iv,
            geminiRecord.createdAt,
            geminiRecord.updatedAt,
          )
        : null,
      openai: openaiRecord
        ? formatProviderKeyRecord(
            user._id,
            openaiRecord.encryptedKey,
            openaiRecord.iv,
            openaiRecord.createdAt,
            openaiRecord.updatedAt,
          )
        : null,
    };
  },
});

export const getProviderApiKey = query({
  args: {
    provider: providerValidator,
  },
  returns: v.union(providerKeyInfoValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    return await readProviderApiKey(ctx, user._id, args.provider);
  },
});

export const hasProviderApiKey = query({
  args: {
    provider: providerValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return false;
    }

    const record = await getProviderKeyRecord(ctx, user._id, args.provider);
    return record !== null;
  },
});

export const deleteProviderApiKey = mutation({
  args: {
    provider: providerValidator,
  },
  returns: v.object({
    success: v.boolean(),
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await deleteProviderApiKeyForUser(ctx, user._id, args.provider);
  },
});

export const getPlatformApiKeySummary = query({
  args: {},
  returns: v.union(platformKeySummaryValidator, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const keys = await ctx.db
      .query("platformApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeKey =
      keys
        .filter((record) => record.revokedAt === undefined)
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

    if (!activeKey) {
      return null;
    }

    return {
      keyPreview: `${activeKey.keyPrefix}...`,
      createdAt: activeKey.createdAt,
      lastUsedAt: activeKey.lastUsedAt,
    };
  },
});

export const revokePlatformApiKey = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    revoked: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const keys = await ctx.db
      .query("platformApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeKeys = keys.filter((record) => record.revokedAt === undefined);
    if (activeKeys.length === 0) {
      return { success: true, revoked: false };
    }

    const now = Date.now();
    await Promise.all(
      activeKeys.map((record) =>
        ctx.db.patch(record._id, {
          revokedAt: now,
        }),
      ),
    );

    return { success: true, revoked: true };
  },
});

export const getProviderApiKeyInternal = internalQuery({
  args: {
    userId: v.string(),
    provider: providerValidator,
  },
  returns: v.union(
    v.object({
      apiKey: v.string(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const record = await getProviderKeyRecord(ctx, args.userId, args.provider);
    if (!record) {
      return null;
    }

    const key = deriveKey(args.userId, SERVER_SECRET);
    return {
      apiKey: decrypt(record.encryptedKey, key, record.iv),
      updatedAt: record.updatedAt,
    };
  },
});

export const getPlatformApiKeyByHashInternal = internalQuery({
  args: {
    keyHash: v.string(),
  },
  returns: v.union(
    v.object({
      keyId: v.id("platformApiKeys"),
      userId: v.string(),
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("platformApiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
      .collect();

    const activeKey = matches.find((record) => record.revokedAt === undefined) ?? null;
    if (!activeKey) {
      return null;
    }

    return {
      keyId: activeKey._id,
      userId: activeKey.userId,
      createdAt: activeKey.createdAt,
      lastUsedAt: activeKey.lastUsedAt,
    };
  },
});

export const rotatePlatformApiKeyInternal = internalMutation({
  args: {
    userId: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    createdAt: v.number(),
  },
  returns: v.object({
    rotated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("platformApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeKeys = existing.filter((record) => record.revokedAt === undefined);
    await Promise.all(
      activeKeys.map((record) =>
        ctx.db.patch(record._id, {
          revokedAt: args.createdAt,
        }),
      ),
    );

    await ctx.db.insert("platformApiKeys", {
      userId: args.userId,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      createdAt: args.createdAt,
    });

    return {
      rotated: activeKeys.length > 0,
    };
  },
});

export const markPlatformApiKeyUsedInternal = internalMutation({
  args: {
    keyId: v.id("platformApiKeys"),
    usedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      lastUsedAt: args.usedAt,
    });
    return null;
  },
});

// Backward-compatible Gemini wrappers
export const saveApiKey = mutation({
  args: {
    apiKey: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await upsertProviderApiKey(ctx, user._id, "gemini", args.apiKey);
  },
});

export const getApiKey = query({
  args: {},
  returns: v.union(providerKeyInfoValidator, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user ? await readProviderApiKey(ctx, user._id, "gemini") : null;
  },
});

export const hasApiKey = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return false;
    }
    return (await getProviderKeyRecord(ctx, user._id, "gemini")) !== null;
  },
});

export const deleteApiKey = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    deleted: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await deleteProviderApiKeyForUser(ctx, user._id, "gemini");
  },
});

