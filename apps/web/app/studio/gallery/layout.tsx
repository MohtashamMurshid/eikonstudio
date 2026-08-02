import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gallery - Eikon Studio",
  description: "Manage your image library. Organize, rename, and reference your uploaded images in prompts.",
  openGraph: {
    title: "Gallery - Eikon Studio",
    description: "Your personal image library in Eikon Studio.",
  },
}

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
