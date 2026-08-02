import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "API Documentation - Eikon",
  description: "Integrate Eikon's AI-powered image generation into your applications with our REST API. Generate, transform, and combine images programmatically.",
  openGraph: {
    title: "API Documentation - Eikon",
    description: "REST API for AI-powered image generation. Generate images with text prompts or edit existing images.",
  },
}

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
