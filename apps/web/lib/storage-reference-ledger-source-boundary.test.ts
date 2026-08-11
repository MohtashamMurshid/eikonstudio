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
      expect(contract).toContain(`${source}: [`);
    }
    const mappingBody = contract.split("STORAGE_REFERENCE_SOURCE_FIELDS = {")[1]?.split("} as const")[0] ?? "";
    expect(mappingBody.match(/"[^"]+"/g)).toHaveLength(11);
  });

  it("defines additive indexed ledger and readiness tables", () => {
    expect(schema).toContain("storageReferenceLedger: defineTable");
    expect(schema).toContain('.index("by_reference_key", ["referenceKey"])');
    expect(schema).toContain('.index("by_storage", ["storageId"])');
    expect(schema).toContain('.index("by_source_document", ["source", "documentId"])');
    expect(schema).toContain("storageReferenceLedgerState: defineTable");
    expect(schema).toContain('.index("by_state_key", ["stateKey"])');
  });

  it("deduplicates and bounds atomic document replacement", () => {
    expect(ledger).toContain("const MAX_REFERENCES_PER_DOCUMENT = 64;");
    expect(ledger).toContain("const desired = new Map");
    expect(ledger).toContain("JSON.stringify([source, documentId, field, storageId])");
    expect(ledger).toContain(".take(MAX_REFERENCES_PER_DOCUMENT + 1)");
    expect(ledger).toContain("INVALID_STORAGE_REFERENCE_LEDGER_FIELD");
    expect(ledger).toContain("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
  });

  it("keeps readiness observability internal and explicitly non-authoritative", () => {
    expect(ledger).toContain("export const getStorageReferenceLedgerReadiness = internalQuery");
    expect(ledger).toContain("authoritative: v.literal(false)");
    expect(ledger).not.toMatch(/export const \w+ = (mutation|internalMutation|action|internalAction)\(/);
  });

  it("dual-writes every production reference writer", () => {
    expect(writers.generations.match(/replaceDocumentStorageReferences\(/g)).toHaveLength(4);
    expect(writers.gallery.match(/replaceDocumentStorageReferences\(/g)).toHaveLength(1);
    expect(writers.characters.match(/replaceDocumentStorageReferences\(/g)).toHaveLength(2);
    expect(writers.durableOutputs.match(/replaceDocumentStorageReferences\(/g)).toHaveLength(1);
    expect(writers.videos.match(/replaceDocumentStorageReferences\(/g)).toHaveLength(1);
  });

  it("removes ledger rows on every physical application-row deletion", () => {
    expect(writers.generations).toContain('removeDocumentStorageReferences(ctx, "generations"');
    expect(writers.gallery.match(/removeDocumentStorageReferences\(ctx, "gallery"/g)).toHaveLength(2);
    expect(writers.characters).toContain('removeDocumentStorageReferences(ctx, "characters"');
    expect(writers.videos).toContain('removeDocumentStorageReferences(ctx, "video_generations"');
  });
});
