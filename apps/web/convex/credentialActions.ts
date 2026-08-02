"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  CREDENTIAL_ENCRYPTION_VERSION,
  CREDENTIAL_KEY_VERSION,
  createCredentialHandle,
  decryptCredentialV2,
  decryptLegacyCredential,
  encryptCredentialV2,
  readCredentialEncryptionSecret,
} from "./credentialCrypto";
import {
  assertCredentialOperationMatch,
  canonicalizeProvider,
  maskCredentialHint,
  recordCanonicalProvider,
} from "./credentialPolicy";
import { canonicalProviderValidator, providerInputValidator } from "./apiKeys";

const credentialMetadataValidator = v.object({
  handle: v.string(),
  provider: canonicalProviderValidator,
  configured: v.boolean(),
  health: v.literal("active"),
  maskedHint: v.string(),
  encryptionVersion: v.literal(2),
  keyVersion: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

type SaveProviderCredentialResult = {
  success: boolean;
  updated: boolean;
  credential: {
    handle: string;
    provider: "google" | "openai";
    configured: boolean;
    health: "active";
    maskedHint: string;
    encryptionVersion: 2;
    keyVersion: string;
    createdAt: number;
    updatedAt: number;
  };
};

export const saveProviderCredential = action({
  args: { provider: providerInputValidator, secretValue: v.string() },
  returns: v.object({ success: v.boolean(), updated: v.boolean(), credential: credentialMetadataValidator }),
  handler: async (ctx, args): Promise<SaveProviderCredentialResult> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user) throw new ConvexError("Must be authenticated");
    const secretValue = args.secretValue.trim();
    if (!secretValue) throw new ConvexError("Credential cannot be empty");

    const provider = canonicalizeProvider(args.provider);
    const now = Date.now();
    const reserved: { handle: string; provider: "google" | "openai"; createdAt: number } = await ctx.runMutation(internal.apiKeys.reserveCredentialHandleInternal, {
      ownerId: user._id,
      provider,
      proposedHandle: createCredentialHandle(),
      now,
    });
    const handle = reserved.handle;
    const keyVersion = CREDENTIAL_KEY_VERSION;
    const encrypted = await encryptCredentialV2(
      secretValue,
      { ownerId: user._id, provider, handle, keyVersion },
      readCredentialEncryptionSecret(),
    );
    const result: { updated: boolean } = await ctx.runMutation(internal.apiKeys.upsertCredentialEnvelopeInternal, {
      ownerId: user._id,
      provider,
      credentialHandle: handle,
      ...encrypted,
      maskedHint: maskCredentialHint(secretValue),
      now,
    });

    return {
      success: true,
      updated: result.updated,
      credential: {
        handle,
        provider,
        configured: true,
        health: "active" as const,
        maskedHint: maskCredentialHint(secretValue),
        encryptionVersion: CREDENTIAL_ENCRYPTION_VERSION,
        keyVersion,
        createdAt: reserved.createdAt,
        updatedAt: now,
      },
    };
  },
});

/**
 * Returns plaintext only to an internal action for one provider operation.
 * Ownership, canonical provider, stable handle, health, and AEAD AAD are all checked.
 */
export const resolveCredentialForOperation = internalAction({
  args: {
    ownerId: v.string(),
    provider: providerInputValidator,
    credentialHandle: v.string(),
  },
  returns: v.object({ secretValue: v.string() }),
  handler: async (ctx, args): Promise<{ secretValue: string }> => {
    const record: Doc<"apiKeys"> | null = await ctx.runQuery(internal.apiKeys.getCredentialEnvelopeInternal, {
      credentialHandle: args.credentialHandle,
    });
    if (!record) throw new Error("Credential is unavailable for this operation");

    assertCredentialOperationMatch(record, {
      ownerId: args.ownerId,
      provider: args.provider,
      handle: args.credentialHandle,
    });
    const provider = recordCanonicalProvider(record);

    if (
      record.encryptionVersion === CREDENTIAL_ENCRYPTION_VERSION &&
      record.ciphertext && record.nonce && record.authTag && record.keyVersion
    ) {
      return {
        secretValue: await decryptCredentialV2(
          {
            ciphertext: record.ciphertext,
            nonce: record.nonce,
            authTag: record.authTag,
            encryptionVersion: CREDENTIAL_ENCRYPTION_VERSION,
            keyVersion: record.keyVersion,
          },
          { ownerId: args.ownerId, provider, handle: args.credentialHandle },
        ),
      };
    }

    if (record.encryptedKey && record.iv) {
      return {
        secretValue: decryptLegacyCredential(record.encryptedKey, record.iv, args.ownerId),
      };
    }

    throw new Error("Credential is unavailable for this operation");
  },
});

/** Gateway bridge: acquire/attach a handle, then pass through the exact resolver. */
export const resolveConfiguredCredentialForOperation = internalAction({
  args: { ownerId: v.string(), provider: providerInputValidator },
  returns: v.object({ secretValue: v.string(), credentialHandle: v.string(), provider: canonicalProviderValidator }),
  handler: async (ctx, args): Promise<{ secretValue: string; credentialHandle: string; provider: "google" | "openai" }> => {
    const provider = canonicalizeProvider(args.provider);
    let binding: { handle: string; provider: "google" | "openai" } | null = await ctx.runQuery(internal.apiKeys.getCredentialBindingInternal, {
      ownerId: args.ownerId,
      provider,
    });
    if (!binding) {
      binding = await ctx.runMutation(internal.apiKeys.attachLegacyCredentialHandleInternal, {
        ownerId: args.ownerId,
        provider,
        now: Date.now(),
      });
    }
    if (!binding) throw new Error("Credential is unavailable for this operation");

    const resolved: { secretValue: string } = await ctx.runAction(internal.credentialActions.resolveCredentialForOperation, {
      ownerId: args.ownerId,
      provider,
      credentialHandle: binding.handle,
    });
    return { ...resolved, credentialHandle: binding.handle, provider };
  },
});
