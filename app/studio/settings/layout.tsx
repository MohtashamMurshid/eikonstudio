import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings - Eikon Studio",
  description: "Manage your account settings, API keys, and preferences in Eikon Studio.",
  openGraph: {
    title: "Settings - Eikon Studio",
    description: "Account and API key settings.",
  },
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
