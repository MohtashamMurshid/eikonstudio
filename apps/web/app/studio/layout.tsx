import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import StudioLayoutClient from "@/components/studio/studio-layout-client"
import { isAuthenticated } from "@/lib/auth-server"

export default async function StudioLayout({ children }: { children: ReactNode }) {
  if (!(await isAuthenticated())) {
    redirect("/auth")
  }

  return <StudioLayoutClient>{children}</StudioLayoutClient>
}

