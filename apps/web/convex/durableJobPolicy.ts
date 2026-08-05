export const DURABLE_JOB_STATUSES = [
  "queued",
  "submitting",
  "processing",
  "persisting",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

export type DurableJobStatus = (typeof DURABLE_JOB_STATUSES)[number];
export type SubmissionState = "not_started" | "in_flight" | "accepted" | "ambiguous" | "reconciled";

export const TERMINAL_DURABLE_JOB_STATUSES = new Set<DurableJobStatus>([
  "completed",
  "failed",
  "cancelled",
  "expired",
]);

export const DURABLE_JOB_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["submitting", "failed", "cancelled", "expired"] as const),
  submitting: Object.freeze(["processing", "failed", "cancelled", "expired"] as const),
  processing: Object.freeze(["persisting", "failed", "cancelled", "expired"] as const),
  persisting: Object.freeze(["completed", "failed", "cancelled", "expired"] as const),
  completed: Object.freeze([] as const),
  failed: Object.freeze([] as const),
  cancelled: Object.freeze([] as const),
  expired: Object.freeze([] as const),
}) satisfies Readonly<Record<DurableJobStatus, readonly DurableJobStatus[]>>;

export type DurableJobPolicyCode =
  | "STALE_STATUS"
  | "STALE_REVISION"
  | "TERMINAL_IMMUTABLE"
  | "INVALID_TRANSITION"
  | "IDEMPOTENCY_COLLISION"
  | "LEASE_HELD"
  | "LEASE_FENCED"
  | "EVENT_COLLISION"
  | "AMBIGUOUS_SUBMISSION"
  | "SUBMISSION_NOT_IN_FLIGHT"
  | "DUPLICATE_COMPLETION";

export class DurableJobPolicyError extends Error {
  constructor(readonly code: DurableJobPolicyCode) {
    super(code);
    this.name = "DurableJobPolicyError";
  }
}

export function assertTransition(from: DurableJobStatus, to: DurableJobStatus): void {
  if (TERMINAL_DURABLE_JOB_STATUSES.has(from)) throw new DurableJobPolicyError("TERMINAL_IMMUTABLE");
  if (!(DURABLE_JOB_TRANSITIONS[from] as readonly DurableJobStatus[]).includes(to)) {
    throw new DurableJobPolicyError("INVALID_TRANSITION");
  }
}

export function assertExpectedState(
  observed: { status: DurableJobStatus; revision: number },
  expected: { status: DurableJobStatus; revision: number },
): void {
  if (observed.status !== expected.status) throw new DurableJobPolicyError("STALE_STATUS");
  if (observed.revision !== expected.revision) throw new DurableJobPolicyError("STALE_REVISION");
}

export function assertExpectedTransition(
  observed: { status: DurableJobStatus; revision: number },
  expected: { status: DurableJobStatus; revision: number },
  target: DurableJobStatus,
): void {
  assertExpectedState(observed, expected);
  assertTransition(observed.status, target);
}

export function classifyIdempotentCreate(existingFingerprint: string, requestedFingerprint: string): "replay" {
  if (existingFingerprint !== requestedFingerprint) throw new DurableJobPolicyError("IDEMPOTENCY_COLLISION");
  return "replay";
}

export function classifyEventReplay(
  existing: { jobKey: string; eventType: string; eventFingerprint: string },
  requested: { jobKey: string; eventType: string; eventFingerprint: string },
): "replay" {
  if (
    existing.jobKey !== requested.jobKey ||
    existing.eventType !== requested.eventType ||
    existing.eventFingerprint !== requested.eventFingerprint
  ) {
    throw new DurableJobPolicyError("EVENT_COLLISION");
  }
  return "replay";
}

export interface LeaseFence {
  owner?: string;
  token?: string;
  epoch: number;
  expiresAt?: number;
}

export function assertLeaseClaimable(lease: LeaseFence, claimant: string, token: string, now: number): void {
  const live = Boolean(lease.owner && lease.token && (lease.expiresAt ?? 0) > now);
  if (live && (lease.owner !== claimant || lease.token !== token)) throw new DurableJobPolicyError("LEASE_HELD");
}

export function nextLeaseEpoch(lease: LeaseFence, claimant: string, token: string, now: number): number {
  const sameLiveLease = lease.owner === claimant && lease.token === token && (lease.expiresAt ?? 0) > now;
  return sameLiveLease ? lease.epoch : lease.epoch + 1;
}

export function assertLeaseFence(
  lease: LeaseFence,
  expected: { token: string; epoch: number },
  now: number,
): void {
  if (
    !lease.owner ||
    lease.token !== expected.token ||
    lease.epoch !== expected.epoch ||
    (lease.expiresAt ?? 0) <= now
  ) {
    throw new DurableJobPolicyError("LEASE_FENCED");
  }
}

export function mayAutomaticallySubmit(state: SubmissionState): boolean {
  return state === "not_started";
}

export function assertMayAutomaticallySubmit(state: SubmissionState): void {
  if (!mayAutomaticallySubmit(state)) throw new DurableJobPolicyError("AMBIGUOUS_SUBMISSION");
}

export function assertSubmissionAcknowledgementAllowed(jobState: SubmissionState, attemptState: SubmissionState): void {
  if (jobState !== "in_flight" || attemptState !== "in_flight") {
    throw new DurableJobPolicyError("SUBMISSION_NOT_IN_FLIGHT");
  }
}

export function assertMayTerminateWithoutReconciliation(state: SubmissionState): void {
  if (state === "ambiguous") throw new DurableJobPolicyError("AMBIGUOUS_SUBMISSION");
}

export function completionIdentityKey(identity: {
  generationKey: string;
  provider: string;
  providerRequestId: string;
  outputIdentityKind: "checksum" | "asset";
  outputIdentity: string;
}): string {
  return JSON.stringify([
    identity.generationKey,
    identity.provider,
    identity.providerRequestId,
    identity.outputIdentityKind,
    identity.outputIdentity,
  ]);
}

export function classifyCompletion(existingCompletionIdentity: string | undefined, requestedCompletionIdentity: string): "new" | "replay" {
  if (!existingCompletionIdentity) return "new";
  if (existingCompletionIdentity === requestedCompletionIdentity) return "replay";
  throw new DurableJobPolicyError("DUPLICATE_COMPLETION");
}

const FORBIDDEN_ERROR_CONTENT = /(?:https?:\/\/|\b(?:api[-_ ]?key|authorization|bearer|secret|credential|token)\b)/i;
const ERROR_CATEGORIES = new Set(["authentication", "billing-access", "validation", "rate-limit", "moderation", "provider-unavailable", "timeout", "cancelled", "unknown"]);

export function assertSafePublicError(error: { category: string; code: string; message: string; retryable: boolean; correlationId: string }): void {
  if (
    !ERROR_CATEGORIES.has(error.category) ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(error.code) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(error.correlationId) ||
    error.message.length < 1 ||
    error.message.length > 500 ||
    FORBIDDEN_ERROR_CONTENT.test(error.message)
  ) {
    throw new Error("UNSAFE_PUBLIC_ERROR");
  }
}

export function assertBoundedJsonObject(value: string, maxLength = 16_384): void {
  if (value.length < 2 || value.length > maxLength) throw new Error("INVALID_REQUEST_METADATA");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("INVALID_REQUEST_METADATA");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("INVALID_REQUEST_METADATA");
  const forbiddenName = /(?:secret|credential|authorization|token|api.?key|provider.?key|transport.?url|native.?payload)/i;
  const visit = (input: unknown, depth: number): void => {
    if (depth > 8) throw new Error("INVALID_REQUEST_METADATA");
    if (typeof input === "string" && (input.length > 4096 || /(?:https?:\/\/|wss?:\/\/)/i.test(input))) throw new Error("INVALID_REQUEST_METADATA");
    if (Array.isArray(input)) {
      if (input.length > 64) throw new Error("INVALID_REQUEST_METADATA");
      for (const item of input) visit(item, depth + 1);
    } else if (input && typeof input === "object") {
      const entries = Object.entries(input);
      if (entries.length > 64) throw new Error("INVALID_REQUEST_METADATA");
      for (const [name, item] of entries) {
        if (forbiddenName.test(name)) throw new Error("INVALID_REQUEST_METADATA");
        visit(item, depth + 1);
      }
    }
  };
  visit(parsed, 0);
}
