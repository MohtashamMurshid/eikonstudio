import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(webRoot, "convex/storageReconciliation.ts"), "utf8");
const schema = readFileSync(resolve(webRoot, "convex/schema.ts"), "utf8");
const contract = readFileSync(resolve(webRoot, "convex/storageReferenceContract.ts"), "utf8");
const generatedApi = readFileSync(resolve(webRoot, "convex/_generated/api.d.ts"), "utf8");

describe("storage reconciliation source boundary", () => {
  it("keeps both inventory functions internal-only", () => {
    expect(source.match(/export const \w+ = internalQuery\(/g)).toHaveLength(2);
    expect(source).not.toMatch(/export const \w+ = (query|mutation|action|internalMutation|internalAction)\(/);
    expect(generatedApi).toContain('import type * as storageReconciliation from "../storageReconciliation.js";');
  });

  it("is strictly read-only and never schedules or resolves URLs", () => {
    for (const forbidden of [
      "ctx.storage.delete",
      "ctx.storage.getUrl",
      "ctx.db.insert",
      "ctx.db.patch",
      "ctx.db.delete",
      "ctx.scheduler",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("covers every schema storage-reference field, including arrays", () => {
    const expectedFields = [
      "imageStorageId",
      "thumbnailStorageId",
      "referenceImageIds",
      "avatarStorageId",
      "storageId",
      "videoStorageId",
      "referenceImageStorageIds",
    ];
    const schemaFields = [...schema.matchAll(/^\s*(\w+):[^\n]*v\.id\("_storage"\)/gm)]
      .map((match) => match[1]);
    expect([...new Set(schemaFields)].sort()).toEqual([...expectedFields].sort());
    for (const field of expectedFields) {
      expect(contract).toContain(`v.literal("${field}")`);
    }
    for (const table of [
      'query("generations")',
      'query("gallery")',
      'query("characters")',
      'query("durableGenerationOutputs")',
      'query("videoGenerations")',
    ]) {
      expect(source).toContain(table);
    }
  });

  it("bounds source rows, preserves full arrays, and returns Convex split signals", () => {
    expect(source).toContain("const MAX_PAGE_ROWS = 100;");
    expect(source).toContain("INVALID_STORAGE_INVENTORY_PAGE_SIZE");
    expect(source).toContain("paginationResultValidator(referenceDocumentValidator)");
    expect(source).toContain("paginationResultValidator(storageObjectValidator)");
    expect(source).toContain("storageIds: [...storageIds]");
    expect(source).not.toMatch(/\.slice\(|\.splice\(|MAX_ARRAY_REFERENCES/);
    expect(source).not.toContain(".collect()");
    expect(source.match(/\.paginate\(args\.paginationOpts\)/g)).toHaveLength(6);
  });

  it("uses server time and reports age eligibility without an orphan verdict", () => {
    expect(source).toContain("const now = Date.now();");
    expect(source).toContain("const latestReviewBefore = Math.max(0, now - args.minimumAgeMs);");
    expect(source).toContain("const reviewBefore = args.reviewBefore ?? latestReviewBefore;");
    expect(source).toContain("args.reviewBefore > latestReviewBefore");
    expect(source).toContain("eligibleForReview: row._creationTime <= reviewBefore");
    expect(source).not.toMatch(/orphan\s*:/i);
    expect(source).not.toContain("isOrphan");
  });

  it("returns only opaque identifiers and minimal storage metadata", () => {
    expect(source).toContain("storageId: row._id");
    expect(source).toContain("createdAt: row._creationTime");
    expect(source).toContain("byteSize: row.size");
    for (const forbidden of ["sha256:", "ownerId:", "prompt:", "filename:", "url:", "providerRequestId:"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
