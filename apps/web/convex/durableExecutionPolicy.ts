import type { DurableJobStatus, SubmissionState } from "./durableJobPolicy";

export type DurableExecutionDecision =
  | "submit"
  | "mark-ambiguous"
  | "finalize-durable-output"
  | "mirror-completed"
  | "fail-without-resubmit"
  | "no-op";

export function durableExecutionDecision(input: {
  status: DurableJobStatus;
  submissionState: SubmissionState;
  durableOutputCount: number;
}): DurableExecutionDecision {
  if (!Number.isInteger(input.durableOutputCount) || input.durableOutputCount < 0 || input.durableOutputCount > 16) {
    throw new Error("INVALID_DURABLE_OUTPUT_COUNT");
  }
  switch (input.status) {
    case "queued":
      return input.submissionState === "not_started" ? "submit" : "no-op";
    case "submitting":
      return input.submissionState === "in_flight" ? "mark-ambiguous" : "no-op";
    case "processing":
      return "fail-without-resubmit";
    case "persisting":
      return input.durableOutputCount > 0 ? "finalize-durable-output" : "fail-without-resubmit";
    case "completed":
      return "mirror-completed";
    case "failed":
    case "cancelled":
    case "expired":
      return "no-op";
  }
}

export function providerFailureDisposition(status: number | undefined): "definitive" | "ambiguous" {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) return "definitive";
  return "ambiguous";
}

export function requireProviderRequestIdentity(value: string | null | undefined): string {
  if (!value || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    throw new Error("PROVIDER_REQUEST_ID_REQUIRED");
  }
  return value;
}

export function durableImageKeys(generationId: string, requestIdempotencyKey: string) {
  if (!generationId || generationId.length > 128) throw new Error("INVALID_GENERATION_ID");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/.test(requestIdempotencyKey)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  return {
    generationKey: `image-generation:${generationId}`,
    jobKey: `image-job:${generationId}`,
    eventId: `image-created:${generationId}`,
    requestFingerprint: `image-request:${requestIdempotencyKey}`,
  } as const;
}
