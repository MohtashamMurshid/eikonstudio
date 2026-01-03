import { useState } from "react"
import { validateImageFormat, compressImage, convertHeicToPng } from "../utils/image-processing"

interface UseImageUploadOptions {
  onError?: (message: string) => void
}

export const useImageUpload = ({ onError }: UseImageUploadOptions = {}) => {
  const [image1, setImage1] = useState<File | null>(null)
  const [image1Preview, setImage1Preview] = useState<string>("")
  const [image1Url, setImage1Url] = useState<string>("")
  const [image2, setImage2] = useState<File | null>(null)
  const [image2Preview, setImage2Preview] = useState<string>("")
  const [image2Url, setImage2Url] = useState<string>("")
  const [useUrls, setUseUrls] = useState<boolean>(false)
  const [isConvertingHeic, setIsConvertingHeic] = useState(false)
  const [heicProgress, setHeicProgress] = useState(0)

  const handleImageUpload = async (file: File, imageNumber: 1 | 2) => {
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
      }
      if (imageNumber === 2) {
        setImage2(processedFile)
        setImage2Preview(result)
        console.log("Image 2 preview set:", result.substring(0, 50) + "...")
      }
    }
    reader.onerror = (error) => {
      console.error("Error reading file:", error)
      onError?.("Error reading the image file. Please try again.")
    }
    reader.readAsDataURL(processedFile)
  }

  const handleUrlChange = (url: string, imageNumber: 1 | 2) => {
    console.log("URL changed for image", imageNumber, ":", url)
    if (imageNumber === 1) {
      setImage1Url(url)
      setImage1Preview(url)
      setImage1(null)
    }
    if (imageNumber === 2) {
      setImage2Url(url)
      setImage2Preview(url)
      setImage2(null)
    }
  }

  const clearImage = (imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      setImage1(null)
      setImage1Preview("")
      setImage1Url("")
    } else {
      setImage2(null)
      setImage2Preview("")
      setImage2Url("")
    }
  }

  const hasImages = useUrls ? image1Url || image2Url : image1 || image2

  return {
    image1,
    image1Preview,
    image1Url,
    image2,
    image2Preview,
    image2Url,
    useUrls,
    setUseUrls,
    isConvertingHeic,
    heicProgress,
    handleImageUpload,
    handleUrlChange,
    clearImage,
    hasImages,
  }
}

