import { convexTest, type TestConvex } from "convex-test";
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
const OWNER = "owner_shared_storage";
type Harness = TestConvex<typeof schema>;
const asOwner = (t: Harness) => t.withIdentity({ subject: OWNER });

describe("shared storage retention", () => {
  it("deletes rows across every surface without deleting a shared blob", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const sharedStorageId = await ctx.storage.store(new Blob(["shared-media"], { type: "image/png" }));
      const generationId = await ctx.db.insert("generations", {
        userId: OWNER,
        prompt: "legacy shared generation",
        imageStorageId: sharedStorageId,
        thumbnailStorageId: sharedStorageId,
        referenceImageIds: [sharedStorageId],
        mode: "image-editing",
        aspectRatio: "square",
        imageSize: "2K",
        createdAt: Date.now(),
        status: "completed",
      });
      const galleryId = await ctx.db.insert("gallery", {
        userId: OWNER,
        filename: "shared-gallery",
        imageStorageId: sharedStorageId,
        thumbnailStorageId: sharedStorageId,
        createdAt: Date.now(),
      });
      const videoGenerationId = await ctx.db.insert("videoGenerations", {
        userId: OWNER,
        prompt: "shared video",
        videoStorageId: sharedStorageId,
        thumbnailStorageId: sharedStorageId,
        mode: "image-to-video",
        aspectRatio: "16:9",
        resolution: "720p",
        referenceImageStorageIds: [sharedStorageId],
        createdAt: Date.now(),
      });
      const characterId = await ctx.db.insert("characters", {
        userId: OWNER,
        name: "Shared Character",
        appearance: {},
        avatarStorageId: sharedStorageId,
        createdAt: Date.now(),
      });
      return { sharedStorageId, generationId, galleryId, videoGenerationId, characterId };
    });
    const authed = asOwner(t);

    await authed.mutation(api.generations.deleteGeneration, { generationId: fixture.generationId });
    expect(await t.run(async (ctx) => ctx.db.get(fixture.generationId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.sharedStorageId))).not.toBeNull();

    await authed.mutation(api.gallery.deleteImage, { imageId: fixture.galleryId });
    expect(await t.run(async (ctx) => ctx.db.get(fixture.galleryId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.sharedStorageId))).not.toBeNull();

    await authed.mutation(api.videoGenerations.deleteVideoGeneration, { videoGenerationId: fixture.videoGenerationId });
    expect(await t.run(async (ctx) => ctx.db.get(fixture.videoGenerationId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.sharedStorageId))).not.toBeNull();

    await authed.mutation(api.characters.deleteCharacter, { characterId: fixture.characterId });
    expect(await t.run(async (ctx) => ctx.db.get(fixture.characterId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(fixture.sharedStorageId))).not.toBeNull();
  });

  it("deletes a folder cascade while retaining every image and thumbnail blob", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const sharedStorageId = await ctx.storage.store(new Blob(["folder-shared"], { type: "image/png" }));
      const folderId = await ctx.db.insert("folders", { userId: OWNER, name: "retained", createdAt: Date.now() });
      const imageIds = [];
      for (let index = 0; index < 2; index += 1) {
        imageIds.push(await ctx.db.insert("gallery", {
          userId: OWNER,
          filename: `folder-image-${index}`,
          imageStorageId: sharedStorageId,
          thumbnailStorageId: sharedStorageId,
          folderId,
          createdAt: Date.now(),
        }));
      }
      const outsideImageId = await ctx.db.insert("gallery", {
        userId: OWNER,
        filename: "outside-folder",
        imageStorageId: sharedStorageId,
        thumbnailStorageId: sharedStorageId,
        createdAt: Date.now(),
      });
      return { sharedStorageId, folderId, imageIds, outsideImageId };
    });

    expect(await asOwner(t).mutation(api.gallery.deleteFolder, { folderId: fixture.folderId })).toEqual({
      success: true,
      deletedImages: 2,
    });
    const state = await t.run(async (ctx) => ({
      folder: await ctx.db.get(fixture.folderId),
      deletedImages: await Promise.all(fixture.imageIds.map((id) => ctx.db.get(id))),
      outsideImage: await ctx.db.get(fixture.outsideImageId),
      metadata: await ctx.db.system.get(fixture.sharedStorageId),
    }));
    expect(state.folder).toBeNull();
    expect(state.deletedImages).toEqual([null, null]);
    expect(state.outsideImage).not.toBeNull();
    expect(state.metadata).not.toBeNull();
  });

  it("fails closed on malformed five-image folders without partial row or blob deletion", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["oversized-folder"], { type: "image/png" }));
      const folderId = await ctx.db.insert("folders", { userId: OWNER, name: "oversized", createdAt: Date.now() });
      const imageIds = [];
      for (let index = 0; index < 5; index += 1) {
        imageIds.push(await ctx.db.insert("gallery", {
          userId: OWNER,
          filename: `oversized-${index}`,
          imageStorageId: storageId,
          thumbnailStorageId: storageId,
          folderId,
          createdAt: Date.now(),
        }));
      }
      return { storageId, folderId, imageIds };
    });

    await expect(
      asOwner(t).mutation(api.gallery.deleteFolder, { folderId: fixture.folderId }),
    ).rejects.toThrow("Folder exceeds the supported four-image deletion limit");
    const state = await t.run(async (ctx) => ({
      folder: await ctx.db.get(fixture.folderId),
      images: await Promise.all(fixture.imageIds.map((id) => ctx.db.get(id))),
      metadata: await ctx.db.system.get(fixture.storageId),
    }));
    expect(state.folder).not.toBeNull();
    expect(state.images.every((image) => image !== null)).toBe(true);
    expect(state.metadata).not.toBeNull();
  });
});
