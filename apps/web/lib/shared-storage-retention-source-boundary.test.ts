import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(process.cwd());
const convexRoot = resolve(webRoot, "convex");

describe("shared storage retention source boundary", () => {
  it("contains no physical storage deletion before complete reference-ledger reconciliation", () => {
    const convexFiles = readdirSync(convexRoot, { recursive: true })
      .filter((relativePath): relativePath is string => typeof relativePath === "string" && relativePath.endsWith(".ts"));
    expect(convexFiles.length).toBeGreaterThan(0);
    for (const relativePath of convexFiles) {
      const source = readFileSync(resolve(convexRoot, relativePath), "utf8");
      expect(source, relativePath).not.toContain("ctx.storage.delete");
    }
  });

  it("keeps row deletion explicit on every user-facing surface", () => {
    const generations = readFileSync(resolve(webRoot, "convex/generations.ts"), "utf8");
    const videos = readFileSync(resolve(webRoot, "convex/videoGenerations.ts"), "utf8");
    const gallery = readFileSync(resolve(webRoot, "convex/gallery.ts"), "utf8");
    const characters = readFileSync(resolve(webRoot, "convex/characters.ts"), "utf8");
    expect(generations).toContain("await ctx.db.delete(args.generationId)");
    expect(videos).toContain("await ctx.db.delete(args.videoGenerationId)");
    expect(gallery).toContain("await ctx.db.delete(args.imageId)");
    expect(gallery).toMatch(
      /removeDocumentStorageReferences\(ctx, "gallery", img\._id[\s\S]*?await ctx\.db\.delete\(img\._id\)/,
    );
    expect(gallery).toContain(".take(5)");
    expect(gallery).toContain("images.length > 4");
    expect(characters).toContain("await ctx.db.delete(args.characterId)");
  });
});
