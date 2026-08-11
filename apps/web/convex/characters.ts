import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { removeDocumentStorageReferences, replaceDocumentStorageReferences } from "./storageReferenceLedger";

const appearanceValidator = v.object({
  gender: v.optional(v.string()),
  age: v.optional(v.string()),
  height: v.optional(v.string()),
  eyeColor: v.optional(v.string()),
  hairColor: v.optional(v.string()),
  hairStyle: v.optional(v.string()),
  skinTone: v.optional(v.string()),
  facialHair: v.optional(v.string()),
  build: v.optional(v.string()),
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Must be authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const createCharacter = mutation({
  args: {
    name: v.string(),
    genre: v.optional(v.string()),
    archetype: v.optional(v.string()),
    appearance: appearanceValidator,
    outfit: v.optional(v.string()),
    details: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Must be authenticated to create characters");

    const characterId = await ctx.db.insert("characters", {
      userId: user._id,
      name: args.name,
      genre: args.genre,
      archetype: args.archetype,
      appearance: args.appearance,
      outfit: args.outfit,
      details: args.details,
      avatarStorageId: args.avatarStorageId,
      createdAt: Date.now(),
    });
    await replaceDocumentStorageReferences(ctx, {
      source: "characters",
      documentId: characterId,
      ownerId: user._id,
      references: [{ field: "avatarStorageId", storageIds: args.avatarStorageId ? [args.avatarStorageId] : [] }],
    });
    return characterId;
  },
});

export const getMyCharacters = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      characters.map(async (char) => ({
        ...char,
        avatarUrl: char.avatarStorageId
          ? await ctx.storage.getUrl(char.avatarStorageId)
          : null,
      }))
    );
  },
});

export const updateCharacter = mutation({
  args: {
    characterId: v.id("characters"),
    name: v.optional(v.string()),
    genre: v.optional(v.string()),
    archetype: v.optional(v.string()),
    appearance: v.optional(appearanceValidator),
    outfit: v.optional(v.string()),
    details: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Must be authenticated");

    const character = await ctx.db.get(args.characterId);
    if (!character) throw new Error("Character not found");
    if (character.userId !== user._id) throw new Error("Not your character");

    const { characterId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(characterId, filtered);
    const avatarStorageId = args.avatarStorageId ?? character.avatarStorageId;
    await replaceDocumentStorageReferences(ctx, {
      source: "characters",
      documentId: characterId,
      ownerId: user._id,
      references: [{ field: "avatarStorageId", storageIds: avatarStorageId ? [avatarStorageId] : [] }],
    });
  },
});

export const deleteCharacter = mutation({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Must be authenticated");

    const character = await ctx.db.get(args.characterId);
    if (!character) throw new Error("Character not found");
    if (character.userId !== user._id) throw new Error("Not your character");

    // Avatars may be shared with gallery/reference rows; retain storage for reconciliation.
    await removeDocumentStorageReferences(ctx, "characters", args.characterId, user._id);
    await ctx.db.delete(args.characterId);
  },
});
