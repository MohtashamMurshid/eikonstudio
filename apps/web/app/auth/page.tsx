import { redirect } from "next/navigation"
import AuthPageClient from "@/components/auth/auth-page-client"
import { isAuthenticated } from "@/lib/auth-server"

export default async function AuthPage() {
  if (await isAuthenticated()) {
    redirect("/studio")
  }

  return <AuthPageClient />
}
