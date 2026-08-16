import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "convex/storageReferenceLedgerOperations.ts"), "utf8");

describe("storage-reference ledger operations source boundary", () => {
  it("exports only the two internal control-plane functions", () => {
    expect(source.match(/export const \w+/g)).toEqual([
      "export const getStorageReferenceLedgerOperationStatus",
      "export const advanceStorageReferenceLedgerOperation",
    ]);
    expect(source).toContain("internalQuery({");
    expect(source).toContain("internalAction({");
    expect(source).not.toMatch(/\b(query|mutation|action)\(\{/);
  });

  it("pins ordering, page size, run keys, and one status dispatch", () => {
    expect(source).toContain("const PAGE_SIZE = 16");
    expect(source).toContain("/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/");
    expect(source.match(/ctx\.runQuery\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/\b(for|while)\s*\([^)]*ctx\.runMutation/);
    expect(source.match(/pageSize: PAGE_SIZE/g)).toHaveLength(2);
  });

  it("has exact safety boundaries", () => {
    const withoutRequiredSafetyName = source.replaceAll("physicalDeletionEnabled", "safetyField");
    expect(withoutRequiredSafetyName).not.toMatch(/ctx\.storage|scheduler|provider|orphan|delet|promot|repair|classif|reset/i);
    expect(source).not.toContain("ctx.db.delete");
    expect(source).not.toContain("v.any(");
    expect(source).not.toMatch(/:\s*any\b|as any\b/);
    expect(source).not.toContain("_generated/api");
    expect(source).toContain("makeFunctionReference");
    expect(source).toContain("authoritative: v.literal(false)");
    expect(source).toContain("physicalDeletionEnabled: v.literal(false)");
  });

  it("uses exact processed-page and completed-race-replay variants for both directions", () => {
    expect(source.match(/result: v\.literal\("processed_page"\)/g)).toHaveLength(2);
    expect(source.match(/result: v\.literal\("completed_race_replay"\)/g)).toHaveLength(2);
    expect(source).not.toMatch(/pagesCompleted: v\.optional|pageOrdinal: v\.optional|pageFingerprint: v\.optional|rowsScanned: v\.optional/);
  });
});
