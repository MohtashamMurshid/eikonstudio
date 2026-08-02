export const validateImageFormat = (file: File): boolean => {
  const supportedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
    "image/bmp",
    "image/tiff",
  ]

  // Check MIME type first
  if (supportedTypes.includes(file.type.toLowerCase())) {
    return true
  }

  // Fallback: check file extension for HEIC files (browsers sometimes don't set correct MIME type)
  const fileName = file.name.toLowerCase()
  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tiff"]

  return supportedExtensions.some((ext) => fileName.endsWith(ext))
}

export const compressImage = async (file: File, maxWidth = 1280, quality = 0.75): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxWidth) {
          width = (width * maxWidth) / height
          height = maxWidth
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg", // Use JPEG for better compression
              lastModified: Date.now(),
            })
            console.log("Image compressed from", file.size, "to", blob.size, "bytes")
            resolve(compressedFile)
          } else {
            resolve(file) // Fallback to original if compression fails
          }
        },
        "image/jpeg",
        quality,
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

export const convertHeicToPng = async (
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> => {
  try {
    let currentProgress = 0
    onProgress?.(0)

    // Simulate progress during conversion
    const progressInterval = setInterval(() => {
      if (currentProgress >= 95) {
        clearInterval(progressInterval)
        return
      }
      currentProgress = Math.min(currentProgress + Math.random() * 15 + 5, 95)
      onProgress?.(currentProgress)
    }, 50)

    // Import heic-to dynamically
    const { heicTo } = await import("heic-to")

    currentProgress = 70
    onProgress?.(currentProgress)

    const convertedBlob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.9,
    })

    currentProgress = 90
    onProgress?.(currentProgress)

    const convertedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
    })

    clearInterval(progressInterval)
    currentProgress = 100
    onProgress?.(currentProgress)

    // Small delay to show 100%
    await new Promise((resolve) => setTimeout(resolve, 200))

    return convertedFile
  } catch (error) {
    console.error("HEIC conversion error:", error)
    throw new Error("Could not convert HEIC image. Please try using a different image format.")
  }
}

export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
}

