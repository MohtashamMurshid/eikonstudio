import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
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
    status: "uninitialized" | "collecting";
    authoritative: false;
    physicalDeletionEnabled: false;
    startedAt?: number;
  }
>("storageReferenceLedger:getStorageReferenceLedgerReadiness");

async function ledgerRows(t: Harness) {
  return await t.run(async (ctx) => ctx.db.query("storageReferenceLedger").collect());
}

describe("transactional storage reference ledger", () => {
  it("dual-writes, preserves occurrences, replaces fields, and removes every user-facing source", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(readinessReference, {})).toEqual({
      status: "uninitialized",
      authoritative: false,
      physicalDeletionEnabled: false,
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
    expect(rows).toHaveLength(9);
    expect(new Set(rows.map((row) => row.referenceKey)).size).toBe(9);
    expect(rows
      .filter((row) => row.source === "video_generations" && row.field === "referenceImageStorageIds")
      .map((row) => ({ position: row.position, storageId: row.storageId })))
      .toEqual([
        { position: 0, storageId: storage.primary },
        { position: 1, storageId: storage.primary },
      ]);
    expect(await t.query(readinessReference, {})).toMatchObject({
      status: "collecting",
      authoritative: false,
      physicalDeletionEnabled: false,
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
      physicalDeletionEnabled: false,
    });
  });

  it("accepts three ordered video references and rejects four with full rollback", async () => {
    const acceptedTest = convexTest(schema, modules);
    const acceptedStorage = await acceptedTest.run(async (ctx) => ({
      primary: await ctx.storage.store(new Blob(["primary"], { type: "video/mp4" })),
      thumbnail: await ctx.storage.store(new Blob(["thumbnail"], { type: "image/jpeg" })),
      a: await ctx.storage.store(new Blob(["a"], { type: "image/png" })),
      b: await ctx.storage.store(new Blob(["b"], { type: "image/png" })),
    }));
    const videoGenerationId = await asOwner(acceptedTest).mutation(api.videoGenerations.saveVideoGeneration, {
      prompt: "boundary ledger",
      videoStorageId: acceptedStorage.primary,
      thumbnailStorageId: acceptedStorage.thumbnail,
      mode: "image-to-video",
      aspectRatio: "landscape",
      resolution: "720p",
      referenceImageStorageIds: [acceptedStorage.a, acceptedStorage.a, acceptedStorage.b],
    });
    const acceptedRows = (await ledgerRows(acceptedTest)).filter((row) => row.documentId === videoGenerationId);
    expect(acceptedRows).toHaveLength(5);
    expect(acceptedRows
      .filter((row) => row.field === "referenceImageStorageIds")
      .map((row) => ({ position: row.position, storageId: row.storageId })))
      .toEqual([
        { position: 0, storageId: acceptedStorage.a },
        { position: 1, storageId: acceptedStorage.a },
        { position: 2, storageId: acceptedStorage.b },
      ]);
    await acceptedTest.run(async (ctx) => {
      const middle = await ctx.db
        .query("storageReferenceLedger")
        .withIndex("by_source_document_field", (q) =>
          q.eq("source", "video_generations").eq("documentId", videoGenerationId).eq("field", "referenceImageStorageIds")
        )
        .filter((q) => q.eq(q.field("position"), 1))
        .unique();
      if (!middle) throw new Error("Ledger gap fixture is missing");
      await ctx.db.delete(middle._id);
    });
    await expect(
      asOwner(acceptedTest).mutation(api.videoGenerations.deleteVideoGeneration, { videoGenerationId }),
    ).rejects.toThrow("STORAGE_REFERENCE_LEDGER_CORRUPT");
    expect(await acceptedTest.run(async (ctx) => ctx.db.get(videoGenerationId))).not.toBeNull();

    const rejectedTest = convexTest(schema, modules);
    const rejectedStorage = await rejectedTest.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < 6; index += 1) {
        ids.push(await ctx.storage.store(new Blob([`reference-${index}`], { type: "image/png" })));
      }
      return ids;
    });
    await expect(
      asOwner(rejectedTest).mutation(api.videoGenerations.saveVideoGeneration, {
        prompt: "overflow ledger",
        videoStorageId: rejectedStorage[0],
        thumbnailStorageId: rejectedStorage[1],
        mode: "image-to-video",
        aspectRatio: "landscape",
        resolution: "720p",
        referenceImageStorageIds: rejectedStorage.slice(2),
      }),
    ).rejects.toThrow("Video generation supports at most three reference images");
    const rejectedState = await rejectedTest.run(async (ctx) => ({
      videos: await ctx.db.query("videoGenerations").collect(),
      ledger: await ctx.db.query("storageReferenceLedger").collect(),
      readiness: await ctx.db.query("storageReferenceLedgerState").collect(),
    }));
    expect(rejectedState.videos).toEqual([]);
    expect(rejectedState.ledger).toEqual([]);
    expect(rejectedState.readiness).toEqual([]);
  });

  it("rejects five generation references before source, durable, ledger, or readiness writes", async () => {
    const t = convexTest(schema, modules);
    const referenceImageIds = await t.run(async (ctx) => {
      const ids = [];
      for (let index = 0; index < 5; index += 1) {
        ids.push(await ctx.storage.store(new Blob([`image-reference-${index}`], { type: "image/png" })));
      }
      return ids;
    });
    await expect(
      asOwner(t).mutation(api.generations.startGeneration, {
        idempotencyKey: "ledger-overflow-image-refs",
        prompt: "too many references",
        mode: "image-editing",
        aspectRatio: "square",
        imageSize: "2K",
        imageModel: "gpt-image-2",
        referenceImageIds,
      }),
    ).rejects.toThrow("Image editing supports at most four reference images");
    const state = await t.run(async (ctx) => ({
      generations: await ctx.db.query("generations").collect(),
      jobs: await ctx.db.query("durableGenerationJobs").collect(),
      events: await ctx.db.query("durableGenerationEvents").collect(),
      ledger: await ctx.db.query("storageReferenceLedger").collect(),
      readiness: await ctx.db.query("storageReferenceLedgerState").collect(),
    }));
    expect(state).toEqual({ generations: [], jobs: [], events: [], ledger: [], readiness: [] });
  });

  it("fails closed on duplicate ledger positions and rolls back the source patch", async () => {
    const t = convexTest(schema, modules);
    const storage = await t.run(async (ctx) => ({
      original: await ctx.storage.store(new Blob(["original"], { type: "image/png" })),
      replacement: await ctx.storage.store(new Blob(["replacement"], { type: "image/png" })),
    }));
    const characterId = await asOwner(t).mutation(api.characters.createCharacter, {
      name: "Corruption Sentinel",
      appearance: {},
      avatarStorageId: storage.original,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("storageReferenceLedger")
        .withIndex("by_source_document", (q) => q.eq("source", "characters").eq("documentId", characterId))
        .unique();
      if (!row) throw new Error("Ledger corruption fixture is missing");
      const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...fields } = row;
      await ctx.db.insert("storageReferenceLedger", { ...fields, storageId: storage.replacement });
    });
    await expect(
      asOwner(t).mutation(api.characters.updateCharacter, {
        characterId,
        name: "Must Roll Back",
        avatarStorageId: storage.replacement,
      }),
    ).rejects.toThrow("STORAGE_REFERENCE_LEDGER_CORRUPT");
    expect(await t.run(async (ctx) => ctx.db.get(characterId))).toMatchObject({
      name: "Corruption Sentinel",
      avatarStorageId: storage.original,
    });
    expect((await ledgerRows(t)).filter((row) => row.documentId === characterId)).toHaveLength(2);
  });

  it("tracks only patched generation fields and does not backfill historical references", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const historicalReference = await ctx.storage.store(new Blob(["historical-reference"], { type: "image/png" }));
      const imageStorageId = await ctx.storage.store(new Blob(["completed-image"], { type: "image/png" }));
      const thumbnailStorageId = await ctx.storage.store(new Blob(["completed-thumbnail"], { type: "image/jpeg" }));
      const generationId = await ctx.db.insert("generations", {
        userId: OWNER,
        prompt: "historical generation",
        mode: "image-editing",
        aspectRatio: "square",
        imageSize: "2K",
        referenceImageIds: [historicalReference],
        createdAt: Date.now(),
        status: "pending",
      });
      return { generationId, historicalReference, imageStorageId, thumbnailStorageId };
    });
    await t.mutation(internal.generations.completeGeneration, {
      generationId: fixture.generationId,
      imageStorageId: fixture.imageStorageId,
      thumbnailStorageId: fixture.thumbnailStorageId,
      estimatedCost: 0.01,
      model: "gpt-image-2",
    });
    await t.mutation(internal.generations.completeGeneration, {
      generationId: fixture.generationId,
      imageStorageId: fixture.imageStorageId,
      thumbnailStorageId: fixture.thumbnailStorageId,
      estimatedCost: 0.01,
      model: "gpt-image-2",
    });
    const rows = (await ledgerRows(t)).filter((row) => row.documentId === fixture.generationId);
    expect(rows.map((row) => ({ field: row.field, position: row.position, storageId: row.storageId }))).toEqual([
      { field: "imageStorageId", position: 0, storageId: fixture.imageStorageId },
      { field: "thumbnailStorageId", position: 0, storageId: fixture.thumbnailStorageId },
    ]);
    expect(rows.some((row) => row.storageId === fixture.historicalReference)).toBe(false);
  });

  it("does not opportunistically backfill an avatar during a non-avatar update", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const avatarStorageId = await ctx.storage.store(new Blob(["historical-avatar"], { type: "image/png" }));
      const characterId = await ctx.db.insert("characters", {
        userId: OWNER,
        name: "Historical Character",
        appearance: {},
        avatarStorageId,
        createdAt: Date.now(),
      });
      return { avatarStorageId, characterId };
    });
    await asOwner(t).mutation(api.characters.updateCharacter, {
      characterId: fixture.characterId,
      name: "Renamed Historical Character",
    });
    expect(await ledgerRows(t)).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.get(fixture.characterId))).toMatchObject({
      name: "Renamed Historical Character",
      avatarStorageId: fixture.avatarStorageId,
    });
  });
});
