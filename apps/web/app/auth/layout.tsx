import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In - Eikon",
  description: "Sign in to Eikon Studio to access AI-powered image generation, your gallery, and personalized settings.",
  openGraph: {
    title: "Sign In - Eikon",
    description: "Access your Eikon Studio account.",
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
