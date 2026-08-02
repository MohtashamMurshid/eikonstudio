import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard - Eikon Studio",
  description: "View your usage statistics, generation history, and account overview in Eikon Studio.",
  openGraph: {
    title: "Dashboard - Eikon Studio",
    description: "Your Eikon Studio dashboard and analytics.",
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
