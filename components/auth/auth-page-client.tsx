"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { Loader2 } from "lucide-react"

export default function AuthPageClient() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isLogin) {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/studio",
        })

        if (error) {
          toast.error(error.message || "Failed to sign in")
          setIsLoading(false)
          return
        }

        window.location.href = "/studio"
      } else {
        const derivedName = email?.split("@")?.[0]?.trim() || "User"
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: derivedName,
          callbackURL: "/studio",
        })

        if (error) {
          toast.error(error.message || "Failed to sign up")
          setIsLoading(false)
          return
        }

        window.location.href = "/"
      }
    } catch {
      toast.error("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/studio",
      })
    } catch {
      toast.error("Failed to sign in with Google")
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-[520px] xl:w-[560px] bg-gradient-to-b from-background to-secondary flex flex-col min-h-screen relative">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='currentColor' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative p-8">
          <Logo size="md" />
        </div>

        <div className="relative flex-1 flex flex-col justify-center px-8 lg:px-12 pb-16">
          <div className="mb-10">
            <h1 className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight leading-[1.15] mb-3">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {isLogin
                ? "Enter your credentials to access your workspace"
                : "Start creating stunning AI-generated images in seconds"}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground/70 block">Email address</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full h-13 pl-12 pr-4 bg-muted rounded-xl border border-border text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-border transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-card-foreground/70 block">Password</label>
                  {isLogin && (
                    <button type="button" className="text-xs font-medium text-muted-foreground hover:text-card-foreground transition-colors">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={8}
                    className="w-full h-13 pl-12 pr-4 bg-muted rounded-xl border border-border text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-border transition-all"
                  />
                </div>
                {!isLogin && (
                  <p className="text-xs text-muted-foreground/60 mt-1.5">Must be at least 8 characters</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-13 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-[0.99]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {isLogin ? "Sign in" : "Create account"}
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground">or continue with</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
              className="w-full h-13 bg-card border border-border rounded-xl font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {isGoogleLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <svg className="size-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-foreground hover:underline underline-offset-4 transition-colors"
            >
              {isLogin ? "Sign up for free" : "Sign in"}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:block flex-1 relative overflow-hidden">
        <img
          src="/new-auth-pic.png"
          alt="Abstract visualization"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/5" />
      </div>
    </div>
  )
}
