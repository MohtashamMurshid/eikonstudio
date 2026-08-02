import { fetchAction } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

type GenerateApiRequest = {
  prompt?: string;
  provider?: "gemini" | "openai";
  model?: string;
  imageSize?: string;
  aspectRatio?: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
};

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get("authorization");
    const headerApiKey = request.headers.get("x-api-key");
    const platformApiKey =
      (authorizationHeader?.startsWith("Bearer ")
        ? authorizationHeader.slice("Bearer ".length).trim()
        : null) || headerApiKey?.trim();

    if (!platformApiKey) {
      return NextResponse.json(
        {
          error: "Missing API key",
          details: "Provide your platform API key in the Authorization header or x-api-key.",
        },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const body = (await request.json()) as GenerateApiRequest;
    const prompt = body.prompt?.trim();
    const provider = body.provider;
    const imageSize = body.imageSize ?? "2K";
    const aspectRatio = body.aspectRatio ?? "square";

    if (!prompt) {
      return NextResponse.json(
        {
          error: "Missing required field",
          details: "'prompt' is required and cannot be empty",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (provider !== "gemini" && provider !== "openai") {
      return NextResponse.json(
        {
          error: "Invalid provider",
          details: "provider must be one of: gemini, openai",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!["1K", "2K", "4K"].includes(imageSize)) {
      return NextResponse.json(
        {
          error: "Invalid imageSize",
          details: "imageSize must be one of: 1K, 2K, 4K",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!["square", "portrait", "landscape", "wide"].includes(aspectRatio)) {
      return NextResponse.json(
        {
          error: "Invalid aspectRatio",
          details: "aspectRatio must be one of: square, portrait, landscape, wide",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const result = await fetchAction(api.apiKeyActions.generateGatewayImage, {
      platformApiKey,
      provider,
      prompt,
      imageSize,
      aspectRatio,
      model: body.model,
    });

    return NextResponse.json(result, {
      headers: CORS_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Invalid API key" ? 401 : 500;

    return NextResponse.json(
      {
        error: status === 401 ? "Unauthorized" : "Failed to generate image",
        details: message,
      },
      {
        status,
        headers: CORS_HEADERS,
      },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
