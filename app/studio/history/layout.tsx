import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "History - Eikon Studio",
  description: "View your generation history. Browse, download, and reuse your previously generated images.",
  openGraph: {
    title: "History - Eikon Studio",
    description: "Your AI image generation history.",
  },
}

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
