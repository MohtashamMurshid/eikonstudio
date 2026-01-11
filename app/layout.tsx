import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { ConvexClientProvider } from "./ConvexClientProvider"
import { ClientProviders } from "@/components/client-providers"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "Eikon - AI Image Studio",
  description: "Transform, combine, and generate stunning images with AI. Powered by Google Gemini.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Eikon - AI Image Studio",
    description: "Transform, combine, and generate stunning images with AI. Powered by Google Gemini.",
    siteName: "Eikon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eikon - AI Image Studio",
    description: "Transform, combine, and generate stunning images with AI. Powered by Google Gemini.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Don't block on auth token - let client-side handle authentication
  // This allows the page to render immediately while auth loads in background
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-mono antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider initialToken={null}>
            <Suspense fallback={null}>{children}</Suspense>
            <ClientProviders />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
