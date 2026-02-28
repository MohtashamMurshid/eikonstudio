import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { authComponent } from "./auth";

const skillValidator = v.object({
  _id: v.id("skills"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  description: v.string(),
  promptText: v.string(),
  createdAt: v.number(),
});

// Create a new custom skill
export const createSkill = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    promptText: v.string(),
  },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Must be authenticated to create skills");
    }

    // Normalize the skill name (lowercase, no spaces, alphanumeric and hyphens only)
    const normalizedName = args.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!normalizedName) {
      throw new ConvexError("Skill name cannot be empty");
    }

    // Check if user already has a skill with this name
    const existingSkill = await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", user._id).eq("name", normalizedName)
      )
      .first();

    if (existingSkill) {
      throw new ConvexError(`You already have a skill named "${normalizedName}"`);
    }

    const skillId = await ctx.db.insert("skills", {
      userId: user._id,
      name: normalizedName,
      description: args.description.trim(),
      promptText: args.promptText.trim(),
      createdAt: Date.now(),
    });

    return skillId;
  },
});

// Update an existing custom skill
export const updateSkill = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    promptText: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Must be authenticated to update skills");
    }

    const skill = await ctx.db.get("skills", args.skillId);
    if (!skill) {
      throw new ConvexError("Skill not found");
    }

    if (skill.userId !== user._id) {
      throw new ConvexError("Cannot update another user's skill");
    }

    const updates: Partial<{
      name: string;
      description: string;
      promptText: string;
    }> = {};

    if (args.name !== undefined) {
      const normalizedName = args.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      if (!normalizedName) {
        throw new ConvexError("Skill name cannot be empty");
      }

      // Check if user already has another skill with this name
      if (normalizedName !== skill.name) {
        const existingSkill = await ctx.db
          .query("skills")
          .withIndex("by_user_name", (q) => 
            q.eq("userId", user._id).eq("name", normalizedName)
          )
          .first();

        if (existingSkill) {
          throw new ConvexError(`You already have a skill named "${normalizedName}"`);
        }
      }

      updates.name = normalizedName;
    }

    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }

    if (args.promptText !== undefined) {
      updates.promptText = args.promptText.trim();
    }

    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    await ctx.db.patch("skills", args.skillId, updates);
    return { success: true };
  },
});

// Delete a custom skill
export const deleteSkill = mutation({
  args: {
    skillId: v.id("skills"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError("Must be authenticated to delete skills");
    }

    const skill = await ctx.db.get("skills", args.skillId);
    if (!skill) {
      throw new ConvexError("Skill not found");
    }

    if (skill.userId !== user._id) {
      throw new ConvexError("Cannot delete another user's skill");
    }

    await ctx.db.delete("skills", args.skillId);
    return { success: true };
  },
});

// Get all custom skills for the current user
export const getMySkills = query({
  args: {},
  returns: v.array(skillValidator),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const skills = await ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return skills;
  },
});

// Search skills for autocomplete (combines predefined + user's custom skills)
// This is called from the client but returns only user's custom skills
// Predefined skills are handled client-side for instant loading
export const searchCustomSkills = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(skillValidator),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const limit = args.limit ?? 10;
    const searchLower = args.searchTerm.toLowerCase();

    // Get all user's skills and filter by search term
    const allSkills = await ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const matchingSkills = allSkills
      .filter((skill) => 
        skill.name.includes(searchLower) || 
        skill.description.toLowerCase().includes(searchLower)
      )
      .slice(0, limit);

    return matchingSkills;
  },
});

// Get a skill by name for the current user (used for server-side prompt appending)
export const getSkillByName = query({
  args: {
    name: v.string(),
  },
  returns: v.union(v.null(), skillValidator),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const skill = await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", user._id).eq("name", args.name.toLowerCase())
      )
      .first();

    return skill;
  },
});

// Internal query to get a skill by name for a specific user
// Used by background actions that don't have auth context
export const getSkillByNameInternal = internalQuery({
  args: {
    userId: v.string(),
    name: v.string(),
  },
  returns: v.union(v.null(), skillValidator),
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => 
        q.eq("userId", args.userId).eq("name", args.name.toLowerCase())
      )
      .first();

    return skill;
  },
});
