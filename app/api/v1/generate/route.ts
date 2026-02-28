import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: NextRequest) {
  try {
    console.log("API v1: Starting image generation request")

    let body: any
    let contentType = request.headers.get("content-type") || ""

    let prompt: string
    let imageSize: string
    let aspectRatio = "square"
    let mode = "text-to-image"
    let apiKey: string | undefined
    let images: string[] = []

    if (contentType.includes("multipart/form-data")) {
      console.log("API v1: Processing FormData request")
      const formData = await request.formData()
      
      prompt = formData.get("prompt") as string
      imageSize = (formData.get("imageSize") as string) || "2K"
      aspectRatio = (formData.get("aspectRatio") as string) || "square"
      mode = (formData.get("mode") as string) || "text-to-image"
      apiKey = formData.get("apiKey") as string | undefined

      const imageFiles = formData.getAll("images") as File[]
      
      if (imageFiles.length > 0) {
        console.log(`API v1: Processing ${imageFiles.length} image files`)
        for (const imageFile of imageFiles) {
          const buffer = await imageFile.arrayBuffer()
          const base64 = `data:${imageFile.type};base64,${Buffer.from(buffer).toString("base64")}`
          images.push(base64)
        }
      }
    } else {
      console.log("API v1: Processing JSON request")
      body = await request.json()
      
      prompt = body.prompt
      imageSize = body.imageSize || "2K"
      aspectRatio = body.aspectRatio || "square"
      mode = body.mode || "text-to-image"
      apiKey = body.apiKey

      if (Array.isArray(body.images)) {
        images = body.images.filter((img: any) => typeof img === "string" && img.length > 0)
      }
    }

    console.log("API v1: Prompt:", prompt)
    console.log("API v1: Image Size:", imageSize)
    console.log("API v1: Aspect Ratio:", aspectRatio)
    console.log("API v1: Mode:", mode)
    console.log("API v1: Number of images:", images.length)

    if (!prompt || prompt.trim().length === 0) {
      console.log("API v1: Missing required field: prompt")
      return NextResponse.json(
        { error: "Missing required field", details: "'prompt' is required and cannot be empty" },
        { status: 400 }
      )
    }

    if (!imageSize) {
      console.log("API v1: Missing required field: imageSize")
      return NextResponse.json(
        { error: "Missing required field", details: "'imageSize' is required. Valid values: 1K, 2K, 4K" },
        { status: 400 }
      )
    }

    const validImageSizes = ["1K", "2K", "4K"]
    if (!validImageSizes.includes(imageSize)) {
      console.log("API v1: Invalid imageSize:", imageSize)
      return NextResponse.json(
        { error: "Invalid imageSize", details: `imageSize must be one of: ${validImageSizes.join(", ")}` },
        { status: 400 }
      )
    }

    const validAspectRatios = ["square", "portrait", "landscape", "wide"]
    if (!validAspectRatios.includes(aspectRatio)) {
      console.log("API v1: Invalid aspectRatio:", aspectRatio)
      return NextResponse.json(
        { error: "Invalid aspectRatio", details: `aspectRatio must be one of: ${validAspectRatios.join(", ")}` },
        { status: 400 }
      )
    }

    const validModes = ["text-to-image", "image-editing"]
    if (!validModes.includes(mode)) {
      console.log("API v1: Invalid mode:", mode)
      return NextResponse.json(
        { error: "Invalid mode", details: `mode must be one of: ${validModes.join(", ")}` },
        { status: 400 }
      )
    }

    if (mode === "image-editing" && images.length === 0) {
      console.log("API v1: image-editing mode requires at least one image")
      return NextResponse.json(
        { error: "Missing images", details: "image-editing mode requires at least one image" },
        { status: 400 }
      )
    }

    const apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKeyToUse) {
      console.log("API v1: No API key available")
      return NextResponse.json(
        { error: "No API key configured", details: "Please provide an apiKey in the request or configure a server-side API key" },
        { status: 401 }
      )
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

    const aspectRatioString = getAspectRatioString(aspectRatio)
    
    const ai = new GoogleGenAI({
      apiKey: apiKeyToUse,
    })

    let resultUrl: string | null = null

    if (mode === "text-to-image") {
      console.log("API v1: Using text-to-image mode with Nano Banana 2")

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
            imageSize: imageSize,
          } as any,
        },
      })

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from Nano Banana 2")
      }

      const content = response.candidates[0].content
      if (!content || !content.parts) {
        throw new Error("No content parts found in response")
      }

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
      console.log("API v1: Using image-editing mode")

      const toInlinePart = async (urlOrData: string): Promise<any> => {
        if (urlOrData.startsWith("data:")) {
          const [meta, base64Data] = urlOrData.split(",", 2)
          const mime = meta.substring(5, meta.indexOf(";")) || "image/png"
          return { inlineData: { data: base64Data, mimeType: mime } }
        }
        const resp = await fetch(urlOrData)
        if (!resp.ok) throw new Error(`Failed to fetch reference image: ${resp.status}`)
        const buf = Buffer.from(await resp.arrayBuffer())
        const b64 = buf.toString("base64")
        return { inlineData: { data: b64, mimeType: resp.headers.get("content-type") || "image/png" } }
      }

      const imageParts: any[] = []
      for (const img of images) {
        try {
          imageParts.push(await toInlinePart(img))
        } catch (e) {
          console.log("API v1: Skipping invalid image:", e)
        }
      }

      if (imageParts.length === 0) {
        throw new Error("No valid images provided")
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
    }

    if (!resultUrl) {
      throw new Error("No images generated")
    }

    console.log("API v1: Image generated successfully")

    return NextResponse.json({
      url: resultUrl,
      prompt: prompt,
      description: "",
      metadata: {
        imageSize: imageSize,
        aspectRatio: aspectRatio,
        mode: mode,
      },
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("API v1: Error:", error)

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
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
