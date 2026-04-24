"use client"

import { useState, useEffect, type ReactNode } from "react"
import Link from "next/link"
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
type ProviderId = "gemini" | "openai"

const providerConfigs: {
  id: ProviderId
  label: string
  docsUrl: string
  inputPlaceholder: string
  helpText: string
}[] = [
  {
    id: "gemini",
    label: "Gemini",
    docsUrl: "https://aistudio.google.com/app/apikey",
    inputPlaceholder: "Enter your Gemini API key…",
    helpText: "Used for Gemini-powered image generation inside the studio and through your API gateway.",
  },
  {
    id: "openai",
    label: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    inputPlaceholder: "Enter your OpenAI API key…",
    helpText: "Used for GPT Image generations inside the studio and through your API gateway.",
  },
]

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
  const [pendingApiKeys, setPendingApiKeys] = useState<Record<ProviderId, string>>({
    gemini: "",
    openai: "",
  })
  const [isTestingProvider, setIsTestingProvider] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
  })
  const [isSavingProvider, setIsSavingProvider] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
  })
  const [isDeletingProvider, setIsDeletingProvider] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
  })
  const [providerFeedback, setProviderFeedback] = useState<Record<ProviderId, { valid: boolean; message: string } | null>>({
    gemini: null,
    openai: null,
  })
  const [saveSuccessProvider, setSaveSuccessProvider] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
  })

  // User data
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)

  const displayName = user?.name || session?.user?.name || "User"
  const displayEmail = user?.email || session?.user?.email || ""
  const displayImage = user?.image || session?.user?.image

  // Secure provider API key storage
  const storedProviderApiKeys = useQuery(api.apiKeys.getMyProviderApiKeys, {})
  const saveProviderApiKeyMutation = useMutation(api.apiKeys.saveProviderApiKey)
  const deleteProviderApiKeyMutation = useMutation(api.apiKeys.deleteProviderApiKey)
  const testProviderApiKeyAction = useAction(api.apiKeyActions.testProviderApiKey)

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

  // Initialize pending keys from stored keys
  useEffect(() => {
    if (!storedProviderApiKeys) return

    setPendingApiKeys({
      gemini: storedProviderApiKeys.gemini?.apiKey || "",
      openai: storedProviderApiKeys.openai?.apiKey || "",
    })
  }, [storedProviderApiKeys])

  const handleTestKey = async (provider: ProviderId) => {
    const pendingApiKey = pendingApiKeys[provider]
    if (!pendingApiKey.trim()) {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Please enter an API key first" },
      }))
      return
    }

    setIsTestingProvider((current) => ({ ...current, [provider]: true }))
    setProviderFeedback((current) => ({ ...current, [provider]: null }))
    setSaveSuccessProvider((current) => ({ ...current, [provider]: false }))

    try {
      const result = await testProviderApiKeyAction({ provider, apiKey: pendingApiKey })
      setProviderFeedback((current) => ({ ...current, [provider]: result }))
    } catch {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Failed to test API key" },
      }))
    } finally {
      setIsTestingProvider((current) => ({ ...current, [provider]: false }))
    }
  }

  const handleSaveKey = async (provider: ProviderId) => {
    const pendingApiKey = pendingApiKeys[provider]
    if (!pendingApiKey.trim()) return

    setIsSavingProvider((current) => ({ ...current, [provider]: true }))
    setSaveSuccessProvider((current) => ({ ...current, [provider]: false }))
    setProviderFeedback((current) => ({ ...current, [provider]: null }))

    try {
      await saveProviderApiKeyMutation({ provider, apiKey: pendingApiKey })
      setSaveSuccessProvider((current) => ({ ...current, [provider]: true }))
      localStorage.setItem(provider === "gemini" ? "gemini-api-key" : "openai-api-key", pendingApiKey)
    } catch {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Failed to save API key" },
      }))
    } finally {
      setIsSavingProvider((current) => ({ ...current, [provider]: false }))
    }
  }

  const handleDeleteKey = async (provider: ProviderId) => {
    setIsDeletingProvider((current) => ({ ...current, [provider]: true }))
    setSaveSuccessProvider((current) => ({ ...current, [provider]: false }))
    setProviderFeedback((current) => ({ ...current, [provider]: null }))

    try {
      await deleteProviderApiKeyMutation({ provider })
      setPendingApiKeys((current) => ({ ...current, [provider]: "" }))
      localStorage.removeItem(provider === "gemini" ? "gemini-api-key" : "openai-api-key")
    } catch {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Failed to delete API key" },
      }))
    } finally {
      setIsDeletingProvider((current) => ({ ...current, [provider]: false }))
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

  const hasStoredKey = (provider: ProviderId) => Boolean(storedProviderApiKeys?.[provider]?.apiKey)
  const hasChanges = (provider: ProviderId) =>
    pendingApiKeys[provider] !== (storedProviderApiKeys?.[provider]?.apiKey || "")

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

  const navItemClass = (id: SettingsSection) =>
    activeSection === id
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "text-foreground/70 hover:bg-accent hover:text-foreground"

  return (
    <div className="min-h-full bg-card">
      <div className="flex min-h-[calc(100vh-3rem)] flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
        {/* Sub-navigation */}
        <aside className="shrink-0 lg:w-56 xl:w-60">
          <div className="border-b border-border px-4 py-5 lg:border-b-0">
            <h1 className="text-sm font-semibold text-foreground">Settings</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Workspace preferences</p>
          </div>

          <div className="lg:hidden overflow-x-auto overscroll-x-contain">
            <div className="flex gap-2 px-4 py-3 min-w-max">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.description}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${navItemClass(item.id)} ${
                    activeSection === item.id ? "border-emerald-500/30" : "border-border bg-transparent"
                  }`}
                >
                  <span className={activeSection === item.id ? "text-emerald-600 dark:text-emerald-400" : ""}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <nav className="hidden lg:block p-3">
            <p className="mb-2 px-3 text-xs font-medium text-foreground/40 uppercase tracking-wider">Sections</p>
            <ul className="space-y-1">
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    title={item.description}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${navItemClass(item.id)}`}
                  >
                    <span className={activeSection === item.id ? "text-emerald-600 dark:text-emerald-400" : ""}>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            {activeSection === "profile" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Your personal information and account details</p>
                </div>

                <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:gap-5">
                  {displayImage ? (
                    <div className="relative h-14 w-14 shrink-0">
                      <Image
                        src={displayImage}
                        alt={displayName}
                        fill
                        sizes="56px"
                        className="rounded-lg border border-border object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base font-semibold text-primary">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{displayEmail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Signed in via {session?.user?.email?.includes("@") ? "Email" : "OAuth"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Account details</p>
                  <div className="rounded-lg border border-border">
                    <SettingsRow label="Display name">
                      <span className="text-foreground">{displayName}</span>
                    </SettingsRow>
                    <SettingsRow label="Email" description="Used for sign-in and notifications.">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all">{displayEmail}</span>
                        <span className="inline-flex shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Verified
                        </span>
                      </div>
                    </SettingsRow>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "api-keys" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">API keys</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Securely manage the provider keys used by your studio and API gateway.</p>
                </div>

                <InlineCallout
                  title="Bring your own keys"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                  }
                >
                  <p>
                    Save one key per provider here, then generate a platform API key from{" "}
                    <Link href="/studio/api" className="font-medium text-primary underline-offset-2 hover:underline">
                      the API section
                    </Link>
                    . Your provider keys stay private and are only used server-side.
                  </p>
                </InlineCallout>

                <div className="space-y-6">
                  {providerConfigs.map((provider) => {
                    const feedback = providerFeedback[provider.id]
                    const pendingValue = pendingApiKeys[provider.id]
                    const providerHasStoredKey = hasStoredKey(provider.id)
                    const providerHasChanges = hasChanges(provider.id)

                    return (
                      <div key={provider.id} className="rounded-xl border border-border p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{provider.label}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{provider.helpText}</p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                              providerHasStoredKey
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {providerHasStoredKey ? "Configured" : "Not configured"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          <label htmlFor={`${provider.id}-api-key`} className="text-sm font-medium text-foreground">
                            {provider.label} API key
                          </label>
                          <input
                            id={`${provider.id}-api-key`}
                            type="password"
                            value={pendingValue}
                            onChange={(e) => {
                              const value = e.target.value
                              setPendingApiKeys((current) => ({ ...current, [provider.id]: value }))
                              setProviderFeedback((current) => ({ ...current, [provider.id]: null }))
                              setSaveSuccessProvider((current) => ({ ...current, [provider.id]: false }))
                            }}
                            placeholder={provider.inputPlaceholder}
                            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {providerHasChanges && pendingValue && (
                            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                              </svg>
                              Unsaved changes
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Need a key?{" "}
                            <a
                              href={provider.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Open provider dashboard
                            </a>
                            .
                          </p>
                        </div>

                        {feedback && (
                          <div
                            className={`mt-4 rounded-lg border px-3 py-2.5 ${
                              feedback.valid ? "border-emerald-500/25 bg-emerald-500/10" : "border-red-500/25 bg-red-500/10"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${feedback.valid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                                {feedback.message}
                              </span>
                            </div>
                          </div>
                        )}

                        {saveSuccessProvider[provider.id] && (
                          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                              {provider.label} API key saved successfully.
                            </span>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestKey(provider.id)}
                            disabled={isTestingProvider[provider.id] || !pendingValue.trim()}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isTestingProvider[provider.id] ? "Testing…" : "Test key"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveKey(provider.id)}
                            disabled={isSavingProvider[provider.id] || !pendingValue.trim() || !providerHasChanges}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingProvider[provider.id] ? "Saving…" : "Save key"}
                          </button>

                          {providerHasStoredKey && (
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(provider.id)}
                              disabled={isDeletingProvider[provider.id]}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                            >
                              {isDeletingProvider[provider.id] ? "Deleting…" : "Delete key"}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="border-t border-border pt-6 text-xs text-muted-foreground">
                  Provider keys are stored server-side for your authenticated account and only used when you trigger studio generations or authenticated API gateway requests.
                </p>
              </div>
            )}

            {activeSection === "skills" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">Skills</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Prompt modifiers for image generation</p>
                </div>

                <InlineCallout
                  title="Slash commands"
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  }
                >
                  <p>
                    Type <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground">/skillname</code> in your prompt
                    to apply a skill. Skills append extra prompt text to your generations.
                  </p>
                </InlineCallout>

                {skillSuccess && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{skillSuccess}</span>
                    </div>
                  </div>
                )}
                {skillError && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">{skillError}</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Create custom skill</p>
                  <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 dark:bg-secondary/20">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground/80">Skill name</label>
                        <input
                          type="text"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          placeholder="e.g. mylogo"
                          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-muted-foreground">Lowercase, no spaces</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground/80">Description</label>
                        <input
                          type="text"
                          value={newSkillDescription}
                          onChange={(e) => setNewSkillDescription(e.target.value)}
                          placeholder="e.g. My brand logo style"
                          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Prompt text</label>
                      <textarea
                        value={newSkillPrompt}
                        onChange={(e) => setNewSkillPrompt(e.target.value)}
                        placeholder="e.g. modern minimalist logo, clean vector style…"
                        rows={3}
                        className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-xs text-muted-foreground">Appended to your prompt when this skill runs</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateSkill}
                      disabled={isCreatingSkill || !newSkillName.trim() || !newSkillDescription.trim() || !newSkillPrompt.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCreatingSkill ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Creating…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Create skill
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {customSkills && customSkills.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Your skills</p>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {customSkills.map((skill) => (
                        <div key={skill._id} className="p-4">
                          {editingSkill?.id === skill._id ? (
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={editingSkill.name}
                                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <input
                                  type="text"
                                  value={editingSkill.description}
                                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                              <textarea
                                value={editingSkill.promptText}
                                onChange={(e) => setEditingSkill({ ...editingSkill, promptText: e.target.value })}
                                rows={2}
                                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={handleUpdateSkill}
                                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-emerald-600"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSkill(null)}
                                  className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-medium text-primary">/{skill.name}</span>
                                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Custom</span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{skill.promptText}</p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingSkill({
                                      id: skill._id,
                                      name: skill.name,
                                      description: skill.description,
                                      promptText: skill.promptText,
                                    })
                                  }
                                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  title="Edit"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSkill(skill._id)}
                                  disabled={deletingSkillId === skill._id}
                                  className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingSkillId === skill._id ? (
                                    <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
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

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Built-in skills</p>
                  <p className="mb-3 text-sm text-muted-foreground">Available by default. They cannot be edited.</p>
                  <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                    {predefinedSkills.map((skill) => (
                      <div key={skill.name} className="bg-card px-3 py-2.5">
                        <span className="font-mono text-sm font-medium text-primary">/{skill.name}</span>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{skill.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "account" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">Account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Session and sign-in</p>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Current session</p>
                  <div className="rounded-lg border border-border">
                    <SettingsRow label="Status" description={displayEmail}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-foreground">Active session</span>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      </div>
                    </SettingsRow>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sign out</p>
                  <div className="flex flex-col gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">End this session</p>
                      <p className="mt-1 text-sm text-muted-foreground">You will need to sign in again to use the studio.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="shrink-0 sm:w-44">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  )
}

function InlineCallout({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 dark:bg-secondary/30">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground [&_a]:text-primary">{children}</div>
        </div>
      </div>
    </div>
  )
}
