"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useAction, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import Image from "next/image"
type SettingsSection = "profile" | "api-keys" | "account"
type ProviderId = "google" | "openai"

const providerConfigs: {
  id: ProviderId
  label: string
  docsUrl: string
  inputPlaceholder: string
  helpText: string
}[] = [
  {
    id: "google",
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
    google: "",
    openai: "",
  })
  const [isTestingProvider, setIsTestingProvider] = useState<Record<ProviderId, boolean>>({
    google: false,
    openai: false,
  })
  const [isSavingProvider, setIsSavingProvider] = useState<Record<ProviderId, boolean>>({
    google: false,
    openai: false,
  })
  const [isDeletingProvider, setIsDeletingProvider] = useState<Record<ProviderId, boolean>>({
    google: false,
    openai: false,
  })
  const [providerFeedback, setProviderFeedback] = useState<Record<ProviderId, { valid: boolean; message: string } | null>>({
    google: null,
    openai: null,
  })
  const [saveSuccessProvider, setSaveSuccessProvider] = useState<Record<ProviderId, boolean>>({
    google: false,
    openai: false,
  })

  // User data
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)

  const displayName = user?.name || session?.user?.name || "User"
  const displayEmail = user?.email || session?.user?.email || ""
  const displayImage = user?.image || session?.user?.image

  // Secure provider API key storage
  const storedProviderCredentials = useQuery(api.apiKeys.getMyProviderCredentials, {})
  const saveProviderCredential = useAction(api.credentialActions.saveProviderCredential)
  const disableProviderCredential = useMutation(api.apiKeys.disableProviderCredential)
  const testProviderApiKeyAction = useAction(api.apiKeyActions.testProviderApiKey)

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
      const result = await testProviderApiKeyAction({ provider: provider === "google" ? "gemini" : "openai", apiKey: pendingApiKey })
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
      await saveProviderCredential({ provider, secretValue: pendingApiKey })
      setPendingApiKeys((current) => ({ ...current, [provider]: "" }))
      setSaveSuccessProvider((current) => ({ ...current, [provider]: true }))
    } catch {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Failed to save API key" },
      }))
    } finally {
      setIsSavingProvider((current) => ({ ...current, [provider]: false }))
    }
  }

  const handleDisableKey = async (provider: ProviderId) => {
    setIsDeletingProvider((current) => ({ ...current, [provider]: true }))
    setSaveSuccessProvider((current) => ({ ...current, [provider]: false }))
    setProviderFeedback((current) => ({ ...current, [provider]: null }))

    try {
      await disableProviderCredential({ provider })
      setPendingApiKeys((current) => ({ ...current, [provider]: "" }))
    } catch {
      setProviderFeedback((current) => ({
        ...current,
        [provider]: { valid: false, message: "Failed to disable API key" },
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

  const hasStoredKey = (provider: ProviderId) => Boolean(storedProviderCredentials?.[provider]?.configured)
  const hasChanges = (provider: ProviderId) => pendingApiKeys[provider].trim().length > 0

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
                              onClick={() => handleDisableKey(provider.id)}
                              disabled={isDeletingProvider[provider.id]}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                            >
                              {isDeletingProvider[provider.id] ? "Disabling…" : "Disable key"}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="border-t border-border pt-6 text-xs text-muted-foreground">
                  Provider keys are stored server-side for your authenticated account and only used when you trigger studio generations or authenticated API gateway requests. Disabling a key prevents further use while retaining its encrypted record for migration safety.
                </p>
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
