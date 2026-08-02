import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Brand Guidelines - Eikon",
  description: "Official Eikon brand assets, logos, and usage guidelines. Download logos in various formats and learn how to properly represent the Eikon brand.",
  openGraph: {
    title: "Brand Guidelines - Eikon",
    description: "Official brand assets and logo downloads for Eikon Studio.",
  },
}

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
