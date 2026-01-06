import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create - Eikon Studio",
  description: "Generate AI-powered images with text prompts or edit existing images. Use Eikon's creative studio for text-to-image and image editing.",
  openGraph: {
    title: "Create - Eikon Studio",
    description: "AI-powered image generation and editing studio.",
  },
}

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
