import { describe, expect, it } from "vitest";

import {
  ALLOWED_GENERATION_TRANSITIONS,
  GENERATION_STATUSES,
  GenerationTransitionCommandSchema,
  GenerationTransitionError,
  ObservedGenerationSnapshotSchema,
  StaleGenerationTransitionError,
  assertGenerationStatusTransition,
  assertGenerationTransitionPrecondition,
  canTransitionGenerationStatus,
  isTerminalGenerationStatus,
  type GenerationStatus,
} from "../src/index.js";

const mainline: readonly [GenerationStatus, GenerationStatus][] = [
  ["queued", "submitting"],
  ["submitting", "processing"],
  ["processing", "persisting"],
  ["persisting", "completed"],
];
const active = ["queued", "submitting", "processing", "persisting"] as const;
const terminal = ["completed", "failed", "cancelled", "expired"] as const;

describe("generation lifecycle", () => {
  it.each(mainline)("permits mainline transition %s -> %s", (from, to) => {
    expect(canTransitionGenerationStatus(from, to)).toBe(true);
    expect(() => assertGenerationStatusTransition(from, to)).not.toThrow();
  });

  it.each(active)("permits every terminal alternative from %s", (from) => {
    for (const to of ["failed", "cancelled", "expired"] as const) {
      expect(canTransitionGenerationStatus(from, to)).toBe(true);
    }
  });

  it.each(terminal)("rejects every exit from terminal state %s", (from) => {
    expect(isTerminalGenerationStatus(from)).toBe(true);
    expect(ALLOWED_GENERATION_TRANSITIONS[from]).toEqual([]);
    for (const to of GENERATION_STATUSES) {
      expect(canTransitionGenerationStatus(from, to)).toBe(false);
      expect(() => assertGenerationStatusTransition(from, to)).toThrow(GenerationTransitionError);
    }
  });

  it("rejects every transition outside the complete allowed matrix", () => {
    const legal = new Set([
      "queued:submitting",
      "submitting:processing",
      "processing:persisting",
      "persisting:completed",
      ...active.flatMap((from) => ["failed", "cancelled", "expired"].map((to) => `${from}:${to}`)),
    ]);
    for (const from of GENERATION_STATUSES) {
      for (const to of GENERATION_STATUSES) {
        expect(canTransitionGenerationStatus(from, to)).toBe(legal.has(`${from}:${to}`));
      }
    }
  });

  it("rejects self, skipped, and reverse transitions", () => {
    const illegal: readonly [GenerationStatus, GenerationStatus][] = [
      ["queued", "queued"],
      ["queued", "processing"],
      ["submitting", "completed"],
      ["processing", "submitting"],
      ["persisting", "processing"],
    ];
    for (const [from, to] of illegal) {
      expect(canTransitionGenerationStatus(from, to)).toBe(false);
      expect(() => assertGenerationStatusTransition(from, to)).toThrow(`${from} -> ${to}`);
    }
  });

  it("validates both expected status and expected revision against the observed snapshot", () => {
    const command = GenerationTransitionCommandSchema.parse({
      generationId: "gen_123456789012",
      expectedCurrentStatus: "processing",
      expectedRevision: 4,
      targetStatus: "persisting",
      eventId: "event_123456789012",
      occurredAt: "2026-08-02T12:00:00.000Z",
      attemptId: "attempt_123456789012",
    });
    const observed = ObservedGenerationSnapshotSchema.parse({ generationId: "gen_123456789012", status: "processing", revision: 4 });
    expect(() => assertGenerationTransitionPrecondition(command, observed)).not.toThrow();
    expect(() => assertGenerationTransitionPrecondition(command, { ...observed, revision: 5 })).toThrow(StaleGenerationTransitionError);
    expect(() => assertGenerationTransitionPrecondition(command, { ...observed, status: "submitting" })).toThrow(/status/);
  });

  it.each(terminal)("rejects transition commands out of terminal state %s", (status) => {
    const command = GenerationTransitionCommandSchema.parse({
      generationId: "gen_123456789012",
      expectedCurrentStatus: status,
      expectedRevision: 7,
      targetStatus: "failed",
      eventId: "event_123456789012",
      occurredAt: "2026-08-02T12:00:00.000Z",
    });
    const observed = ObservedGenerationSnapshotSchema.parse({ generationId: "gen_123456789012", status, revision: 7 });
    expect(() => assertGenerationTransitionPrecondition(command, observed)).toThrow(GenerationTransitionError);
  });
});
