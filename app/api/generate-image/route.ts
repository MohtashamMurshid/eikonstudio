import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

// Configure fal with API key
fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] API: Starting image generation request")

    const formData = await request.formData()
    const mode = formData.get("mode") as string
    const prompt = formData.get("prompt") as string
    const aspectRatio = formData.get("aspectRatio") as string

    console.log("[v0] API: Mode:", mode)
    console.log("[v0] API: Prompt:", prompt)
    console.log("[v0] API: Aspect Ratio:", aspectRatio)

    if (!mode || !prompt) {
      console.log("[v0] API: Missing required fields")
      return NextResponse.json({ error: "Mode and prompt are required" }, { status: 400 })
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

    let result: any

    if (mode === "text-to-image") {
      console.log("[v0] API: Using text-to-image mode")
      console.log("[v0] API: Using aspect_ratio:", aspectRatioString)

      result = await fal.subscribe("fal-ai/nano-banana", {
        input: {
          prompt: prompt,
          num_images: 1,
          output_format: "png",
          aspect_ratio: aspectRatioString,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs?.map((log) => log.message).forEach(console.log)
          }
        },
      })
    } else if (mode === "image-editing") {
      console.log("[v0] API: Using image-editing mode")
      console.log("[v0] API: Using aspect_ratio:", aspectRatioString)

      const image1 = formData.get("image1") as File
      const image2 = formData.get("image2") as File
      const image1Url = formData.get("image1Url") as string
      const image2Url = formData.get("image2Url") as string

      // Check if we have at least one image (file or URL)
      const hasImage1 = image1 || image1Url
      const hasImage2 = image2 || image2Url

      if (!hasImage1) {
        console.log("[v0] API: Missing first image for editing mode")
        return NextResponse.json({ error: "At least one image is required for editing mode" }, { status: 400 })
      }

      console.log("[v0] API: Converting images to base64")

      const imageUrls: string[] = []

      // Process first image
      if (image1) {
        const image1Buffer = await image1.arrayBuffer()
        const image1Base64 = `data:${image1.type};base64,${Buffer.from(image1Buffer).toString("base64")}`

        if (image1Base64.length > 1500000) {
          console.log(
            "[v0] API: WARNING - Image1 base64 is very large:",
            image1Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image1Base64)
        console.log("[v0] API: Image1 base64 length:", image1Base64.length)
      } else if (image1Url) {
        imageUrls.push(image1Url)
        console.log("[v0] API: Using Image1 URL:", image1Url)
      }

      // Process second image if present
      if (image2) {
        const image2Buffer = await image2.arrayBuffer()
        const image2Base64 = `data:${image2.type};base64,${Buffer.from(image2Buffer).toString("base64")}`

        if (image2Base64.length > 1500000) {
          console.log(
            "[v0] API: WARNING - Image2 base64 is very large:",
            image2Base64.length,
            "bytes. This may cause issues.",
          )
        }

        imageUrls.push(image2Base64)
        console.log("[v0] API: Image2 base64 length:", image2Base64.length)
      } else if (image2Url) {
        imageUrls.push(image2Url)
        console.log("[v0] API: Using Image2 URL:", image2Url)
      }

      console.log("[v0] API: Total images for editing:", imageUrls.length)

      let retries = 2
      let lastError: any = null

      while (retries >= 0) {
        try {
          result = await fal.subscribe("fal-ai/nano-banana/edit", {
            input: {
              prompt: prompt,
              image_urls: imageUrls,
              output_format: "png",
              aspect_ratio: aspectRatioString,
            },
            logs: true,
            onQueueUpdate: (update) => {
              if (update.status === "IN_PROGRESS") {
                update.logs?.map((log) => log.message).forEach(console.log)
              }
            },
          })
          break // Success, exit retry loop
        } catch (error) {
          lastError = error
          retries--
          if (retries >= 0) {
            console.log(`[v0] API: Request failed, retrying... (${retries} retries left)`)
            await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second before retry
          }
        }
      }

      if (retries < 0 && lastError) {
        throw lastError // All retries failed, throw the last error
      }
    } else {
      console.log("[v0] API: Invalid mode:", mode)
      return NextResponse.json({ error: "Invalid mode. Must be 'text-to-image' or 'image-editing'" }, { status: 400 })
    }

    console.log("[v0] API: Fal response received")
    console.log("[v0] API: Result data:", JSON.stringify(result.data, null, 2))

    if (!result.data || !result.data.images || result.data.images.length === 0) {
      console.log("[v0] API: No images in response")
      throw new Error("No images generated")
    }

    const imageUrl = result.data.images[0].url
    const description = result.data.description || ""

    console.log("[v0] API: Generated image URL:", imageUrl)
    console.log("[v0] API: AI Description:", description)

    return NextResponse.json({
      url: imageUrl,
      prompt: prompt,
      description: description,
    })
  } catch (error) {
    console.error("[v0] API: Error generating image:", error)
    console.error("[v0] API: Error type:", typeof error)
    console.error("[v0] API: Error constructor:", error?.constructor?.name)

    // Try to log the full error object structure
    try {
      console.error("[v0] API: Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    } catch (e) {
      console.error("[v0] API: Could not stringify error")
    }

    // Log specific error properties
    if (error && typeof error === "object") {
      console.error("[v0] API: Error keys:", Object.keys(error))
      console.error("[v0] API: Error message:", (error as any).message)
      console.error("[v0] API: Error status:", (error as any).status)
      console.error("[v0] API: Error statusCode:", (error as any).statusCode)
      console.error("[v0] API: Error body:", (error as any).body)
      console.error("[v0] API: Error response:", (error as any).response)
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
