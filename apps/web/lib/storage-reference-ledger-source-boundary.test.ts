import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "convex");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const ledger = read("storageReferenceLedger.ts");
const contract = read("storageReferenceContract.ts");
const schema = read("schema.ts");
const writers = {
  generations: read("generations.ts"),
  gallery: read("gallery.ts"),
  characters: read("characters.ts"),
  durableOutputs: read("durableJobs.ts"),
  videos: read("videoGenerations.ts"),
};

describe("storage reference ledger source boundary", () => {
  it("shares exactly five sources and 11 typed field occurrences with reconciliation", () => {
    for (const source of ["generations", "gallery", "characters", "durable_outputs", "video_generations"]) {
      expect(contract).toContain(`${source}: {`);
    }
    const mappingBody = contract.split("STORAGE_REFERENCE_SOURCE_FIELD_LIMITS = {")[1]?.split("} as const")[0] ?? "";
    expect(mappingBody.match(/\w+: \d/g)).toHaveLength(11);
  });

  it("defines additive indexed ledger and readiness tables", () => {
    expect(schema).toContain("storageReferenceLedger: defineTable");
    expect(schema).toContain('.index("by_reference_key", ["referenceKey"])');
    expect(schema).toContain('.index("by_storage", ["storageId"])');
    expect(schema).toContain('.index("by_source_document", ["source", "documentId"])');
    expect(schema).toContain('.index("by_source_document_field", ["source", "documentId", "field"])');
    expect(schema).toContain('origin: v.literal("transactional_dual_write_v1")');
    expect(schema).toContain("storageReferenceLedgerState: defineTable");
    expect(schema).toContain('.index("by_state_key", ["stateKey"])');
  });

  it("preserves occurrences and bounds insert, field replacement, and removal", () => {
    expect(contract).toContain("referenceImageIds: 4");
    expect(contract).toContain("referenceImageStorageIds: 3");
    expect(ledger).toContain("JSON.stringify([source, documentId, field, position])");
    expect(ledger).toContain(".take(limit + 1)");
    expect(ledger).toContain("INVALID_STORAGE_REFERENCE_LEDGER_FIELD");
    expect(ledger).toContain("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
    expect(ledger).toContain("STORAGE_REFERENCE_LEDGER_CORRUPT");
    expect(ledger).toContain("position !== index");
  });

  it("keeps readiness observability internal and explicitly non-authoritative", () => {
    expect(ledger).toContain("export const getStorageReferenceLedgerReadiness = internalQuery");
    expect(ledger).toContain("authoritative: v.literal(false)");
    expect(ledger).toContain("physicalDeletionEnabled: v.literal(false)");
    expect(schema).toContain('status: v.literal("collecting")');
    expect(schema).not.toContain('v.literal("verified")');
    expect(ledger).not.toMatch(/export const \w+ = (mutation|internalMutation|action|internalAction)\(/);
  });

  it("dual-writes every production reference writer", () => {
    expect(writers.generations.match(/insertDocumentStorageReferences\(/g)).toHaveLength(2);
    expect(writers.generations.match(/replaceStorageFieldReferences\(/g)).toHaveLength(4);
    expect(writers.gallery.match(/insertDocumentStorageReferences\(/g)).toHaveLength(1);
    expect(writers.characters.match(/insertDocumentStorageReferences\(/g)).toHaveLength(1);
    expect(writers.characters.match(/replaceStorageFieldReferences\(/g)).toHaveLength(1);
    expect(writers.durableOutputs.match(/insertDocumentStorageReferences\(/g)).toHaveLength(1);
    expect(writers.videos.match(/insertDocumentStorageReferences\(/g)).toHaveLength(1);
  });

  it("removes ledger rows on every physical application-row deletion", () => {
    expect(writers.generations).toContain('removeDocumentStorageReferences(ctx, "generations"');
    expect(writers.gallery.match(/removeDocumentStorageReferences\(ctx, "gallery"/g)).toHaveLength(2);
    expect(writers.characters).toContain('removeDocumentStorageReferences(ctx, "characters"');
    expect(writers.videos).toContain('removeDocumentStorageReferences(ctx, "video_generations"');
  });
});
