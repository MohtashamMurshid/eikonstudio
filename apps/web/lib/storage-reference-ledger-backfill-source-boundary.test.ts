import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "convex");
const backfill = readFileSync(resolve(root, "storageReferenceLedgerBackfill.ts"), "utf8");
const ledger = readFileSync(resolve(root, "storageReferenceLedger.ts"), "utf8");
const schema = readFileSync(resolve(root, "schema.ts"), "utf8");

describe("storage-reference ledger backfill source boundary", () => {
  it("is internal-only, bounded, checkpoint-owned, and source-scoped", () => {
    expect(backfill).toContain("const MAX_BACKFILL_PAGE_ROWS = 16");
    expect(backfill).toContain("export const runStorageReferenceLedgerBackfillPage = internalMutation");
    expect(backfill).toContain("export const getStorageReferenceLedgerBackfillStatus = internalQuery");
    expect(backfill).not.toMatch(/export const \w+ = (mutation|query|action)\(/);
    expect(backfill).not.toMatch(/args:\s*\{[^}]*cursor:/);
    expect(backfill).toContain("checkpoint.cursor ?? null");
    expect(backfill).toContain("latestCommittedDocument");
    expect(backfill).toContain("cutoffCreationTime");
    expect(backfill).toContain("lastDocumentId");
    expect(backfill).not.toContain("resolveDocumentAnchor");
    expect(backfill).toContain('q.lte(q.field("_creationTime"), cutoffAt)');
    expect(backfill.match(/case "(generations|gallery|characters|durable_outputs|video_generations)"/g)).toHaveLength(10);
  });

  it("preflights a whole page before any historical occurrence write", () => {
    const preflight = backfill.indexOf("for (const document of page.documents)");
    const apply = backfill.indexOf("for (const document of prepared)");
    expect(preflight).toBeGreaterThan(-1);
    expect(apply).toBeGreaterThan(preflight);
    expect(ledger).toContain("preflightBackfillDocumentStorageReferences");
    expect(ledger).toContain("applyBackfilledDocumentStorageReferences");
    expect(ledger).toContain("STORAGE_REFERENCE_LEDGER_BACKFILL_CONFLICT");
    expect(ledger).toContain('origin: "historical_backfill_v1"');
  });

  it("stores one checkpoint per source without adding authority or deletion capability", () => {
    expect(schema).toContain("storageReferenceLedgerBackfillCheckpoints: defineTable");
    expect(schema).toContain('.index("by_checkpoint_key", ["checkpointKey"])');
    expect(schema).toContain('.index("by_source_version", ["source", "version"])');
    expect(schema).toContain('v.literal("historical_backfill_v1")');
    expect(backfill).toContain("authoritative: v.literal(false)");
    expect(backfill).toContain("physicalDeletionEnabled: v.literal(false)");
    expect(backfill).not.toContain("ctx.storage.delete");
    expect(backfill).not.toMatch(/orphan|candidateForDeletion|safeToDelete/i);
  });
});
