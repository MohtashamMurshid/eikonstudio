import type { Id } from "@/convex/_generated/dataModel"

export const createThumbnailBlob = async (imageDataUrl: string, size = 250): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }
      
      let width = size
      let height = size
      
      if (img.width > img.height) {
        height = (img.height / img.width) * size
      } else {
        width = (img.width / img.height) * size
      }
      
      canvas.width = size
      canvas.height = size
      
      const x = (size - width) / 2
      const y = (size - height) / 2
      
      ctx.fillStyle = "#f5f5f5"
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, x, y, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Could not create blob"))
          }
        },
        "image/jpeg",
        0.7
      )
    }
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = imageDataUrl
  })
}

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl)
  return await response.blob()
}

export const uploadToStorage = async (
  blob: Blob,
  generateUploadUrl: () => Promise<string>
): Promise<Id<"_storage">> => {
  const uploadUrl = await generateUploadUrl()
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  })
  const { storageId } = await response.json()
  return storageId
}

