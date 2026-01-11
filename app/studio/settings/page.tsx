"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import Image from "next/image"
import type { Id } from "@/convex/_generated/dataModel"

// Predefined skills - imported from constants for display
const predefinedSkills = [
  { name: "technical", description: "Technical diagram style" },
  { name: "infographic", description: "Infographic visualization" },
  { name: "anime", description: "Japanese anime style" },
  { name: "portrait", description: "Professional portrait" },
  { name: "cinematic", description: "Movie-like composition" },
  { name: "minimal", description: "Clean minimalist design" },
  { name: "watercolor", description: "Watercolor painting style" },
  { name: "3d", description: "3D rendered look" },
  { name: "pixel", description: "Pixel art style" },
  { name: "sketch", description: "Hand-drawn sketch" },
]

type SettingsSection = "profile" | "api-keys" | "skills" | "account"

const navigationItems = [
  {
    id: "profile" as const,
    label: "Profile",
    description: "Your personal information",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: "api-keys" as const,
    label: "API Keys",
    description: "Manage your API credentials",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    id: "skills" as const,
    label: "Skills",
    description: "Manage prompt modifiers",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    id: "account" as const,
    label: "Account",
    description: "Account settings & security",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile")
  const [pendingApiKey, setPendingApiKey] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // User data
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  
  const displayName = user?.name || session?.user?.name || "User"
  const displayEmail = user?.email || session?.user?.email || ""
  const displayImage = user?.image || session?.user?.image

  // Secure API key storage
  const storedApiKey = useQuery(api.apiKeys.getApiKey, {})
  const saveApiKeyMutation = useMutation(api.apiKeys.saveApiKey)
  const deleteApiKeyMutation = useMutation(api.apiKeys.deleteApiKey)
  const testApiKeyAction = useAction(api.apiKeys.testApiKey)

  // Skills management
  const customSkills = useQuery(api.skills.getMySkills, {})
  const createSkillMutation = useMutation(api.skills.createSkill)
  const updateSkillMutation = useMutation(api.skills.updateSkill)
  const deleteSkillMutation = useMutation(api.skills.deleteSkill)
  
  const [newSkillName, setNewSkillName] = useState("")
  const [newSkillDescription, setNewSkillDescription] = useState("")
  const [newSkillPrompt, setNewSkillPrompt] = useState("")
  const [isCreatingSkill, setIsCreatingSkill] = useState(false)
  const [skillError, setSkillError] = useState<string | null>(null)
  const [skillSuccess, setSkillSuccess] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<{ id: Id<"skills">; name: string; description: string; promptText: string } | null>(null)
  const [deletingSkillId, setDeletingSkillId] = useState<Id<"skills"> | null>(null)

  // Initialize pending key from stored key
  useEffect(() => {
    if (storedApiKey?.apiKey) {
      setPendingApiKey(storedApiKey.apiKey)
    }
  }, [storedApiKey?.apiKey])

  const handleTestKey = async () => {
    if (!pendingApiKey.trim()) {
      setTestResult({ valid: false, message: "Please enter an API key first" })
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setSaveSuccess(false)

    try {
      const result = await testApiKeyAction({ apiKey: pendingApiKey })
      setTestResult(result)
    } catch (error) {
      setTestResult({ valid: false, message: "Failed to test API key" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveKey = async () => {
    if (!pendingApiKey.trim()) return

    setIsSaving(true)
    setSaveSuccess(false)
    setTestResult(null)

    try {
      await saveApiKeyMutation({ apiKey: pendingApiKey })
      setSaveSuccess(true)
      localStorage.setItem("gemini-api-key", pendingApiKey)
    } catch (error) {
      setTestResult({ valid: false, message: "Failed to save API key" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteKey = async () => {
    setIsDeleting(true)
    setSaveSuccess(false)
    setTestResult(null)

    try {
      await deleteApiKeyMutation({})
      setPendingApiKey("")
      localStorage.removeItem("gemini-api-key")
    } catch (error) {
      setTestResult({ valid: false, message: "Failed to delete API key" })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth")
        },
      },
    })
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const hasStoredKey = !!storedApiKey?.apiKey
  const hasChanges = pendingApiKey !== (storedApiKey?.apiKey || "")

  // Skill handlers
  const handleCreateSkill = async () => {
    if (!newSkillName.trim() || !newSkillDescription.trim() || !newSkillPrompt.trim()) {
      setSkillError("All fields are required")
      return
    }

    setIsCreatingSkill(true)
    setSkillError(null)
    setSkillSuccess(null)

    try {
      await createSkillMutation({
        name: newSkillName,
        description: newSkillDescription,
        promptText: newSkillPrompt,
      })
      setNewSkillName("")
      setNewSkillDescription("")
      setNewSkillPrompt("")
      setSkillSuccess("Skill created successfully!")
      setTimeout(() => setSkillSuccess(null), 3000)
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "Failed to create skill")
    } finally {
      setIsCreatingSkill(false)
    }
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill) return

    setSkillError(null)
    setSkillSuccess(null)

    try {
      await updateSkillMutation({
        skillId: editingSkill.id,
        name: editingSkill.name,
        description: editingSkill.description,
        promptText: editingSkill.promptText,
      })
      setEditingSkill(null)
      setSkillSuccess("Skill updated successfully!")
      setTimeout(() => setSkillSuccess(null), 3000)
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "Failed to update skill")
    }
  }

  const handleDeleteSkill = async (skillId: Id<"skills">) => {
    setDeletingSkillId(skillId)
    setSkillError(null)
    setSkillSuccess(null)

    try {
      await deleteSkillMutation({ skillId })
      setSkillSuccess("Skill deleted successfully!")
      setTimeout(() => setSkillSuccess(null), 3000)
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "Failed to delete skill")
    } finally {
      setDeletingSkillId(null)
    }
  }

  return (
    <div className="min-h-full p-2 md:p-3 lg:p-4">
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden min-h-[calc(100vh-2rem)]">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-2rem)]">
          {/* Sidebar Navigation */}
          <div className="lg:w-48 xl:w-56 border-b lg:border-b-0 lg:border-r border-border bg-secondary/50">
            {/* Header */}
            <div className="p-3 border-b border-border">
              <h1 className="text-sm font-semibold text-foreground">Settings</h1>
              <p className="text-xs text-foreground/60 mt-0.5">Manage your preferences</p>
            </div>

            {/* Mobile: Horizontal scroll tabs */}
            <div className="lg:hidden overflow-x-auto">
              <div className="flex p-1.5 gap-1 min-w-max">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeSection === item.id
                        ? "bg-emerald-500 text-white"
                        : "text-foreground/70 hover:bg-accent"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 [&>svg]:w-3.5 [&>svg]:h-3.5">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: Vertical navigation */}
            <nav className="hidden lg:block p-2">
              <ul className="space-y-0.5">
                {navigationItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                        activeSection === item.id
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-foreground/70 hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <span className={`w-4 h-4 [&>svg]:w-4 [&>svg]:h-4 ${activeSection === item.id ? "text-white" : "text-foreground/50"}`}>
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className={`text-[10px] leading-tight ${activeSection === item.id ? "text-white/70" : "text-foreground/50"}`}>
                          {item.description}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-3 lg:p-4 xl:p-5 overflow-y-auto">
            <div className="max-w-2xl">
              {/* Profile Section */}
              {activeSection === "profile" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Profile</h2>
                    <p className="text-xs text-foreground/60 mt-0.5">Your personal information and account details</p>
                  </div>

                  {/* Profile Card */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-gradient-to-br from-secondary to-accent/50 rounded-xl border border-border">
                    {displayImage ? (
                      <div className="relative w-12 h-12">
                        <Image
                          src={displayImage}
                          alt={displayName}
                          fill
                          sizes="48px"
                          className="rounded-xl object-cover border border-white shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-base font-semibold text-white shadow-sm">
                        {getInitials(displayName)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{displayName}</h3>
                      <p className="text-xs text-foreground/60">{displayEmail}</p>
                      <p className="text-[10px] text-foreground/40 mt-0.5">
                        Signed in via {session?.user?.email?.includes("@") ? "Email" : "OAuth"}
                      </p>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Account Details</h3>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-foreground/70">Display Name</label>
                        <div className="px-2.5 py-2 bg-secondary border border-border text-foreground rounded-lg text-xs">
                          {displayName}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-foreground/70">Email Address</label>
                        <div className="px-2.5 py-2 bg-secondary border border-border text-foreground rounded-lg text-xs flex items-center gap-1.5">
                          <span className="flex-1 truncate">{displayEmail}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full whitespace-nowrap">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Keys Section */}
              {activeSection === "api-keys" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">API Keys</h2>
                    <p className="text-xs text-foreground/60 mt-0.5">Securely manage your Gemini API credentials</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/70">Status:</span>
                    {hasStoredKey ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        Encrypted & Stored
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        Not Configured
                      </span>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-blue-800 font-semibold">Bring Your Own Key (BYOK)</p>
                        <p className="text-[10px] text-blue-700 leading-relaxed mt-0.5">
                          Your API key is encrypted and stored securely. Get a free key from{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline hover:text-blue-800"
                          >
                            Google AI Studio
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={pendingApiKey}
                      onChange={(e) => {
                        setPendingApiKey(e.target.value)
                        setTestResult(null)
                        setSaveSuccess(false)
                      }}
                      placeholder="Enter your Gemini API key..."
                      className="w-full px-2.5 py-2 bg-card border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-xs"
                    />
                    {hasChanges && pendingApiKey && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        Unsaved changes
                      </p>
                    )}
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`rounded-lg p-2.5 ${testResult.valid ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                      <div className="flex items-center gap-1.5">
                        {testResult.valid ? (
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        )}
                        <span className={`text-xs font-medium ${testResult.valid ? "text-emerald-700" : "text-red-700"}`}>
                          {testResult.message}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Save Success */}
                  {saveSuccess && (
                    <div className="rounded-lg p-2.5 bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-emerald-700">
                          API key encrypted and saved successfully!
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleTestKey}
                      disabled={isTesting || !pendingApiKey.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-accent text-foreground rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTesting ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Testing...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                          Test Key
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleSaveKey}
                      disabled={isSaving || !pendingApiKey.trim() || !hasChanges}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          Save & Encrypt
                        </>
                      )}
                    </button>

                    {hasStoredKey && (
                      <button
                        onClick={handleDeleteKey}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete Key
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Security Note */}
                  <p className="text-[10px] text-foreground/50 pt-2 border-t border-border">
                    Your API key is encrypted using AES encryption before being stored. We never have access to your plaintext key.
                  </p>
                </div>
              )}

              {/* Skills Section */}
              {activeSection === "skills" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Skills</h2>
                    <p className="text-xs text-foreground/60 mt-0.5">Manage prompt modifiers for image generation</p>
                  </div>

                  {/* Info Box */}
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2.5">
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-800 font-semibold">Slash Commands</p>
                        <p className="text-[10px] text-indigo-700 leading-relaxed mt-0.5">
                          Type <code className="bg-indigo-500/20 px-1 rounded">/skillname</code> in your prompt to apply a skill. Skills append additional prompt text to enhance your generations.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Success/Error Messages */}
                  {skillSuccess && (
                    <div className="rounded-lg p-2.5 bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-emerald-700">{skillSuccess}</span>
                      </div>
                    </div>
                  )}
                  {skillError && (
                    <div className="rounded-lg p-2.5 bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span className="text-xs font-medium text-red-700">{skillError}</span>
                      </div>
                    </div>
                  )}

                  {/* Create Custom Skill */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Create Custom Skill</h3>
                    <div className="p-3 bg-secondary rounded-lg border border-border space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-foreground/70">Skill Name</label>
                          <input
                            type="text"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            placeholder="e.g., mylogo"
                            className="w-full px-2.5 py-2 bg-card border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                          />
                          <p className="text-[10px] text-foreground/50">Lowercase, no spaces</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-foreground/70">Description</label>
                          <input
                            type="text"
                            value={newSkillDescription}
                            onChange={(e) => setNewSkillDescription(e.target.value)}
                            placeholder="e.g., My brand logo style"
                            className="w-full px-2.5 py-2 bg-card border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-foreground/70">Prompt Text</label>
                        <textarea
                          value={newSkillPrompt}
                          onChange={(e) => setNewSkillPrompt(e.target.value)}
                          placeholder="e.g., modern minimalist logo, clean vector style, professional branding..."
                          rows={3}
                          className="w-full px-2.5 py-2 bg-card border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs resize-none"
                        />
                        <p className="text-[10px] text-foreground/50">This text will be appended to your prompt when using this skill</p>
                      </div>
                      <button
                        onClick={handleCreateSkill}
                        disabled={isCreatingSkill || !newSkillName.trim() || !newSkillDescription.trim() || !newSkillPrompt.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingSkill ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Creating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Create Skill
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Custom Skills List */}
                  {customSkills && customSkills.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-foreground">Your Custom Skills</h3>
                      <div className="space-y-2">
                        {customSkills.map((skill) => (
                          <div key={skill._id} className="p-2.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                            {editingSkill?.id === skill._id ? (
                              <div className="space-y-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    value={editingSkill.name}
                                    onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                                    className="px-2 py-1.5 bg-card border border-border text-foreground rounded text-xs"
                                  />
                                  <input
                                    type="text"
                                    value={editingSkill.description}
                                    onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                                    className="px-2 py-1.5 bg-card border border-border text-foreground rounded text-xs"
                                  />
                                </div>
                                <textarea
                                  value={editingSkill.promptText}
                                  onChange={(e) => setEditingSkill({ ...editingSkill, promptText: e.target.value })}
                                  rows={2}
                                  className="w-full px-2 py-1.5 bg-card border border-border text-foreground rounded text-xs resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleUpdateSkill}
                                    className="px-2 py-1 bg-violet-500 hover:bg-violet-600 text-white rounded text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingSkill(null)}
                                    className="px-2 py-1 bg-secondary hover:bg-accent text-foreground rounded text-xs font-medium"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-violet-700">/{skill.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded">custom</span>
                                  </div>
                                  <p className="text-[10px] text-foreground/60 mt-0.5">{skill.description}</p>
                                  <p className="text-[10px] text-foreground/40 mt-1 line-clamp-2">{skill.promptText}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setEditingSkill({ id: skill._id, name: skill.name, description: skill.description, promptText: skill.promptText })}
                                    className="p-1 text-foreground/50 hover:text-foreground transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSkill(skill._id)}
                                    disabled={deletingSkillId === skill._id}
                                    className="p-1 text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingSkillId === skill._id ? (
                                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Predefined Skills Reference */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Built-in Skills</h3>
                    <p className="text-[10px] text-foreground/50">These skills are available by default and cannot be modified.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {predefinedSkills.map((skill) => (
                        <div key={skill.name} className="p-2 bg-secondary rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-indigo-600">/{skill.name}</span>
                              <p className="text-[10px] text-foreground/50 truncate">{skill.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Account Section */}
              {activeSection === "account" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Account</h2>
                    <p className="text-xs text-foreground/60 mt-0.5">Manage your account settings and security</p>
                  </div>

                  {/* Session Info */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Current Session</h3>
                    <div className="p-2.5 bg-secondary rounded-lg border border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">Active Session</p>
                          <p className="text-[10px] text-foreground/60">Signed in as {displayEmail}</p>
                        </div>
                        <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-medium">
                          Active
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Sign Out</h3>
                    <div className="p-2.5 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">Sign out of your account</p>
                          <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">
                            You&apos;ll need to sign in again to access your studio and settings.
                          </p>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
