import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authComponent } from "./auth";
import {
  canonicalizeProvider,
  credentialHealth,
  legacyCredentialHandle,
  recordCanonicalProvider,
  storageProvider,
  toCredentialMetadata,
  type CanonicalProvider,
  type ProviderInput,
} from "./credentialPolicy";

export const providerInputValidator = v.union(
  v.literal("google"),
  v.literal("gemini"),
  v.literal("openai"),
);
export const canonicalProviderValidator = v.union(v.literal("google"), v.literal("openai"));

const credentialHealthValidator = v.union(
  v.literal("active"),
  v.literal("legacy"),
  v.literal("disabled"),
  v.literal("invalid"),
);

const credentialMetadataValidator = v.object({
  handle: v.string(),
  provider: canonicalProviderValidator,
  configured: v.boolean(),
  health: credentialHealthValidator,
  maskedHint: v.string(),
  encryptionVersion: v.number(),
  keyVersion: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  disabledAt: v.optional(v.number()),
});

const platformKeySummaryValidator = v.object({
  keyPreview: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
});

type DbCtx = QueryCtx | MutationCtx;

async function requireUser(ctx: DbCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Must be authenticated");
  return user;
}

export async function getProviderCredentialRecord(
  ctx: DbCtx,
  userId: string,
  providerInput: ProviderInput,
) {
  const provider = canonicalizeProvider(providerInput);
  const records = await ctx.db
    .query("apiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return records.find((record) =>
    recordCanonicalProvider(record) === provider && credentialHealth(record) !== "disabled"
  ) ?? null;
}

/** Metadata-only public read. No credential envelope fields cross this boundary. */
export const getMyProviderCredentials = query({
  args: {},
  returns: v.object({
    google: v.union(credentialMetadataValidator, v.null()),
    openai: v.union(credentialMetadataValidator, v.null()),
  }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { google: null, openai: null };

    const [googleRecord, openaiRecord] = await Promise.all([
      getProviderCredentialRecord(ctx, user._id, "google"),
      getProviderCredentialRecord(ctx, user._id, "openai"),
    ]);
    return {
      google: googleRecord ? toCredentialMetadata({ ...googleRecord, credentialHandle: googleRecord.credentialHandle ?? legacyCredentialHandle(googleRecord._id) }) : null,
      openai: openaiRecord ? toCredentialMetadata({ ...openaiRecord, credentialHandle: openaiRecord.credentialHandle ?? legacyCredentialHandle(openaiRecord._id) }) : null,
    };
  },
});

export const hasProviderCredential = query({
  args: { provider: providerInputValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return false;
    const record = await getProviderCredentialRecord(ctx, user._id, args.provider);
    return record !== null && ["active", "legacy"].includes(credentialHealth(record));
  },
});

/** User deletion is a reversible disable; rollout code never destroys legacy ciphertext. */
export const disableProviderCredential = mutation({
  args: { provider: providerInputValidator },
  returns: v.object({ success: v.boolean(), disabled: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const record = await getProviderCredentialRecord(ctx, user._id, args.provider);
    if (!record) return { success: true, disabled: false };
    const now = Date.now();
    await ctx.db.patch(record._id, { health: "disabled", disabledAt: now, updatedAt: now });
    return { success: true, disabled: true };
  },
});

/** Internal raw storage read. Only the operation-scoped resolver may consume this DTO. */
export const getCredentialEnvelopeInternal = internalQuery({
  args: { credentialHandle: v.string() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("apiKeys")
      .withIndex("by_credential_handle", (q) => q.eq("credentialHandle", args.credentialHandle))
      .take(2);
    if (matches.length !== 1) return null;
    return matches[0];
  },
});

export const getCredentialBindingInternal = internalQuery({
  args: { ownerId: v.string(), provider: providerInputValidator },
  returns: v.union(v.object({ handle: v.string(), provider: canonicalProviderValidator }), v.null()),
  handler: async (ctx, args) => {
    const record = await getProviderCredentialRecord(ctx, args.ownerId, args.provider);
    if (!record?.credentialHandle) return null;
    return { handle: record.credentialHandle, provider: recordCanonicalProvider(record) };
  },
});

/** Atomically reserves one stable handle per owner/provider before AEAD encryption. */
export const reserveCredentialHandleInternal = internalMutation({
  args: {
    ownerId: v.string(),
    provider: canonicalProviderValidator,
    proposedHandle: v.string(),
    now: v.number(),
  },
  returns: v.object({ handle: v.string(), provider: canonicalProviderValidator, createdAt: v.number() }),
  handler: async (ctx, args) => {
    const existing = await getProviderCredentialRecord(ctx, args.ownerId, args.provider);
    if (existing) {
      const handle = existing.credentialHandle ?? legacyCredentialHandle(existing._id);
      if (!existing.credentialHandle) {
        await ctx.db.patch(existing._id, {
          credentialHandle: handle,
          canonicalProvider: args.provider,
          health: existing.encryptionVersion === 2 ? "active" : "legacy",
          keyVersion: existing.keyVersion ?? "legacy",
          updatedAt: args.now,
        });
      }
      return { handle, provider: args.provider, createdAt: existing.createdAt };
    }

    await ctx.db.insert("apiKeys", {
      userId: args.ownerId,
      provider: storageProvider(args.provider),
      canonicalProvider: args.provider,
      credentialHandle: args.proposedHandle,
      health: "invalid",
      maskedHint: "••••",
      createdAt: args.now,
      updatedAt: args.now,
    });
    return { handle: args.proposedHandle, provider: args.provider, createdAt: args.now };
  },
});

export const upsertCredentialEnvelopeInternal = internalMutation({
  args: {
    ownerId: v.string(),
    provider: canonicalProviderValidator,
    credentialHandle: v.string(),
    ciphertext: v.string(),
    nonce: v.string(),
    authTag: v.string(),
    encryptionVersion: v.literal(2),
    keyVersion: v.string(),
    maskedHint: v.string(),
    now: v.number(),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("apiKeys")
      .withIndex("by_credential_handle", (q) => q.eq("credentialHandle", args.credentialHandle))
      .take(2);
    if (matches.length !== 1) throw new Error("Credential envelope binding is invalid");
    const existing = matches[0];
    if (existing.userId !== args.ownerId || recordCanonicalProvider(existing) !== args.provider) {
      throw new Error("Credential envelope binding is invalid");
    }
    const wasConfigured = credentialHealth(existing) === "active" || credentialHealth(existing) === "legacy";
    const fields = {
      provider: storageProvider(args.provider),
      canonicalProvider: args.provider,
      credentialHandle: args.credentialHandle,
      ciphertext: args.ciphertext,
      nonce: args.nonce,
      authTag: args.authTag,
      encryptionVersion: args.encryptionVersion,
      keyVersion: args.keyVersion,
      health: "active" as const,
      maskedHint: args.maskedHint,
      disabledAt: undefined,
      updatedAt: args.now,
      // A v2 rewrite intentionally removes obsolete legacy material.
      encryptedKey: undefined,
      iv: undefined,
    };
    await ctx.db.patch(existing._id, fields);
    return { updated: wasConfigured };
  },
});

export const attachLegacyCredentialHandleInternal = internalMutation({
  args: {
    ownerId: v.string(),
    provider: canonicalProviderValidator,
    now: v.number(),
  },
  returns: v.union(v.object({ handle: v.string(), provider: canonicalProviderValidator }), v.null()),
  handler: async (ctx, args) => {
    const record = await getProviderCredentialRecord(ctx, args.ownerId, args.provider);
    if (!record) return null;
    const handle = record.credentialHandle ?? legacyCredentialHandle(record._id);
    if (!record.credentialHandle) {
      await ctx.db.patch(record._id, {
        credentialHandle: handle,
        canonicalProvider: args.provider,
        health: record.encryptionVersion === 2 ? "active" : "legacy",
        keyVersion: record.keyVersion ?? "legacy",
        updatedAt: args.now,
      });
    }
    return { handle, provider: args.provider };
  },
});

/** Read-only rollout inventory; it never decrypts, rewrites, or deletes records. */
export const inventoryLegacyCredentialRecordsInternal = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("apiKeys").order("asc").paginate(args.paginationOpts);
    const records = result.page;
    const legacy = records.filter((record) => record.encryptionVersion !== 2);
    return {
      scanned: records.length,
      legacy: legacy.length,
      missingHandle: records.filter((record) => !record.credentialHandle).length,
      byLegacyProvider: {
        gemini: legacy.filter((record) => record.provider === "gemini" || record.provider === undefined).length,
        openai: legacy.filter((record) => record.provider === "openai").length,
      },
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getPlatformApiKeySummary = query({
  args: {},
  returns: v.union(platformKeySummaryValidator, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const keys = await ctx.db.query("platformApiKeys").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const activeKey = keys.filter((record) => record.revokedAt === undefined).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    return activeKey ? {
      keyPreview: `${activeKey.keyPrefix}...`,
      createdAt: activeKey.createdAt,
      lastUsedAt: activeKey.lastUsedAt,
    } : null;
  },
});

export const revokePlatformApiKey = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), revoked: v.boolean() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const keys = await ctx.db.query("platformApiKeys").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const activeKeys = keys.filter((record) => record.revokedAt === undefined);
    if (activeKeys.length === 0) return { success: true, revoked: false };
    const now = Date.now();
    await Promise.all(activeKeys.map((record) => ctx.db.patch(record._id, { revokedAt: now })));
    return { success: true, revoked: true };
  },
});

export const getPlatformApiKeyByHashInternal = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const matches = await ctx.db.query("platformApiKeys").withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash)).collect();
    const activeKey = matches.find((record) => record.revokedAt === undefined) ?? null;
    if (!activeKey) return null;
    return {
      keyId: activeKey._id,
      userId: activeKey.userId,
      createdAt: activeKey.createdAt,
      lastUsedAt: activeKey.lastUsedAt,
    };
  },
});

export const rotatePlatformApiKeyInternal = internalMutation({
  args: { userId: v.string(), keyHash: v.string(), keyPrefix: v.string(), createdAt: v.number() },
  returns: v.object({ rotated: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("platformApiKeys").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const activeKeys = existing.filter((record) => record.revokedAt === undefined);
    await Promise.all(activeKeys.map((record) => ctx.db.patch(record._id, { revokedAt: args.createdAt })));
    await ctx.db.insert("platformApiKeys", {
      userId: args.userId,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      createdAt: args.createdAt,
    });
    return { rotated: activeKeys.length > 0 };
  },
});

export const markPlatformApiKeyUsedInternal = internalMutation({
  args: { keyId: v.id("platformApiKeys"), usedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: args.usedAt });
    return null;
  },
});
