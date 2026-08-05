import { describe, expect, it } from "vitest";
import {
  assertExpectedState,
  assertExpectedTransition,
  assertLeaseClaimable,
  assertLeaseFence,
  assertMayAutomaticallySubmit,
  assertMayTerminateWithoutReconciliation,
  assertSubmissionAcknowledgementAllowed,
  assertTransition,
  classifyCompletion,
  classifyEventReplay,
  classifyIdempotentCreate,
  completionIdentityKey,
  DURABLE_JOB_STATUSES,
  DURABLE_JOB_TRANSITIONS,
  mayAutomaticallySubmit,
  nextLeaseEpoch,
} from "../convex/durableJobPolicy";

describe("durable job policy", () => {
  it("enforces the complete transition matrix", () => {
    for (const from of DURABLE_JOB_STATUSES) {
      for (const to of DURABLE_JOB_STATUSES) {
        const allowed = (DURABLE_JOB_TRANSITIONS[from] as readonly (typeof DURABLE_JOB_STATUSES)[number][]).includes(to);
        if (allowed) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      }
    }
  });

  it("rejects stale status and revision before lifecycle evaluation", () => {
    expect(() => assertExpectedState({ status: "queued", revision: 2 }, { status: "processing", revision: 2 })).toThrow("STALE_STATUS");
    expect(() => assertExpectedState({ status: "queued", revision: 2 }, { status: "queued", revision: 1 })).toThrow("STALE_REVISION");
    expect(() => assertExpectedTransition({ status: "queued", revision: 2 }, { status: "queued", revision: 2 }, "submitting")).not.toThrow();
  });

  it.each(["completed", "failed", "cancelled", "expired"] as const)("makes terminal status %s immutable", (status) => {
    expect(() => assertTransition(status, "failed")).toThrow("TERMINAL_IMMUTABLE");
  });

  it("accepts exact event replay and rejects event identity collision", () => {
    const event = { jobKey: "job-1", eventType: "claimed", eventFingerprint: "worker-1:lease-1" };
    expect(classifyEventReplay(event, event)).toBe("replay");
    expect(() => classifyEventReplay(event, { ...event, eventFingerprint: "worker-2:lease-2" })).toThrow("EVENT_COLLISION");
  });

  it("accepts matching idempotency fingerprint and rejects collisions", () => {
    expect(classifyIdempotentCreate("sha256:a", "sha256:a")).toBe("replay");
    expect(() => classifyIdempotentCreate("sha256:a", "sha256:b")).toThrow("IDEMPOTENCY_COLLISION");
  });

  it("fences live leases by owner, token, epoch, and expiry", () => {
    const live = { owner: "worker-a", token: "lease_token_123456789", epoch: 3, expiresAt: 200 };
    expect(() => assertLeaseClaimable(live, "worker-a", live.token, 100)).not.toThrow();
    expect(() => assertLeaseClaimable(live, "worker-a", "lease_token_other_123", 100)).toThrow("LEASE_HELD");
    expect(() => assertLeaseClaimable(live, "worker-b", live.token, 100)).toThrow("LEASE_HELD");
    expect(() => assertLeaseFence(live, { token: live.token, epoch: 3 }, 100)).not.toThrow();
    expect(() => assertLeaseFence(live, { token: live.token, epoch: 2 }, 100)).toThrow("LEASE_FENCED");
    expect(() => assertLeaseFence(live, { token: live.token, epoch: 3 }, 200)).toThrow("LEASE_FENCED");
    expect(nextLeaseEpoch(live, "worker-a", live.token, 100)).toBe(3);
    expect(nextLeaseEpoch(live, "worker-b", "lease_token_new_123", 200)).toBe(4);
  });

  it("builds an unambiguous canonical completion identity", () => {
    const base = {
      generationKey: "gen_abcdefghijkl",
      provider: "openai",
      providerRequestId: "request_123",
      outputIdentityKind: "checksum" as const,
      outputIdentity: "a".repeat(64),
    };
    const key = completionIdentityKey(base);
    expect(completionIdentityKey(base)).toBe(key);
    expect(completionIdentityKey({ ...base, generationKey: "gen_otherabcdef" })).not.toBe(key);
    expect(completionIdentityKey({ ...base, provider: "google" })).not.toBe(key);
    expect(completionIdentityKey({ ...base, outputIdentityKind: "asset", outputIdentity: "asset_abcdefghijkl" })).not.toBe(key);
    expect(classifyCompletion(undefined, key)).toBe("new");
    expect(classifyCompletion(key, key)).toBe("replay");
    expect(() => classifyCompletion(key, `${key}x`)).toThrow("DUPLICATE_COMPLETION");
  });

  it("never automatically resubmits an ambiguous or acknowledged submission", () => {
    expect(mayAutomaticallySubmit("not_started")).toBe(true);
    for (const state of ["in_flight", "accepted", "ambiguous", "reconciled"] as const) {
      expect(mayAutomaticallySubmit(state)).toBe(false);
      expect(() => assertMayAutomaticallySubmit(state)).toThrow("AMBIGUOUS_SUBMISSION");
    }
  });

  it("requires reconciliation after ambiguity", () => {
    expect(() => assertSubmissionAcknowledgementAllowed("in_flight", "in_flight")).not.toThrow();
    expect(() => assertSubmissionAcknowledgementAllowed("ambiguous", "in_flight")).toThrow("SUBMISSION_NOT_IN_FLIGHT");
    expect(() => assertSubmissionAcknowledgementAllowed("in_flight", "ambiguous")).toThrow("SUBMISSION_NOT_IN_FLIGHT");
    expect(() => assertMayTerminateWithoutReconciliation("ambiguous")).toThrow("AMBIGUOUS_SUBMISSION");
    expect(() => assertMayTerminateWithoutReconciliation("accepted")).not.toThrow();
  });
});
