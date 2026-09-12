import React, { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { VideoCreatorSession, defaultVideoInput, type VideoInput } from "./creator-session";

const mocks = vi.hoisted(() => ({ creator: {} as Record<string, unknown>, userId: "alice", authenticated: true }));
vi.mock("./hooks/use-video-generation", () => ({ useVideoGeneration: () => mocks.creator }));
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: mocks.authenticated, isLoading: false }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: { user: { id: mocks.userId } }, isPending: false }) } }));
vi.mock("@/components/ui/button", () => ({ Button: (props: object) => React.createElement("button", props) }));
import { OwnedVideoCreator, VideoCombiner } from "./index";

type Element = ReactElement<Record<string, unknown>>;
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function find(tree: unknown, predicate: (props: Record<string, unknown>) => boolean) {
  const found = elements(tree).find(element => predicate(element.props));
  if (!found) throw new Error("Missing control");
  return found;
}
function change(label: string, value: string) {
  const control = find(OwnedVideoCreator({ ownerId: "alice" }), props => props["aria-label"] === label);
  (control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function click(label: string) {
  const control = find(OwnedVideoCreator({ ownerId: "alice" }), props => props.children === label && !!props.onClick);
  if (!control.props.disabled) (control.props.onClick as () => void)();
}
beforeEach(() => {
  mocks.userId = "alice"; mocks.authenticated = true;
  mocks.creator = { input: { ...defaultVideoInput }, setInput: (input: VideoInput) => { mocks.creator.input = input; },
    state: { ownerId: "alice", credential: { health: "active" }, frames: [{ id: "first", filename: "First" }, { id: "last", filename: "Last" }], jobs: [] },
    ready: true, canPrepareNew: true, canGenerate: true, submit: vi.fn(), newGeneration: vi.fn() };
});
it("component enforces duration combinations and preserves ordered frame selections", () => {
  change("Mode", "2"); change("First frame", "first"); change("Last frame", "last");
  expect(mocks.creator.input).toMatchObject({ duration: 8, referenceGalleryIds: ["first", "last"] });
  const tree = OwnedVideoCreator({ ownerId: "alice" });
  const duration = find(tree, props => props["aria-label"] === "Duration");
  expect(elements(duration).filter(element => element.type === "option").map(element => [element.props.value, element.props.disabled])).toEqual([[4, true], [6, true], [8, false]]);
  change("Mode", "1"); expect(mocks.creator.input).toMatchObject({ referenceGalleryIds: ["first"] });
  change("Mode", "0"); change("Duration", "4"); change("Resolution", "1080p");
  expect(mocks.creator.input).toMatchObject({ duration: 8, referenceGalleryIds: [] });
});
it("component explicitly disables unverified uploads and characters, with no fake progress or provider results", () => {
  const markup = renderToStaticMarkup(<OwnedVideoCreator ownerId="alice" />);
  expect(markup).toContain("File uploads unavailable"); expect(markup).toContain("Character / asset references unavailable");
  expect(markup).not.toContain('type="file"'); expect(markup).not.toContain("%");
  (mocks.creator.state as { jobs: unknown[] }).jobs = [{ jobId: "job", prompt: "test", status: "persisting", ambiguous: false, videoUrl: "https://provider.invalid/raw" }];
  expect(renderToStaticMarkup(<OwnedVideoCreator ownerId="alice" />)).not.toContain("https://provider.invalid/raw");
});
it("Generate interaction persists once across duplicate clicks and refresh after response loss; New is explicit", async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  let id = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
  let session = new VideoCreatorSession("alice", storage, uuid);
  const network = vi.fn(async () => { throw new Error("synthetic-private-error"); });
  change("Prompt", "A lighthouse");
  const input = mocks.creator.input as VideoInput;
  mocks.creator.submit = () => session.submit(input, [], true, network);
  mocks.creator.newGeneration = () => session.newGeneration(input);
  click("Generate video"); click("Generate video");
  await Promise.resolve(); expect(network).toHaveBeenCalledTimes(1);
  session = new VideoCreatorSession("alice", storage, uuid);
  click("Generate video"); expect(network).toHaveBeenCalledTimes(1);
  click("New generation"); expect(network).toHaveBeenCalledTimes(1);
  click("Generate video"); expect(network).toHaveBeenCalledTimes(2);
});
it("account changes remount the owned creator and unauthenticated state renders no form", () => {
  const first = VideoCombiner(); expect(first.key).toBe("alice");
  mocks.userId = "bob"; const second = VideoCombiner(); expect(second.key).toBe("bob");
  expect(second.props.children.props.ownerId).toBe("bob");
  mocks.authenticated = false; expect(renderToStaticMarkup(VideoCombiner())).toContain("Sign in to create videos");
});
it("renders only completed persisted video and safe terminal/ambiguous messages", () => {
  const state = mocks.creator.state as { jobs: unknown[] };
  state.jobs = [{ jobId: "job", prompt: "test", status: "completed", ambiguous: false, videoUrl: "https://storage.invalid/persisted", resolution: "720p", duration: 8 }];
  expect(renderToStaticMarkup(<OwnedVideoCreator ownerId="alice" />)).toContain('src="https://storage.invalid/persisted"');
  state.jobs = [{ jobId: "job", prompt: "test", status: "expired", ambiguous: true, videoUrl: "https://provider.invalid/raw", error: "private-error" }];
  const markup = renderToStaticMarkup(<OwnedVideoCreator ownerId="alice" />);
  expect(markup).toContain("Reconciliation required"); expect(markup).not.toContain("private-error"); expect(markup).not.toContain("provider.invalid");
});
