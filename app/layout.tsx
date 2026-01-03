import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { ConvexClientProvider } from "./ConvexClientProvider"
import { ClientProviders } from "@/components/client-providers"
import { getToken } from "@/lib/auth-server"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "PixelForge - AI Image Generator",
  description: "Generate and edit stunning images with AI. Powered by Google Gemini.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch token non-blocking - don't await, let client handle auth state
  // This allows the page to render immediately while auth loads in background
  const tokenPromise = getToken().catch(() => null)
  
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-mono antialiased">
        <ConvexClientProvider initialToken={null}>
          <Suspense fallback={null}>{children}</Suspense>
          <ClientProviders />
        </ConvexClientProvider>
      </body>
    </html>
  )
}
