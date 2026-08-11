import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return {
    ...actual,
    authComponent: new Proxy(actual.authComponent, {
      get(target, property, receiver) {
        if (property === "safeGetAuthUser") {
          return async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
            const identity = await ctx.auth.getUserIdentity();
            return identity ? { _id: identity.subject } : null;
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");
type Harness = TestConvex<typeof schema>;
const OWNER = "owner_storage_ledger";
const asOwner = (t: Harness) => t.withIdentity({ subject: OWNER });
const readinessReference = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    status: "uninitialized" | "collecting" | "verified";
    authoritative: false;
    startedAt?: number;
    verifiedAt?: number;
    verificationFingerprint?: string;
  }
>("storageReferenceLedger:getStorageReferenceLedgerReadiness");

async function ledgerRows(t: Harness) {
  return await t.run(async (ctx) => ctx.db.query("storageReferenceLedger").collect());
}

describe("transactional storage reference ledger", () => {
  it("dual-writes, deduplicates, replaces, and removes every user-facing source", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(readinessReference, {})).toEqual({
      status: "uninitialized",
      authoritative: false,
    });
    const storage = await t.run(async (ctx) => ({
      primary: await ctx.storage.store(new Blob(["primary"], { type: "image/png" })),
      thumbnail: await ctx.storage.store(new Blob(["thumbnail"], { type: "image/jpeg" })),
      replacement: await ctx.storage.store(new Blob(["replacement"], { type: "image/png" })),
    }));
    const authed = asOwner(t);
    const generationId = await authed.mutation(api.generations.saveGeneration, {
      prompt: "ledger generation",
      imageStorageId: storage.primary,
      thumbnailStorageId: storage.thumbnail,
      mode: "text-to-image",
      aspectRatio: "square",
      imageSize: "2K",
    });
    const galleryId = await authed.mutation(api.gallery.saveImage, {
      filename: "ledger-gallery",
      imageStorageId: storage.primary,
      thumbnailStorageId: storage.thumbnail,
    });
    const characterId = await authed.mutation(api.characters.createCharacter, {
      name: "Ledger Character",
      appearance: {},
      avatarStorageId: storage.primary,
    });
    const videoGenerationId = await authed.mutation(api.videoGenerations.saveVideoGeneration, {
      prompt: "ledger video",
      videoStorageId: storage.primary,
      thumbnailStorageId: storage.thumbnail,
      mode: "image-to-video",
      aspectRatio: "landscape",
      resolution: "720p",
      referenceImageStorageIds: [storage.primary, storage.primary],
    });

    const rows = await ledgerRows(t);
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((row) => row.referenceKey)).size).toBe(8);
    expect(rows.filter((row) => row.source === "video_generations" && row.field === "referenceImageStorageIds")).toHaveLength(1);
    expect(await t.query(readinessReference, {})).toMatchObject({
      status: "collecting",
      authoritative: false,
    });

    await authed.mutation(api.characters.updateCharacter, {
      characterId,
      avatarStorageId: storage.replacement,
    });
    const characterRows = (await ledgerRows(t)).filter((row) => row.source === "characters" && row.documentId === characterId);
    expect(characterRows.map((row) => row.storageId)).toEqual([storage.replacement]);

    await authed.mutation(api.generations.deleteGeneration, { generationId });
    await authed.mutation(api.gallery.deleteImage, { imageId: galleryId });
    await authed.mutation(api.characters.deleteCharacter, { characterId });
    await authed.mutation(api.videoGenerations.deleteVideoGeneration, { videoGenerationId });
    expect(await ledgerRows(t)).toEqual([]);
    expect(await t.query(readinessReference, {})).toMatchObject({
      status: "collecting",
      authoritative: false,
    });
  });

  it("accepts exactly 64 unique document references", async () => {
    const t = convexTest(schema, modules);
    const storageIds = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < 62; index += 1) {
        ids.push(await ctx.storage.store(new Blob([`boundary-${index}`], { type: "image/png" })));
      }
      return ids;
    });
    const videoGenerationId = await asOwner(t).mutation(api.videoGenerations.saveVideoGeneration, {
      prompt: "boundary ledger",
      videoStorageId: storageIds[0],
      thumbnailStorageId: storageIds[1],
      mode: "image-to-video",
      aspectRatio: "landscape",
      resolution: "720p",
      referenceImageStorageIds: storageIds,
    });
    const rows = (await ledgerRows(t)).filter((row) => row.documentId === videoGenerationId);
    expect(rows).toHaveLength(64);
  });

  it("rolls back the application row and ledger when a document exceeds 64 references", async () => {
    const t = convexTest(schema, modules);
    const storageIds = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < 63; index += 1) {
        ids.push(await ctx.storage.store(new Blob([`reference-${index}`], { type: "image/png" })));
      }
      return ids;
    });
    await expect(
      asOwner(t).mutation(api.videoGenerations.saveVideoGeneration, {
        prompt: "overflow ledger",
        videoStorageId: storageIds[0],
        thumbnailStorageId: storageIds[1],
        mode: "image-to-video",
        aspectRatio: "landscape",
        resolution: "720p",
        referenceImageStorageIds: storageIds,
      }),
    ).rejects.toThrow("STORAGE_REFERENCE_LEDGER_DOCUMENT_OVERFLOW");
    const state = await t.run(async (ctx) => ({
      videos: await ctx.db.query("videoGenerations").collect(),
      ledger: await ctx.db.query("storageReferenceLedger").collect(),
      readiness: await ctx.db.query("storageReferenceLedgerState").collect(),
    }));
    expect(state.videos).toEqual([]);
    expect(state.ledger).toEqual([]);
    expect(state.readiness).toEqual([]);
  });
});
