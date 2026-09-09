import type { Id } from "../../convex/_generated/dataModel";

export interface VideoInput {
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p";
  duration: 4 | 6 | 8;
  referenceGalleryIds: Id<"gallery">[];
}
export const defaultVideoInput: VideoInput = {
  prompt: "", aspectRatio: "16:9", resolution: "720p", duration: 8, referenceGalleryIds: [],
};
export function validVideoInput(input: VideoInput, ownedFrames: readonly string[]): boolean {
  return Object.keys(input).sort().join() === "aspectRatio,duration,prompt,referenceGalleryIds,resolution" &&
    typeof input.prompt === "string" && !!input.prompt.trim() && input.prompt.length <= 10000 &&
    ["16:9", "9:16"].includes(input.aspectRatio) && ["720p", "1080p"].includes(input.resolution) &&
    [4, 6, 8].includes(input.duration) && Array.isArray(input.referenceGalleryIds) &&
    input.referenceGalleryIds.length <= 2 && input.referenceGalleryIds.every(id => ownedFrames.includes(id)) &&
    (!(input.resolution === "1080p" || input.referenceGalleryIds.length === 2) || input.duration === 8);
}
function fingerprint(input: VideoInput) {
  return JSON.stringify([input.prompt, input.aspectRatio, input.resolution, input.duration, input.referenceGalleryIds]);
}
interface Journal { ownerId: string; key: string; input: VideoInput; attempted: boolean }
export interface JournalStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const unknownSubmission = "Submission outcome unknown. Watching for the saved request. It will not be submitted again automatically.";

/** The hook's interaction controller: persist before dispatch, never retry an attempted identity.
 * No credential, provider URL, or mutation response is persisted or used as a result.
 */
export class VideoCreatorSession {
  private record: Journal | null = null;
  private readonly storageKey: string;
  constructor(readonly ownerId: string, private storage: JournalStorage, private uuid: () => string) {
    this.storageKey = `eikon:veo-creator:v1:${ownerId}`;
    const raw = storage.getItem(this.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Journal;
      if (parsed.ownerId !== ownerId || typeof parsed.key !== "string" ||
        !/^veo-[a-zA-Z0-9-]{16,100}$/.test(parsed.key) || typeof parsed.attempted !== "boolean" ||
        !parsed.input || typeof parsed.input.prompt !== "string" || !Array.isArray(parsed.input.referenceGalleryIds) ||
        !validVideoInput({ ...parsed.input, prompt: parsed.input.prompt.trim() ? parsed.input.prompt : "draft" }, parsed.input.referenceGalleryIds) ||
        parsed.input.prompt.length > 10000) {
        throw new Error("Stored request cannot be safely restored");
      }
      this.record = parsed;
    }
  }
  get snapshot() { return this.record; }
  private save(record: Journal) {
    this.storage.setItem(this.storageKey, JSON.stringify(record));
    this.record = record;
  }
  newGeneration(input: VideoInput) {
    this.save({ ownerId: this.ownerId, key: `veo-${this.uuid()}`, input: structuredClone(input), attempted: false });
  }
  editInput(input: VideoInput) {
    if (!this.record || fingerprint(this.record.input) !== fingerprint(input)) this.newGeneration(input);
  }
  async submit(input: VideoInput, ownedFrames: readonly string[], activeCredential: boolean,
    start: (args: VideoInput & { ownerId: string; idempotencyKey: string }) => Promise<unknown>): Promise<string | null> {
    if (!activeCredential || !validVideoInput(input, ownedFrames)) return "Choose supported settings, verified frames, and an active saved Google credential.";
    if (!this.record || fingerprint(this.record.input) !== fingerprint(input)) this.newGeneration(input);
    if (this.record!.attempted) return null;
    const record = { ...this.record!, attempted: true };
    // Synchronous write also prevents duplicate clicks before React renders again.
    this.save(record);
    try {
      await start({ ...structuredClone(input), ownerId: this.ownerId, idempotencyKey: record.key });
      return null;
    } catch {
      // Even an unclassified mutation failure might have committed. Never echo raw errors.
      return unknownSubmission;
    }
  }
}
export interface CreatorJob { requestKey: string; status: string; ambiguous: boolean; videoUrl: string | null }
export function creatorJobView(job: CreatorJob) {
  if (job.ambiguous) return { label: "Provider outcome unknown. Reconciliation required; no automatic resubmission.", url: null };
  const labels: Record<string, string> = {
    queued: "Queued", submitting: "Submitting", processing: "Processing", persisting: "Persisting video",
    completed: job.videoUrl ? "Completed" : "Completed; persisted video unavailable",
    failed: "Generation failed. No automatic retry.", cancelled: "Cancelled", expired: "Expired. No automatic retry.",
  };
  return { label: labels[job.status] ?? "Status unavailable", url: job.status === "completed" ? job.videoUrl : null };
}
