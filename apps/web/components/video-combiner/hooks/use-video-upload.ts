import { useState, useCallback } from "react";

export interface ReferenceImage {
  file: File | null;
  preview: string | null;
}

export const useVideoUpload = () => {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([
    { file: null, preview: null },
    { file: null, preview: null },
    { file: null, preview: null },
  ]);

  const handleImageUpload = useCallback((file: File, index: number) => {
    const preview = URL.createObjectURL(file);
    setReferenceImages((prev) => {
      const updated = [...prev];
      // Revoke old preview URL to avoid memory leaks
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated[index] = { file, preview };
      return updated;
    });
  }, []);

  const clearImage = useCallback((index: number) => {
    setReferenceImages((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated[index] = { file: null, preview: null };
      return updated;
    });
  }, []);

  const clearAllImages = useCallback(() => {
    setReferenceImages((prev) => {
      prev.forEach((img) => {
        if (img.preview) {
          URL.revokeObjectURL(img.preview);
        }
      });
      return [
        { file: null, preview: null },
        { file: null, preview: null },
        { file: null, preview: null },
      ];
    });
  }, []);

  const hasAnyImages = referenceImages.some((img) => img.file !== null);
  const getImageFiles = () => referenceImages.map((img) => img.file);

  return {
    referenceImages,
    handleImageUpload,
    clearImage,
    clearAllImages,
    hasAnyImages,
    getImageFiles,
  };
};
