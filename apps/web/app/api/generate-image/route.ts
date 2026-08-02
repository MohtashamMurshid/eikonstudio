import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { calculateCost, getModelName } from "@/lib/cost-calculator"
import { debug } from "@/lib/debug"

export async function POST(request: NextRequest) {
  try {
    debug("API: Starting image generation request")

    const formData = await request.formData()
    const mode = formData.get("mode") as string
    const prompt = formData.get("prompt") as string
    const aspectRatio = formData.get("aspectRatio") as string
    const imageSize = (formData.get("imageSize") as string) || "2K"
    const customApiKey = formData.get("apiKey") as string

    debug("API: Mode:", mode)
    debug("API: Prompt:", prompt)
    debug("API: Aspect Ratio:", aspectRatio)
    debug("API: Image Size:", imageSize)
    debug("API: Using custom API key:", customApiKey ? "Yes" : "No (using server default)")

    if (!mode || !prompt) {
      debug("API: Missing required fields")
      return NextResponse.json({ error: "Mode and prompt are required" }, { status: 400 })
    }

    // Use custom API key if provided, otherwise fall back to server environment variables
    const apiKeyToUse = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKeyToUse) {
      debug("API: No API key available")
      return NextResponse.json({ 
        error: "No API key configured", 
        details: "Please add your Google Gemini API key in the settings or configure a server-side API key." 
      }, { status: 401 })
    }

    const getAspectRatioString = (ratio: string): string => {
      switch (ratio) {
        case "portrait":
          return "9:16"
        case "landscape":
          return "16:9"
        case "wide":
          return "21:9"
        case "square":
        default:
          return "1:1"
      }
    }

    const aspectRatioString = getAspectRatioString(aspectRatio || "square")
    
    const ai = new GoogleGenAI({
      apiKey: apiKeyToUse,
    })

    let resultUrl: string | null = null
    let resultDescription: string = ""

    if (mode === "text-to-image") {
      debug("API: Using text-to-image mode with Nano Banana 2")
      debug("API: Using aspect_ratio:", aspectRatioString)

      // Using Nano Banana 2 (Gemini 3.1 Flash Image Preview)
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatioString,
            imageSize: imageSize, // 1K, 2K, or 4K
          } as any, // Type assertion needed as types may not be fully updated for Nano Banana models
        },
      })

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from Nano Banana 2")
      }

      const content = response.candidates[0].content
      if (!content || !content.parts) {
        throw new Error("No content parts found in response")
      }

      // Iterate through parts to find the image (inlineData)
      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64Data = part.inlineData.data
          const mimeType = part.inlineData.mimeType || "image/png"
          resultUrl = `data:${mimeType};base64,${base64Data}`
          break
        }
      }

      if (!resultUrl) {
        throw new Error("No image data found in response parts")
      }
    } else if (mode === "image-editing") {
      debug("API: Using image-editing mode")
      debug("API: Using aspect_ratio:", aspectRatioString)

      const image1 = formData.get("image1") as File
      const image2 = formData.get("image2") as File
      const image3 = formData.get("image3") as File
      const image4 = formData.get("image4") as File
      const image1Url = formData.get("image1Url") as string
      const image2Url = formData.get("image2Url") as string
      const image3Url = formData.get("image3Url") as string
      const image4Url = formData.get("image4Url") as string

      // Check if we have at least one image (file or URL)
      const hasImage1 = image1 || image1Url
      const hasImage2 = image2 || image2Url
      const hasImage3 = image3 || image3Url
      const hasImage4 = image4 || image4Url

      if (!hasImage1) {
        debug("API: Missing first image for editing mode")
        return NextResponse.json({ error: "At least one image is required for editing mode" }, { status: 400 })
      }

      debug("API: Converting images to base64")

      const imageUrls: string[] = []

      // Process first image
      if (image1) {
        const image1Buffer = await image1.arrayBuffer()
        const image1Base64 = `data:${image1.type};base64,${Buffer.from(image1Buffer).toString("base64")}`

        if (image1Base64.length > 1500000) {
          debug(
            "API: WARNING - Image1 base64 is very large:",
            image1Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image1Base64)
        debug("API: Image1 base64 length:", image1Base64.length)
      } else if (image1Url) {
        imageUrls.push(image1Url)
        debug("API: Using Image1 URL:", image1Url)
      }

      // Process second image if present
      if (image2) {
        const image2Buffer = await image2.arrayBuffer()
        const image2Base64 = `data:${image2.type};base64,${Buffer.from(image2Buffer).toString("base64")}`

        if (image2Base64.length > 1500000) {
          debug(
            "API: WARNING - Image2 base64 is very large:",
            image2Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image2Base64)
        debug("API: Image2 base64 length:", image2Base64.length)
      } else if (image2Url) {
        imageUrls.push(image2Url)
        debug("API: Using Image2 URL:", image2Url)
      }

      // Process third image if present
      if (image3) {
        const image3Buffer = await image3.arrayBuffer()
        const image3Base64 = `data:${image3.type};base64,${Buffer.from(image3Buffer).toString("base64")}`

        if (image3Base64.length > 1500000) {
          debug(
            "API: WARNING - Image3 base64 is very large:",
            image3Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image3Base64)
        debug("API: Image3 base64 length:", image3Base64.length)
      } else if (image3Url) {
        imageUrls.push(image3Url)
        debug("API: Using Image3 URL:", image3Url)
      }

      // Process fourth image if present
      if (image4) {
        const image4Buffer = await image4.arrayBuffer()
        const image4Base64 = `data:${image4.type};base64,${Buffer.from(image4Buffer).toString("base64")}`

        if (image4Base64.length > 1500000) {
          debug(
            "API: WARNING - Image4 base64 is very large:",
            image4Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image4Base64)
        debug("API: Image4 base64 length:", image4Base64.length)
      } else if (image4Url) {
        imageUrls.push(image4Url)
        debug("API: Using Image4 URL:", image4Url)
      }

      debug("API: Total images for editing:", imageUrls.length)

      // Build image parts (inlineData) for Gemini image model
      const toInlinePart = async (urlOrData: string): Promise<any> => {
        if (urlOrData.startsWith("data:")) {
          const [meta, base64Data] = urlOrData.split(",", 2)
          const mime = meta.substring(5, meta.indexOf(";")) || "image/png"
          return { inlineData: { data: base64Data, mimeType: mime } }
        }
        const resp = await fetch(urlOrData)
        if (!resp.ok) throw new Error("Failed to fetch reference image")
        const buf = Buffer.from(await resp.arrayBuffer())
        const b64 = buf.toString("base64")
        // best guess: default to png
        return { inlineData: { data: b64, mimeType: resp.headers.get("content-type") || "image/png" } }
      }

      const imageParts = [] as any[]
      for (const u of imageUrls) {
        try {
          imageParts.push(await toInlinePart(u))
        } catch (e) {
          debug("API: Skipping invalid image reference:", u)
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: {
          parts: [
            ...imageParts,
            {
              text: prompt,
            },
          ],
        },
      })

      // Extract first inline image from response
      const parts = response?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part?.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png"
          resultUrl = `data:${mime};base64,${part.inlineData.data}`
          break
        }
      }

      if (!resultUrl) {
        throw new Error("No image returned from Google GenAI edit")
      }
    } else {
      debug("API: Invalid mode:", mode)
      return NextResponse.json({ error: "Invalid mode. Must be 'text-to-image' or 'image-editing'" }, { status: 400 })
    }

    if (!resultUrl) {
      debug("API: No images in response")
      throw new Error("No images generated")
    }

    const imageUrl = resultUrl
    const description = resultDescription

    // Calculate cost for this generation
    const estimatedCost = calculateCost(imageSize, mode as "text-to-image" | "image-editing")
    const model = getModelName()

    debug("API: Generated image URL:", imageUrl)
    debug("API: Estimated cost:", estimatedCost)

    return NextResponse.json({
      url: imageUrl,
      prompt: prompt,
      description: description,
      estimatedCost,
      model,
    })
  } catch (error) {
    console.error("API: Error generating image:", error)
    console.error("API: Error type:", typeof error)
    console.error("API: Error constructor:", error?.constructor?.name)

    // Try to log the full error object structure
    try {
      console.error("API: Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    } catch (e) {
      console.error("API: Could not stringify error")
    }

    // Log specific error properties
    if (error && typeof error === "object") {
      console.error("API: Error keys:", Object.keys(error))
      console.error("API: Error message:", (error as any).message)
      console.error("API: Error status:", (error as any).status)
      console.error("API: Error statusCode:", (error as any).statusCode)
      console.error("API: Error body:", (error as any).body)
      console.error("API: Error response:", (error as any).response)
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    const errorDetails =
      error && typeof error === "object"
        ? (error as any).body || (error as any).message || JSON.stringify(error)
        : String(error)

    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: errorDetails,
      },
      { status: 500 },
    )
  }
}
