import { z } from "zod";

import { EventIdSchema, GenerationAttemptIdSchema, GenerationIdSchema } from "./contracts.js";
import { GenerationStatusSchema, TERMINAL_GENERATION_STATUSES, type GenerationStatus } from "./vocabulary.js";

const FAILURE_TRANSITIONS = ["failed", "cancelled", "expired"] as const;

export const ALLOWED_GENERATION_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["submitting", ...FAILURE_TRANSITIONS]),
  submitting: Object.freeze(["processing", ...FAILURE_TRANSITIONS]),
  processing: Object.freeze(["persisting", ...FAILURE_TRANSITIONS]),
  persisting: Object.freeze(["completed", ...FAILURE_TRANSITIONS]),
  completed: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
  expired: Object.freeze([]),
} satisfies Readonly<Record<GenerationStatus, readonly GenerationStatus[]>>);

export const GenerationTransitionCommandSchema = z
  .object({
    generationId: GenerationIdSchema,
    expectedCurrentStatus: GenerationStatusSchema,
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    targetStatus: GenerationStatusSchema,
    eventId: EventIdSchema,
    occurredAt: z.string().datetime(),
    attemptId: GenerationAttemptIdSchema.optional(),
  })
  .strict();
export type GenerationTransitionCommand = z.infer<typeof GenerationTransitionCommandSchema>;

export const ObservedGenerationSnapshotSchema = z
  .object({ generationId: GenerationIdSchema, status: GenerationStatusSchema, revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
  .strict();
export type ObservedGenerationSnapshot = z.infer<typeof ObservedGenerationSnapshotSchema>;

export class GenerationTransitionError extends Error {
  constructor(readonly from: GenerationStatus, readonly to: GenerationStatus) {
    super(`Illegal generation status transition: ${from} -> ${to}`);
    this.name = "GenerationTransitionError";
  }
}

export class StaleGenerationTransitionError extends Error {
  constructor(
    readonly reason: "generation" | "status" | "revision",
    readonly expected: string | number,
    readonly observed: string | number,
  ) {
    super(`Stale generation transition (${reason}): expected ${expected}, observed ${observed}`);
    this.name = "StaleGenerationTransitionError";
  }
}

export function isTerminalGenerationStatus(status: GenerationStatus): boolean {
  return (TERMINAL_GENERATION_STATUSES as readonly GenerationStatus[]).includes(status);
}

export function canTransitionGenerationStatus(from: GenerationStatus, to: GenerationStatus): boolean {
  return ALLOWED_GENERATION_TRANSITIONS[from].includes(to as never);
}

export function assertGenerationStatusTransition(from: GenerationStatus, to: GenerationStatus): void {
  if (!canTransitionGenerationStatus(from, to)) throw new GenerationTransitionError(from, to);
}

/** Validates optimistic-lock preconditions before checking the lifecycle edge. */
export function assertGenerationTransitionPrecondition(command: GenerationTransitionCommand, observed: ObservedGenerationSnapshot): void {
  const parsedCommand = GenerationTransitionCommandSchema.parse(command);
  const parsedObserved = ObservedGenerationSnapshotSchema.parse(observed);
  if (parsedCommand.generationId !== parsedObserved.generationId) {
    throw new StaleGenerationTransitionError("generation", parsedCommand.generationId, parsedObserved.generationId);
  }
  if (parsedCommand.expectedCurrentStatus !== parsedObserved.status) {
    throw new StaleGenerationTransitionError("status", parsedCommand.expectedCurrentStatus, parsedObserved.status);
  }
  if (parsedCommand.expectedRevision !== parsedObserved.revision) {
    throw new StaleGenerationTransitionError("revision", parsedCommand.expectedRevision, parsedObserved.revision);
  }
  assertGenerationStatusTransition(parsedObserved.status, parsedCommand.targetStatus);
}
