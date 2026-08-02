import { useCallback, useState } from "react"
import { validateImageFormat, compressImage, convertHeicToPng } from "../utils/image-processing"

interface UseImageUploadOptions {
  onError?: (message: string) => void
}

export type ImageSlot = 1 | 2 | 3 | 4

/**
 * Hook for uploading images
 * @param options - The options for the hook
 * @returns The image upload hook
 */
export const useImageUpload = ({ onError }: UseImageUploadOptions = {}) => {
  const [image1, setImage1] = useState<File | null>(null)
  const [image1Preview, setImage1Preview] = useState<string>("")
  const [image1Url, setImage1Url] = useState<string>("")
  const [image2, setImage2] = useState<File | null>(null)
  const [image2Preview, setImage2Preview] = useState<string>("")
  const [image2Url, setImage2Url] = useState<string>("")
  const [image3, setImage3] = useState<File | null>(null)
  const [image3Preview, setImage3Preview] = useState<string>("")
  const [image3Url, setImage3Url] = useState<string>("")
  const [image4, setImage4] = useState<File | null>(null)
  const [image4Preview, setImage4Preview] = useState<string>("")
  const [image4Url, setImage4Url] = useState<string>("")
  const [useUrls, setUseUrls] = useState<boolean>(false)
  const [isConvertingHeic, setIsConvertingHeic] = useState(false)
  const [heicProgress, setHeicProgress] = useState(0)

  const switchToFileMode = useCallback(() => {
    setUseUrls(false)
    setImage1Url("")
    setImage2Url("")
    setImage3Url("")
    setImage4Url("")

    if (!image1) setImage1Preview("")
    if (!image2) setImage2Preview("")
    if (!image3) setImage3Preview("")
    if (!image4) setImage4Preview("")
  }, [image1, image2, image3, image4])

  const handleImageUpload = async (file: File, imageNumber: ImageSlot) => {
    console.log("Uploading image:", file.name, "for position:", imageNumber)

    if (!validateImageFormat(file)) {
      onError?.("Please select a valid image file.")
      return
    }

    let processedFile = file
    const isHeic =
      file.type.toLowerCase().includes("heic") ||
      file.type.toLowerCase().includes("heif") ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif")

    if (isHeic) {
      try {
        console.log("Converting HEIC image to JPEG...")
        setIsConvertingHeic(true)
        setHeicProgress(0)
        processedFile = await convertHeicToPng(file, (progress) => {
          setHeicProgress(progress)
        })
        console.log("HEIC conversion successful")
        setIsConvertingHeic(false)
        setHeicProgress(0)
      } catch (error) {
        console.error("Error converting HEIC:", error)
        setIsConvertingHeic(false)
        setHeicProgress(0)
        onError?.("Error converting HEIC image. Please try a different format.")
        return
      }
    }

    try {
      console.log("Compressing image for optimal API performance...")
      processedFile = await compressImage(processedFile)
      console.log("Image compression successful")
    } catch (error) {
      console.error("Error compressing image:", error)
      // Continue with uncompressed image if compression fails
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      console.log("Image loaded successfully, setting preview for image", imageNumber)
      if (imageNumber === 1) {
        setImage1(processedFile)
        setImage1Preview(result)
        console.log("Image 1 preview set:", result.substring(0, 50) + "...")
      } else if (imageNumber === 2) {
        setImage2(processedFile)
        setImage2Preview(result)
        console.log("Image 2 preview set:", result.substring(0, 50) + "...")
      } else if (imageNumber === 3) {
        setImage3(processedFile)
        setImage3Preview(result)
        console.log("Image 3 preview set:", result.substring(0, 50) + "...")
      } else if (imageNumber === 4) {
        setImage4(processedFile)
        setImage4Preview(result)
        console.log("Image 4 preview set:", result.substring(0, 50) + "...")
      }
    }
    reader.onerror = (error) => {
      console.error("Error reading file:", error)
      onError?.("Error reading the image file. Please try again.")
    }
    reader.readAsDataURL(processedFile)
  }

  const handleUrlChange = (url: string, imageNumber: ImageSlot) => {
    console.log("URL changed for image", imageNumber, ":", url)
    if (imageNumber === 1) {
      setImage1Url(url)
      setImage1Preview(url)
      setImage1(null)
    } else if (imageNumber === 2) {
      setImage2Url(url)
      setImage2Preview(url)
      setImage2(null)
    } else if (imageNumber === 3) {
      setImage3Url(url)
      setImage3Preview(url)
      setImage3(null)
    } else if (imageNumber === 4) {
      setImage4Url(url)
      setImage4Preview(url)
      setImage4(null)
    }
  }

  const clearImage = (imageNumber: ImageSlot) => {
    if (imageNumber === 1) {
      setImage1(null)
      setImage1Preview("")
      setImage1Url("")
    } else if (imageNumber === 2) {
      setImage2(null)
      setImage2Preview("")
      setImage2Url("")
    } else if (imageNumber === 3) {
      setImage3(null)
      setImage3Preview("")
      setImage3Url("")
    } else if (imageNumber === 4) {
      setImage4(null)
      setImage4Preview("")
      setImage4Url("")
    }
  }

  const clearAllImages = () => {
    setImage1(null)
    setImage1Preview("")
    setImage1Url("")
    setImage2(null)
    setImage2Preview("")
    setImage2Url("")
    setImage3(null)
    setImage3Preview("")
    setImage3Url("")
    setImage4(null)
    setImage4Preview("")
    setImage4Url("")
  }

  // Find first available slot (1-4)
  const getFirstAvailableSlot = (): ImageSlot | null => {
    if (!image1 && !image1Url) return 1
    if (!image2 && !image2Url) return 2
    if (!image3 && !image3Url) return 3
    if (!image4 && !image4Url) return 4
    return null
  }

  const hasImages = useUrls 
    ? image1Url || image2Url || image3Url || image4Url 
    : image1 || image2 || image3 || image4

  const imageCount = [image1 || image1Url, image2 || image2Url, image3 || image3Url, image4 || image4Url]
    .filter(Boolean).length

  return {
    image1,
    image1Preview,
    image1Url,
    image2,
    image2Preview,
    image2Url,
    image3,
    image3Preview,
    image3Url,
    image4,
    image4Preview,
    image4Url,
    useUrls,
    setUseUrls,
    switchToFileMode,
    isConvertingHeic,
    heicProgress,
    handleImageUpload,
    handleUrlChange,
    clearImage,
    clearAllImages,
    getFirstAvailableSlot,
    hasImages,
    imageCount,
  }
}

