import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "convex");
const verification = readFileSync(
  resolve(root, "storageReferenceLedgerVerification.ts"),
  "utf8",
);
const schema = readFileSync(resolve(root, "schema.ts"), "utf8");

describe("storage-reference verification source boundary", () => {
  it("has all five sources, 11 fields, ten checkpoints, and a 16-row ceiling", () => {
    expect(verification).toContain("const MAX_VERIFICATION_PAGE_ROWS = 16");
    for (const source of [
      "generations",
      "gallery",
      "characters",
      "durable_outputs",
      "video_generations",
    ]) {
      expect(verification).toContain(`"${source}"`);
    }
    for (const field of [
      "imageStorageId",
      "thumbnailStorageId",
      "referenceImageIds",
      "avatarStorageId",
      "storageId",
      "videoStorageId",
      "referenceImageStorageIds",
    ])
      expect(verification).toContain(`"${field}"`);
    expect(verification).toContain(
      'const DIRECTIONS = ["source_to_ledger", "ledger_to_source"]',
    );
    expect(verification).not.toMatch(/args:\s*\{[^}]*cursor:/);
    expect(verification).not.toContain(".collect()");
  });

  it("is internal-only, provider-free, scheduler-free, and incapable of deletion or promotion", () => {
    expect(verification.match(/internalMutation\(\{/g)).toHaveLength(4);
    expect(
      verification.match(/export const \w+ = internalQuery/g),
    ).toHaveLength(1);
    expect(verification).not.toMatch(
      /export const \w+ = (mutation|query|action|internalAction)\(/,
    );
    expect(verification).not.toMatch(
      /ctx\.storage|scheduler|provider|orphan|candidateForDeletion|safeToDelete|promot|reset/i,
    );
    expect(verification).not.toContain("ctx.db.delete");
    expect(verification).toContain("authoritative: false");
    expect(verification).toContain("physicalDeletionEnabled: false");
  });

  it("uses immutable scopes and append-only evidence, commitments, failures, and passed attestations", () => {
    for (const table of [
      "Scopes",
      "EvidencePages",
      "FinalizationCommitments",
      "Failures",
      "Attestations",
    ])
      expect(schema).toContain(
        `storageReferenceLedgerVerification${table}: defineTable`,
      );
    expect(verification).not.toMatch(/ctx\.db\.patch\(sc/);
    expect(verification).not.toMatch(
      /ctx\.db\.patch\([^,]*(Evidence|Commitment|Failure|Attestation)/,
    );
    expect(verification).not.toMatch(
      /ctx\.db\.delete\([^)]*(Evidence|Commitment)/,
    );
    expect(schema).toContain('.index("by_batch_key", ["batchKey"])');
    expect(schema).toContain(
      '.index("by_run_batch", ["runId", "batchOrdinal"])',
    );
    expect(schema).toContain('.index("by_source_creation", ["source"])');
    expect(schema).toContain('result: v.literal("passed")');
    expect(
      schema.match(/authoritative: v\.literal\(false\)/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      schema.match(/physicalDeletionEnabled: v\.literal\(false\)/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("pins pure SHA-256 and canonical ordered-array manifests", () => {
    expect(verification).toContain("function sha256(value: string)");
    expect(verification).toContain("new TextEncoder().encode(value)");
    expect(verification).toContain("sha256(JSON.stringify(value))");
    expect(verification).toContain("VERIFICATION_EVIDENCE_TAMPERED");
    expect(verification).toContain("buildCanonicalVerificationManifest");
  });

  it("states bounded non-point-in-time observation semantics", () => {
    expect(verification).toContain("const MAX_FINALIZATION_EVIDENCE_PAGES = 16");
    expect(verification).toContain("not a global point-in-time snapshot");
    expect(verification).toContain('`${run._id}:observed_pairs_passed`');
    expect(schema).toContain(
      'attestationKind: v.literal("observed_pairs_passed")',
    );
  });
});
