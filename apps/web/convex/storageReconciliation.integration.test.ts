import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createDurableJobRecords } from "./durableJobs";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/!(*.*.*)*.*s");

type Harness = TestConvex<typeof schema>;
const PAGE = { cursor: null, numItems: 100 } as const;
const HOUR_MS = 60 * 60 * 1000;

async function store(t: Harness, value: string, contentType = "image/png") {
  return t.run(async (ctx) => ctx.storage.store(new Blob([value], { type: contentType })));
}

async function seedAllReferenceSources(t: Harness) {
  const ids = {
    generationImage: await store(t, "generation-image"),
    generationThumbnail: await store(t, "generation-thumbnail", "image/jpeg"),
    generationReferenceA: await store(t, "generation-reference-a"),
    generationReferenceB: await store(t, "generation-reference-b"),
    galleryImage: await store(t, "gallery-image"),
    galleryThumbnail: await store(t, "gallery-thumbnail", "image/jpeg"),
    avatar: await store(t, "avatar"),
    durableImage: await store(t, "durable-image"),
    durableThumbnail: await store(t, "durable-thumbnail", "image/jpeg"),
    video: await store(t, "video", "video/mp4"),
    videoThumbnail: await store(t, "video-thumbnail", "image/jpeg"),
    videoReferenceA: await store(t, "video-reference-a"),
    videoReferenceB: await store(t, "video-reference-b"),
  };

  const documents = await t.run(async (ctx) => {
    const generationId = await ctx.db.insert("generations", {
      userId: "owner_storage_test",
      prompt: "storage inventory fixture",
      imageStorageId: ids.generationImage,
      thumbnailStorageId: ids.generationThumbnail,
      mode: "image-editing",
      aspectRatio: "square",
      imageSize: "2K",
      createdAt: Date.now(),
      referenceImageIds: [ids.generationReferenceA, ids.generationReferenceB],
    });
    const galleryId = await ctx.db.insert("gallery", {
      userId: "owner_storage_test",
      filename: "inventory-fixture",
      imageStorageId: ids.galleryImage,
      thumbnailStorageId: ids.galleryThumbnail,
      createdAt: Date.now(),
    });
    const characterId = await ctx.db.insert("characters", {
      userId: "owner_storage_test",
      name: "Inventory Character",
      appearance: {},
      avatarStorageId: ids.avatar,
      createdAt: Date.now(),
    });
    const created = await createDurableJobRecords(ctx, {
      ownerId: "owner_storage_test",
      jobKey: "job_storage_inventory",
      generationKey: "generation_storage_inventory",
      idempotencyKey: "idempotency_storage_inventory",
      requestFingerprint: "request_storage_inventory",
      provider: "openai",
      credentialHandle: "credential_storage_inventory",
      modelId: "gpt-image-2",
      requestMetadataJson: JSON.stringify({ kind: "storage-inventory-test" }),
      maxAgeSeconds: 1800,
      scheduleAt: Date.now() + 60_000,
      eventId: "created_storage_inventory",
      occurredAt: Date.now(),
    });
    const completionId = await ctx.db.insert("durableGenerationCompletions", {
      ownerId: "owner_storage_test",
      jobId: created.jobId,
      jobKey: "job_storage_inventory",
      generationKey: "generation_storage_inventory",
      provider: "openai",
      providerRequestId: "provider_request_storage_inventory",
      completionKey: "completion_storage_inventory",
      outputIdentityKind: "checksum",
      outputIdentity: "a".repeat(64),
      createdAt: Date.now(),
    });
    const durableOutputId = await ctx.db.insert("durableGenerationOutputs", {
      ownerId: "owner_storage_test",
      jobId: created.jobId,
      jobKey: "job_storage_inventory",
      generationKey: "generation_storage_inventory",
      completionId,
      outputKey: "output_storage_inventory",
      storageId: ids.durableImage,
      thumbnailStorageId: ids.durableThumbnail,
      mediaType: "image",
      contentType: "image/png",
      byteSize: 13,
      checksumSha256: "a".repeat(64),
      createdAt: Date.now(),
    });
    const videoGenerationId = await ctx.db.insert("videoGenerations", {
      userId: "owner_storage_test",
      prompt: "video inventory fixture",
      videoStorageId: ids.video,
      thumbnailStorageId: ids.videoThumbnail,
      mode: "image-to-video",
      aspectRatio: "16:9",
      resolution: "720p",
      referenceImageStorageIds: [ids.videoReferenceA, ids.videoReferenceB],
      createdAt: Date.now(),
    });
    return { generationId, galleryId, characterId, durableOutputId, videoGenerationId };
  });
  return { ids, documents };
}

async function referencePage(
  t: Harness,
  source: "generations" | "gallery" | "characters" | "durable_outputs" | "video_generations",
  paginationOpts: { cursor: string | null; numItems: number } = PAGE,
) {
  return t.query(internal.storageReconciliation.pageStorageReferences, { source, paginationOpts });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("storage reconciliation inventory", () => {
  it("exports every scalar and array storage reference with minimal opaque metadata", async () => {
    const t = convexTest(schema, modules);
    const { ids, documents } = await seedAllReferenceSources(t);

    expect((await referencePage(t, "generations")).page).toEqual([{
      source: "generations",
      documentId: documents.generationId,
      references: [
        { field: "imageStorageId", storageIds: [ids.generationImage] },
        { field: "thumbnailStorageId", storageIds: [ids.generationThumbnail] },
        { field: "referenceImageIds", storageIds: [ids.generationReferenceA, ids.generationReferenceB] },
      ],
    }]);
    expect((await referencePage(t, "gallery")).page).toEqual([{
      source: "gallery",
      documentId: documents.galleryId,
      references: [
        { field: "imageStorageId", storageIds: [ids.galleryImage] },
        { field: "thumbnailStorageId", storageIds: [ids.galleryThumbnail] },
      ],
    }]);
    expect((await referencePage(t, "characters")).page).toEqual([{
      source: "characters",
      documentId: documents.characterId,
      references: [{ field: "avatarStorageId", storageIds: [ids.avatar] }],
    }]);
    expect((await referencePage(t, "durable_outputs")).page).toEqual([{
      source: "durable_outputs",
      documentId: documents.durableOutputId,
      references: [
        { field: "storageId", storageIds: [ids.durableImage] },
        { field: "thumbnailStorageId", storageIds: [ids.durableThumbnail] },
      ],
    }]);
    expect((await referencePage(t, "video_generations")).page).toEqual([{
      source: "video_generations",
      documentId: documents.videoGenerationId,
      references: [
        { field: "videoStorageId", storageIds: [ids.video] },
        { field: "thumbnailStorageId", storageIds: [ids.videoThumbnail] },
        { field: "referenceImageStorageIds", storageIds: [ids.videoReferenceA, ids.videoReferenceB] },
      ],
    }]);

    for (const source of ["generations", "gallery", "characters", "durable_outputs", "video_generations"] as const) {
      for (const entry of (await referencePage(t, source)).page) {
        expect(Object.keys(entry).sort()).toEqual(["documentId", "references", "source"]);
      }
    }
  });

  it("paginates source rows without dropping or duplicating their compact references", async () => {
    const t = convexTest(schema, modules);
    const storageIds = [await store(t, "page-a"), await store(t, "page-b"), await store(t, "page-c")];
    await t.run(async (ctx) => {
      for (const [index, storageId] of storageIds.entries()) {
        await ctx.db.insert("generations", {
          userId: "owner_storage_test",
          prompt: `page ${index}`,
          imageStorageId: storageId,
          mode: "text-to-image",
          aspectRatio: "square",
          imageSize: "2K",
          createdAt: Date.now() + index,
        });
      }
    });

    const first = await referencePage(t, "generations", { cursor: null, numItems: 2 });
    const second = await referencePage(t, "generations", { cursor: first.continueCursor, numItems: 2 });
    expect(first.isDone).toBe(false);
    expect(second.isDone).toBe(true);
    expect(
      [...first.page, ...second.page].flatMap((entry) =>
        entry.references.flatMap((reference) => reference.storageIds),
      ),
    ).toEqual(storageIds);
    expect(new Set([...first.page, ...second.page].map((entry) => entry.documentId)).size).toBe(3);
  });

  it("returns every occurrence in schema-valid oversized and duplicate reference arrays", async () => {
    const t = convexTest(schema, modules);
    const storageId = await store(t, "overflow");
    await t.run(async (ctx) => {
      await ctx.db.insert("generations", {
        userId: "owner_storage_test",
        prompt: "overflow",
        mode: "image-editing",
        aspectRatio: "square",
        imageSize: "2K",
        createdAt: Date.now(),
        referenceImageIds: Array.from({ length: 17 }, () => storageId),
      });
    });
    const page = await referencePage(t, "generations");
    expect(page.page[0].references).toEqual([
      { field: "referenceImageIds", storageIds: Array.from({ length: 17 }, () => storageId) },
    ]);
  });

  it("uses server time for age eligibility and returns only minimal storage metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const oldStorageId = await store(t, "old");
    vi.advanceTimersByTime(HOUR_MS);
    const youngStorageId = await store(t, "young");

    const first = await t.query(internal.storageReconciliation.pageStorageObjects, {
      paginationOpts: { cursor: null, numItems: 1 },
      minimumAgeMs: HOUR_MS,
    });
    vi.advanceTimersByTime(HOUR_MS);
    const second = await t.query(internal.storageReconciliation.pageStorageObjects, {
      paginationOpts: { cursor: first.result.continueCursor, numItems: 1 },
      minimumAgeMs: HOUR_MS,
      reviewBefore: first.reviewBefore,
    });
    const rows = [...first.result.page, ...second.result.page];
    const oldObject = rows.find((row) => row.storageId === oldStorageId);
    const youngObject = rows.find((row) => row.storageId === youngStorageId);
    expect(oldObject?.eligibleForReview).toBe(true);
    expect(youngObject?.eligibleForReview).toBe(false);
    expect(oldObject?.createdAt).toBe(first.reviewBefore);
    expect(second.reviewBefore).toBe(first.reviewBefore);
    for (const row of rows) {
      const keys = Object.keys(row).sort();
      expect(keys.filter((key) => key !== "contentType")).toEqual([
        "byteSize",
        "createdAt",
        "eligibleForReview",
        "storageId",
      ]);
      expect(keys.every((key) => ["byteSize", "contentType", "createdAt", "eligibleForReview", "storageId"].includes(key))).toBe(true);
    }
  });

  it("rejects oversized pages and invalid grace periods", async () => {
    const t = convexTest(schema, modules);
    await expect(referencePage(t, "gallery", { cursor: null, numItems: 101 })).rejects.toThrow(
      "INVALID_STORAGE_INVENTORY_PAGE_SIZE",
    );
    await expect(
      t.query(internal.storageReconciliation.pageStorageObjects, {
        paginationOpts: { cursor: null, numItems: 0 },
        minimumAgeMs: HOUR_MS,
      }),
    ).rejects.toThrow("INVALID_STORAGE_INVENTORY_PAGE_SIZE");
    for (const minimumAgeMs of [HOUR_MS - 1, HOUR_MS + 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        t.query(internal.storageReconciliation.pageStorageObjects, {
          paginationOpts: PAGE,
          minimumAgeMs,
        }),
      ).rejects.toThrow("INVALID_STORAGE_INVENTORY_MINIMUM_AGE");
    }
    await expect(
      t.query(internal.storageReconciliation.pageStorageObjects, {
        paginationOpts: PAGE,
        minimumAgeMs: 365 * 24 * HOUR_MS,
      }),
    ).resolves.toBeDefined();
    const conservative = await t.query(internal.storageReconciliation.pageStorageObjects, {
      paginationOpts: PAGE,
      minimumAgeMs: Number.MAX_SAFE_INTEGER,
    });
    expect(conservative.reviewBefore).toBe(0);
    await expect(
      t.query(internal.storageReconciliation.pageStorageObjects, {
        paginationOpts: { cursor: conservative.result.continueCursor, numItems: 1 },
        minimumAgeMs: Number.MAX_SAFE_INTEGER,
        reviewBefore: conservative.reviewBefore,
      }),
    ).resolves.toBeDefined();
    await expect(
      t.query(internal.storageReconciliation.pageStorageObjects, {
        paginationOpts: PAGE,
        minimumAgeMs: HOUR_MS,
        reviewBefore: Date.now(),
      }),
    ).rejects.toThrow("INVALID_STORAGE_INVENTORY_REVIEW_BEFORE");
  });
});
