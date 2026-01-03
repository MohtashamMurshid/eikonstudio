"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Dithering } from "@paper-design/shaders-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        })
        
        if (error) {
          toast.error(error.message || "Failed to sign in")
          setIsLoading(false)
          return
        }
        
        // Force redirect after successful sign in
        window.location.href = "/"
      } else {
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/",
        })
        
        if (error) {
          toast.error(error.message || "Failed to sign up")
          setIsLoading(false)
          return
        }
        
        // Force redirect after successful sign up
        window.location.href = "/"
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center select-none">
      <div className="fixed inset-0 z-0 select-none pointer-events-none">
        <Dithering
          colorBack="#00000000"
          colorFront="#16a34a"
          speed={0.43}
          shape="wave"
          type="4x4"
          pxSize={3}
          scale={1.13}
          style={{
            backgroundColor: "#000000",
            height: "100vh",
            width: "100vw",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="bg-black/80 backdrop-blur-sm border border-gray-600 p-6 md:p-8 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-8 select-none">
            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <h1 className="text-xl md:text-2xl font-bold text-white select-none">PixelForge</h1>
          </div>

          <div className="flex items-center justify-center mb-6 select-none">
            <div className="inline-flex bg-black/50 border border-gray-600 rounded p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded transition-all",
                  isLogin ? "bg-white text-black" : "text-gray-300 hover:text-white"
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded transition-all",
                  !isLogin ? "bg-white text-black" : "text-gray-300 hover:text-white"
                )}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 select-none">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300 ml-0.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required={!isLogin}
                  className="w-full p-2.5 bg-black/50 border border-gray-600 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-gray-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300 ml-0.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full p-2.5 bg-black/50 border border-gray-600 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300 ml-0.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={8}
                className="w-full p-2.5 bg-black/50 border border-gray-600 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-gray-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 text-sm font-semibold bg-white text-black hover:bg-gray-200 rounded mt-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isLogin ? "Signing in..." : "Creating account..."}
                </span>
              ) : (
                isLogin ? "Sign In" : "Sign Up"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
