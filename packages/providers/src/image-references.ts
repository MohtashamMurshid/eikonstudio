import { z } from "zod";
import { OwnedEikonMediaReferenceSchema } from "@eikonstudio/core";
import { ProviderInputValidationError } from "./openai/errors.js";

export const IMAGE_MAX_REFERENCE_BYTES = 25_000_000;
const referenceSchema = z
  .object({
    mediaType: z.literal("image"),
    contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    reference: OwnedEikonMediaReferenceSchema,
  })
  .strict();
export type ImageReference = z.infer<typeof referenceSchema>;
export type ResolvedImage = { bytes: Uint8Array; contentType: string };
/** The server must bind reads to the authenticated job's exact stored references. No URLs are fetched here. */
export type ServerImageResolver = (reference: ImageReference) => Promise<ResolvedImage>;

export function parseImageReferences(value: unknown, editing: boolean): ImageReference[] {
  const parsed = z
    .array(referenceSchema)
    .min(editing ? 1 : 0)
    .max(editing ? 4 : 0)
    .safeParse(value);
  if (!parsed.success) throw new ProviderInputValidationError();
  return parsed.data;
}

export async function resolveImageReferences(
  references: ImageReference[],
  resolver: ServerImageResolver | undefined,
): Promise<ResolvedImage[]> {
  const images: ResolvedImage[] = [];
  for (const reference of references) {
    if (!resolver) throw new ProviderInputValidationError();
    const image = await resolver(reference);
    if (
      !(image.bytes instanceof Uint8Array) ||
      image.bytes.byteLength < 1 ||
      image.bytes.byteLength > IMAGE_MAX_REFERENCE_BYTES ||
      image.contentType !== reference.contentType
    ) {
      throw new ProviderInputValidationError();
    }
    images.push(image);
  }
  return images;
}
