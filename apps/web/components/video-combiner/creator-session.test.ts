import { describe, expect, it, vi } from "vitest";
import { VideoCreatorSession, creatorJobView, defaultVideoInput, unknownSubmission, validVideoInput, type VideoInput } from "./creator-session";
import type { Id } from "../../convex/_generated/dataModel";

const input: VideoInput = { ...defaultVideoInput, prompt: "A lighthouse" };
const first = "owned-first" as Id<"gallery">;
const last = "owned-last" as Id<"gallery">;
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  let sequence = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  return { storage, uuid, session: new VideoCreatorSession("alice", storage, uuid) };
}

describe("creator interaction controller used by the hook", () => {
  it.each(["", "   ", "\n\t"])("restores unfinished prompt %j without authorizing submission", async prompt => {
    const { session, storage, uuid } = setup();
    const draft = { ...input, prompt };
    session.editInput(draft);
    const restored = new VideoCreatorSession("alice", storage, uuid);
    expect(restored.snapshot?.input).toEqual(draft);
    const start = vi.fn();
    await restored.submit(draft, [], true, start);
    expect(start).not.toHaveBeenCalled();
    expect(restored.snapshot?.attempted).toBe(false);
  });
  it("persists before dispatch and blocks duplicate clicks while a response is pending", async () => {
    const { session, storage, uuid } = setup();
    let finish!: () => void;
    const start = vi.fn(() => {
      expect(new VideoCreatorSession("alice", storage, uuid).snapshot?.attempted).toBe(true);
      return new Promise<void>(resolve => { finish = resolve; });
    });
    const pending = session.submit(input, [], true, start);
    await session.submit(input, [], true, start);
    expect(start).toHaveBeenCalledTimes(1);
    finish(); await pending;
    await session.submit(input, [], true, start);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it("lost responses and refresh retain one identity and never automatically or manually retry it", async () => {
    const { session, storage, uuid } = setup();
    const start = vi.fn(async () => { throw new Error("synthetic-key provider-private-url raw stack"); });
    expect(await session.submit(input, [], true, start)).toBe(unknownSubmission);
    const restored = new VideoCreatorSession("alice", storage, uuid);
    expect(restored.snapshot).toEqual(session.snapshot);
    await restored.submit(input, [], true, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(restored.snapshot)).not.toContain("synthetic-key");
  });
  it("changed inputs and explicit New each create a distinct request", async () => {
    const { session } = setup(); const start = vi.fn(async () => undefined);
    await session.submit(input, [], true, start);
    await session.submit({ ...input, prompt: "Different" }, [], true, start);
    session.newGeneration(input);
    expect(start).toHaveBeenCalledTimes(2);
    await session.submit(input, [], true, start);
    expect(new Set(start.mock.calls.map(call => (call as unknown as [{ idempotencyKey: string }])[0].idempotencyKey)).size).toBe(3);
  });
  it("no-op edits retain attempted identity; edits back to previous inputs prepare a distinct draft", async () => {
    const { session, storage, uuid } = setup(); const start = vi.fn(async () => undefined);
    await session.submit(input, [], true, start);
    const key = session.snapshot!.key;
    session.editInput({ ...input }); expect(session.snapshot!.key).toBe(key);
    expect(session.snapshot!.attempted).toBe(true);
    session.editInput({ ...input, prompt: "Changed" }); session.editInput(input);
    expect(session.snapshot!.key).not.toBe(key); expect(start).toHaveBeenCalledTimes(1);
    expect(new VideoCreatorSession("alice", storage, uuid).snapshot).toEqual(session.snapshot);
  });
  it("isolates account journals and preserves the original owner in in-flight arguments", async () => {
    const { session, storage, uuid } = setup();
    const start = vi.fn(async () => undefined);
    await session.submit(input, [], true, start);
    const other = new VideoCreatorSession("bob", storage, uuid);
    expect(other.snapshot).toBeNull();
    await other.submit(input, [], true, start);
    expect(start.mock.calls).toEqual([[expect.objectContaining({ ownerId: "alice" })], [expect.objectContaining({ ownerId: "bob" })]]);
  });
  it("preserves ordered and repeated verified frame IDs", async () => {
    const { session } = setup(); const start = vi.fn(async () => undefined);
    for (const refs of [[first], [first, last], [last, first], [first, first]]) {
      await session.submit({ ...input, referenceGalleryIds: refs }, [first, last], true, start);
      expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ referenceGalleryIds: refs }));
    }
  });
  it.each([
    { resolution: "4k" }, { aspectRatio: "1:1" }, { duration: 5 }, { resolution: "1080p", duration: 4 },
    { referenceGalleryIds: [first, last], duration: 6 }, { referenceGalleryIds: [first, last, first] },
    { referenceGalleryIds: ["foreign"] }, { audio: false }, { characterImages: ["https://evil.invalid/image"] },
    { prompt: " " }, { prompt: "x".repeat(10001) },
  ])("rejects unsupported or unowned input before dispatch: %j", async patch => {
    const { session } = setup(); const start = vi.fn();
    const invalid = { ...input, ...patch } as VideoInput;
    expect(validVideoInput(invalid, [first, last])).toBe(false);
    expect(await session.submit(invalid, [first, last], true, start)).toContain("supported settings");
    expect(start).not.toHaveBeenCalled(); expect(session.snapshot).toBeNull();
  });
  it("requires active credential metadata and fails closed on storage errors", async () => {
    const { session } = setup(); const start = vi.fn();
    await session.submit(input, [], false, start); expect(start).not.toHaveBeenCalled();
    const broken = new VideoCreatorSession("alice", { getItem: () => null, setItem: () => { throw new Error("quota"); } }, () => "00000000-0000-4000-8000-000000000000");
    await expect(broken.submit(input, [], true, start)).rejects.toThrow("quota");
    expect(start).not.toHaveBeenCalled();
  });
  it.each(["failed", "cancelled", "expired", "completed"])("terminal %s never retries; only completed persisted output renders", async status => {
    const { session } = setup(); const start = vi.fn(async () => undefined);
    await session.submit(input, [], true, start);
    const view = creatorJobView({ requestKey: session.snapshot!.key, status, ambiguous: false, videoUrl: "https://storage.invalid/persisted" });
    expect(view.url).toBe(status === "completed" ? "https://storage.invalid/persisted" : null);
    await session.submit(input, [], true, start); expect(start).toHaveBeenCalledTimes(1);
  });
  it("reports real subscription states and hides output for ambiguity or nonterminal work", () => {
    for (const status of ["queued", "submitting", "processing", "persisting"]) {
      const view = creatorJobView({ requestKey: "request", status, ambiguous: false, videoUrl: "https://provider.invalid/transport" });
      expect(view.url).toBeNull(); expect(view.label).not.toContain("%");
    }
    expect(creatorJobView({ requestKey: "request", status: "expired", ambiguous: true, videoUrl: null }).label).toContain("Reconciliation required");
  });
});
