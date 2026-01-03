import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { ConvexClientProvider } from "./ConvexClientProvider"
import { ClientProviders } from "@/components/client-providers"

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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Don't block on auth token - let client-side handle authentication
  // This allows the page to render immediately while auth loads in background
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
