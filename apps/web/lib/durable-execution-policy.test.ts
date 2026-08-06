import { describe, expect, it } from "vitest";
import {
  durableExecutionDecision,
  durableImageKeys,
  providerFailureDisposition,
  requireProviderRequestIdentity,
} from "../convex/durableExecutionPolicy";

describe("durable execution policy", () => {
  it("submits only a pristine queued attempt", () => {
    expect(durableExecutionDecision({ status: "queued", submissionState: "not_started", durableOutputCount: 0 })).toBe("submit");
    expect(durableExecutionDecision({ status: "queued", submissionState: "in_flight", durableOutputCount: 0 })).toBe("no-op");
  });

  it("never resubmits an in-flight, accepted, or ambiguous attempt", () => {
    expect(durableExecutionDecision({ status: "submitting", submissionState: "in_flight", durableOutputCount: 0 })).toBe("mark-ambiguous");
    expect(durableExecutionDecision({ status: "submitting", submissionState: "ambiguous", durableOutputCount: 0 })).toBe("no-op");
    expect(durableExecutionDecision({ status: "processing", submissionState: "accepted", durableOutputCount: 0 })).toBe("fail-without-resubmit");
  });

  it("recovers only from already durable output rows", () => {
    expect(durableExecutionDecision({ status: "persisting", submissionState: "accepted", durableOutputCount: 0 })).toBe("fail-without-resubmit");
    expect(durableExecutionDecision({ status: "persisting", submissionState: "accepted", durableOutputCount: 1 })).toBe("finalize-durable-output");
    expect(durableExecutionDecision({ status: "completed", submissionState: "accepted", durableOutputCount: 1 })).toBe("mirror-completed");
  });

  it.each(["failed", "cancelled", "expired"] as const)("does nothing for terminal status %s", (status) => {
    expect(durableExecutionDecision({ status, submissionState: "reconciled", durableOutputCount: 0 })).toBe("no-op");
  });

  it("treats only explicit non-chargeable HTTP rejections as definitive", () => {
    for (const status of [400, 401, 403, 404, 422]) expect(providerFailureDisposition(status)).toBe("definitive");
    for (const status of [undefined, 408, 409, 429, 500, 502, 503]) expect(providerFailureDisposition(status)).toBe("ambiguous");
  });

  it("requires an opaque provider-native request identity", () => {
    expect(requireProviderRequestIdentity("req_12345678")).toBe("req_12345678");
    for (const identity of [undefined, null, "", "contains spaces", "https://provider.example/request/1"]) {
      expect(() => requireProviderRequestIdentity(identity)).toThrow("PROVIDER_REQUEST_ID_REQUIRED");
    }
  });

  it("derives stable non-secret durable keys", () => {
    const first = durableImageKeys("generation_123", "request_12345678");
    const replay = durableImageKeys("generation_123", "request_12345678");
    expect(replay).toEqual(first);
    expect(first).toEqual({
      generationKey: "image-generation:generation_123",
      jobKey: "image-job:generation_123",
      eventId: "image-created:generation_123",
      requestFingerprint: "image-request:request_12345678",
    });
  });

  it("rejects invalid output counts", () => {
    for (const durableOutputCount of [-1, 1.5, 17]) {
      expect(() =>
        durableExecutionDecision({ status: "persisting", submissionState: "accepted", durableOutputCount }),
      ).toThrow("INVALID_DURABLE_OUTPUT_COUNT");
    }
  });

  it("rejects invalid durable key inputs", () => {
    expect(() => durableImageKeys("", "request_12345678")).toThrow("INVALID_GENERATION_ID");
    expect(() => durableImageKeys("g".repeat(129), "request_12345678")).toThrow("INVALID_GENERATION_ID");
    expect(() => durableImageKeys("generation_123", "short")).toThrow("INVALID_IDEMPOTENCY_KEY");
  });
});
