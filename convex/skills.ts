import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { createAppError } from "../lib/error-utils";

const skillSectionsValidator = v.object({
  styleOverview: v.optional(v.string()),
  visualHallmarks: v.optional(v.string()),
  composition: v.optional(v.string()),
  lighting: v.optional(v.string()),
  palette: v.optional(v.string()),
  materialsAndTextures: v.optional(v.string()),
  mustInclude: v.optional(v.string()),
  avoid: v.optional(v.string()),
  negativePrompt: v.optional(v.string()),
});

const skillInputValidator = {
  name: v.string(),
  description: v.string(),
  category: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  promptText: v.optional(v.string()),
  freeformInstructions: v.optional(v.string()),
  sections: v.optional(skillSectionsValidator),
  builtInSkillKey: v.optional(v.string()),
  isBuiltIn: v.optional(v.boolean()),
  isEditable: v.optional(v.boolean()),
  sortOrder: v.optional(v.number()),
} as const;

const skillValidator = v.object({
  _id: v.id("skills"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  description: v.string(),
  category: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  promptText: v.optional(v.string()),
  freeformInstructions: v.optional(v.string()),
  sections: v.optional(skillSectionsValidator),
  builtInSkillKey: v.optional(v.string()),
  isBuiltIn: v.optional(v.boolean()),
  isEditable: v.optional(v.boolean()),
  sortOrder: v.optional(v.number()),
  createdAt: v.number(),
});

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
}

function cleanSections(
  sections:
    | {
        styleOverview?: string;
        visualHallmarks?: string;
        composition?: string;
        lighting?: string;
        palette?: string;
        materialsAndTextures?: string;
        mustInclude?: string;
        avoid?: string;
        negativePrompt?: string;
      }
    | undefined,
) {
  if (!sections) return undefined;

  const cleaned = {
    styleOverview: cleanString(sections.styleOverview),
    visualHallmarks: cleanString(sections.visualHallmarks),
    composition: cleanString(sections.composition),
    lighting: cleanString(sections.lighting),
    palette: cleanString(sections.palette),
    materialsAndTextures: cleanString(sections.materialsAndTextures),
    mustInclude: cleanString(sections.mustInclude),
    avoid: cleanString(sections.avoid),
    negativePrompt: cleanString(sections.negativePrompt),
  };

  return Object.values(cleaned).some(Boolean) ? cleaned : undefined;
}

function buildStoredSkill(args: {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  promptText?: string;
  freeformInstructions?: string;
  sections?: {
    styleOverview?: string;
    visualHallmarks?: string;
    composition?: string;
    lighting?: string;
    palette?: string;
    materialsAndTextures?: string;
    mustInclude?: string;
    avoid?: string;
    negativePrompt?: string;
  };
  builtInSkillKey?: string;
  isBuiltIn?: boolean;
  isEditable?: boolean;
  sortOrder?: number;
}) {
  const normalizedName = normalizeName(args.name);
  if (!normalizedName) {
    throw new ConvexError(
      createAppError("VALIDATION_ERROR", "Skill name cannot be empty"),
    );
  }

  const description = args.description.trim();
  if (!description) {
    throw new ConvexError(
      createAppError("VALIDATION_ERROR", "Skill description cannot be empty"),
    );
  }

  return {
    name: normalizedName,
    description,
    category: cleanString(args.category),
    tags: cleanTags(args.tags),
    promptText: cleanString(args.promptText),
    freeformInstructions: cleanString(args.freeformInstructions),
    sections: cleanSections(args.sections),
    builtInSkillKey: cleanString(args.builtInSkillKey),
    isBuiltIn: args.isBuiltIn,
    isEditable: args.isEditable,
    sortOrder: args.sortOrder,
  };
}

export const createSkill = mutation({
  args: skillInputValidator,
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to create skills"),
      );
    }

    const storedSkill = buildStoredSkill(args);

    const existingSkill = await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", storedSkill.name))
      .first();

    if (existingSkill) {
      throw new ConvexError(
        createAppError(
          "CONFLICT",
          `You already have a skill named "${storedSkill.name}"`,
        ),
      );
    }

    return await ctx.db.insert("skills", {
      userId: user._id,
      ...storedSkill,
      createdAt: Date.now(),
    });
  },
});

export const updateSkill = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    promptText: v.optional(v.string()),
    freeformInstructions: v.optional(v.string()),
    sections: v.optional(skillSectionsValidator),
    builtInSkillKey: v.optional(v.string()),
    isBuiltIn: v.optional(v.boolean()),
    isEditable: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to update skills"),
      );
    }

    const skill = await ctx.db.get("skills", args.skillId);
    if (!skill) {
      throw new ConvexError(createAppError("NOT_FOUND", "Skill not found"));
    }

    if (skill.userId !== user._id) {
      throw new ConvexError(
        createAppError("FORBIDDEN", "You can only update your own skills"),
      );
    }

    const nextName = args.name !== undefined ? normalizeName(args.name) : skill.name;
    if (!nextName) {
      throw new ConvexError(
        createAppError("VALIDATION_ERROR", "Skill name cannot be empty"),
      );
    }

    if (args.description !== undefined && !args.description.trim()) {
      throw new ConvexError(
        createAppError("VALIDATION_ERROR", "Skill description cannot be empty"),
      );
    }

    if (nextName !== skill.name) {
      const existingSkill = await ctx.db
        .query("skills")
        .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", nextName))
        .first();

      if (existingSkill) {
        throw new ConvexError(
          createAppError(
            "CONFLICT",
            `You already have a skill named "${nextName}"`,
          ),
        );
      }
    }

    const updates = {
      name: nextName,
      description: args.description !== undefined ? args.description.trim() : skill.description,
      category: args.category !== undefined ? cleanString(args.category) : skill.category,
      tags: args.tags !== undefined ? cleanTags(args.tags) : skill.tags,
      promptText: args.promptText !== undefined ? cleanString(args.promptText) : skill.promptText,
      freeformInstructions:
        args.freeformInstructions !== undefined
          ? cleanString(args.freeformInstructions)
          : skill.freeformInstructions,
      sections: args.sections !== undefined ? cleanSections(args.sections) : skill.sections,
      builtInSkillKey:
        args.builtInSkillKey !== undefined ? cleanString(args.builtInSkillKey) : skill.builtInSkillKey,
      isBuiltIn: args.isBuiltIn !== undefined ? args.isBuiltIn : skill.isBuiltIn,
      isEditable: args.isEditable !== undefined ? args.isEditable : skill.isEditable,
      sortOrder: args.sortOrder !== undefined ? args.sortOrder : skill.sortOrder,
    };

    await ctx.db.patch("skills", args.skillId, updates);
    return { success: true };
  },
});

export const deleteSkill = mutation({
  args: {
    skillId: v.id("skills"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new ConvexError(
        createAppError("UNAUTHENTICATED", "Sign in to delete skills"),
      );
    }

    const skill = await ctx.db.get("skills", args.skillId);
    if (!skill) {
      throw new ConvexError(createAppError("NOT_FOUND", "Skill not found"));
    }

    if (skill.userId !== user._id) {
      throw new ConvexError(
        createAppError("FORBIDDEN", "You can only delete your own skills"),
      );
    }

    await ctx.db.delete("skills", args.skillId);
    return { success: true };
  },
});

export const getMySkills = query({
  args: {},
  returns: v.array(skillValidator),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

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

    const searchLower = args.searchTerm.toLowerCase().trim();
    const limit = args.limit ?? 10;

    const allSkills = await ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return allSkills
      .filter((skill) => {
        if (!searchLower) return true;
        const haystack = [
          skill.name,
          skill.description,
          skill.category,
          skill.freeformInstructions,
          skill.promptText,
          ...(skill.tags ?? []),
          ...Object.values(skill.sections ?? {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchLower);
      })
      .slice(0, limit);
  },
});

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

    return await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", args.name.toLowerCase()))
      .first();
  },
});

export const getSkillByNameInternal = internalQuery({
  args: {
    userId: v.string(),
    name: v.string(),
  },
  returns: v.union(v.null(), skillValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skills")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("name", args.name.toLowerCase()))
      .first();
  },
});
