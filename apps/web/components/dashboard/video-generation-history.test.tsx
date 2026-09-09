import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("convex-helpers/react/cache/hooks", () => ({ useQuery: mocks.query }));
vi.mock("@/convex/_generated/api", () => ({ api: { videoGenerations: { getMyDurableVideos: "durable", getMyVideoGenerations: "legacy", deleteVideoGeneration: "delete" } } }));
vi.mock("@/components/logo-icon", () => ({ LogoLoader: () => null }));
vi.mock("@/components/ui/video-player", () => ({ VideoPlayer: () => null }));
vi.mock("@/lib/error-utils", () => ({ getUserFacingErrorMessage: () => "Error" }));
import { VideoGenerationHistory } from "./video-generation-history";

beforeEach(() => mocks.query.mockReset());

it("does not show the legacy empty message alongside durable jobs", () => {
  mocks.query.mockReturnValueOnce([{ id: "job_test", prompt: "Owned durable video", status: "processing" }]).mockReturnValueOnce([]);
  const html = renderToStaticMarkup(<VideoGenerationHistory />);
  expect(html).toContain("Owned durable video");
  expect(html).not.toContain("No video generations yet");
});
it("shows the empty message only when both histories are empty", () => {
  mocks.query.mockReturnValueOnce([]).mockReturnValueOnce([]);
  expect(renderToStaticMarkup(<VideoGenerationHistory />)).toContain("No video generations yet");
});
it("does not declare history empty before durable data has loaded", () => {
  mocks.query.mockReturnValueOnce(undefined).mockReturnValueOnce([]);
  expect(renderToStaticMarkup(<VideoGenerationHistory />)).not.toContain("No video generations yet");
});
