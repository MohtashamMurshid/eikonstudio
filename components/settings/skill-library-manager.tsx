"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import {
  SKILL_CATEGORIES,
  builtInSkills,
  matchesSkillSearch,
  renderSkillPrompt,
  type SkillCategory,
  type SkillDefinition,
  type SkillSections,
} from "@/lib/skill-library"
import { getUserFacingErrorMessage } from "@/lib/error-utils"

type StoredSkill = {
  _id: Id<"skills">
  _creationTime: number
  userId: string
  name: string
  description: string
  category?: string
  tags?: string[]
  promptText?: string
  freeformInstructions?: string
  sections?: SkillSections
  builtInSkillKey?: string
  isBuiltIn?: boolean
  isEditable?: boolean
  sortOrder?: number
  createdAt: number
}

type LibraryItem = {
  libraryKey: string
  skill: SkillDefinition
  dbSkill?: StoredSkill
  isStarter: boolean
  isCustomized: boolean
}

type SkillFormState = {
  name: string
  description: string
  category: SkillCategory
  tags: string
  freeformInstructions: string
  sections: Required<SkillSections>
  builtInSkillKey?: string
  isBuiltIn: boolean
  isEditable: boolean
  sortOrder?: number
}

const SECTION_FIELDS: Array<{
  key: keyof Required<SkillSections>
  label: string
  placeholder: string
}> = [
  { key: "styleOverview", label: "Style overview", placeholder: "What should this overall style feel like?" },
  { key: "visualHallmarks", label: "Visual hallmarks", placeholder: "Recurring motifs, faces, gestures, silhouettes..." },
  { key: "composition", label: "Composition", placeholder: "How should the subject be framed and arranged?" },
  { key: "palette", label: "Palette", placeholder: "Colors, saturation, temperature, contrast..." },
  { key: "lighting", label: "Lighting", placeholder: "Soft studio light, chiaroscuro, golden-hour haze..." },
  { key: "materialsAndTextures", label: "Materials & textures", placeholder: "Canvas tooth, cracked plaster, brushed metal..." },
  { key: "mustInclude", label: "Must include", placeholder: "Critical cues the model should keep..." },
  { key: "avoid", label: "Avoid", placeholder: "What should this skill steer away from?" },
  { key: "negativePrompt", label: "Negative prompt", placeholder: "Specific artifacts or mistakes to suppress..." },
]

const EMPTY_SECTIONS: Required<SkillSections> = {
  styleOverview: "",
  visualHallmarks: "",
  composition: "",
  lighting: "",
  palette: "",
  materialsAndTextures: "",
  mustInclude: "",
  avoid: "",
  negativePrompt: "",
}

function emptyForm(): SkillFormState {
  return {
    name: "",
    description: "",
    category: "style",
    tags: "",
    freeformInstructions: "",
    sections: { ...EMPTY_SECTIONS },
    isBuiltIn: false,
    isEditable: true,
  }
}

function toFormState(skill: SkillDefinition): SkillFormState {
  return {
    name: skill.name,
    description: skill.description,
    category: (skill.category ?? "style") as SkillCategory,
    tags: (skill.tags ?? []).join(", "),
    freeformInstructions: skill.freeformInstructions ?? skill.promptText ?? "",
    sections: { ...EMPTY_SECTIONS, ...(skill.sections ?? {}) },
    builtInSkillKey: skill.builtInSkillKey,
    isBuiltIn: skill.isBuiltIn,
    isEditable: skill.isEditable,
    sortOrder: skill.sortOrder,
  }
}

function normalizeStoredSkill(skill: StoredSkill): SkillDefinition {
  return {
    name: skill.name,
    description: skill.description,
    category: (skill.category ?? "style") as SkillCategory,
    tags: skill.tags ?? [],
    sections: skill.sections,
    freeformInstructions: skill.freeformInstructions,
    promptText: skill.promptText,
    isBuiltIn: skill.isBuiltIn ?? false,
    isEditable: skill.isEditable ?? true,
    sortOrder: skill.sortOrder,
    builtInSkillKey: skill.builtInSkillKey,
  }
}

function isSkillCategory(value: string): value is SkillCategory {
  return (SKILL_CATEGORIES as readonly string[]).includes(value)
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"

export function SkillLibraryManager() {
  const customSkills = useQuery(api.skills.getMySkills, {}) as StoredSkill[] | undefined
  const createSkillMutation = useMutation(api.skills.createSkill)
  const updateSkillMutation = useMutation(api.skills.updateSkill)
  const deleteSkillMutation = useMutation(api.skills.deleteSkill)

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | "all">("all")
  const [selectedLibraryKey, setSelectedLibraryKey] = useState<string>("renaissance")
  const [isCreatingNewSkill, setIsCreatingNewSkill] = useState(false)
  const [draft, setDraft] = useState<SkillFormState>(emptyForm())
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const libraryItems = useMemo<LibraryItem[]>(() => {
    const customList = customSkills ?? []
    const customByKey = new Map<string, StoredSkill>()
    for (const skill of customList) {
      customByKey.set(skill.builtInSkillKey ?? skill.name, skill)
    }
    const starterItems = builtInSkills.map((skill) => {
      const override = customByKey.get(skill.name)
      return override
        ? { libraryKey: skill.name, skill: normalizeStoredSkill(override), dbSkill: override, isStarter: true, isCustomized: true }
        : { libraryKey: skill.name, skill, isStarter: true, isCustomized: false }
    })
    const starterKeys = new Set(builtInSkills.map((s) => s.name))
    const customOnlyItems = customList
      .filter((s) => !s.builtInSkillKey && !starterKeys.has(s.name))
      .map((s) => ({ libraryKey: s.name, skill: normalizeStoredSkill(s), dbSkill: s, isStarter: false, isCustomized: true }))
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
    return [...starterItems, ...customOnlyItems]
  }, [customSkills])

  const filteredItems = useMemo(() => {
    return libraryItems.filter((item) => {
      if (categoryFilter !== "all" && item.skill.category !== categoryFilter) return false
      return matchesSkillSearch(item.skill, searchTerm)
    })
  }, [categoryFilter, libraryItems, searchTerm])

  const selectedItem = useMemo(() => {
    if (isCreatingNewSkill) return null
    return libraryItems.find((i) => i.libraryKey === selectedLibraryKey) ?? libraryItems[0] ?? null
  }, [isCreatingNewSkill, libraryItems, selectedLibraryKey])

  useEffect(() => {
    if (isCreatingNewSkill) { setDraft(emptyForm()); return }
    if (selectedItem) setDraft(toFormState(selectedItem.skill))
  }, [isCreatingNewSkill, selectedItem])

  useEffect(() => {
    if (!selectedItem && !isCreatingNewSkill && libraryItems.length > 0) {
      setSelectedLibraryKey(libraryItems[0].libraryKey)
    }
  }, [isCreatingNewSkill, libraryItems, selectedItem])

  const updateSection = (key: keyof Required<SkillSections>, value: string) => {
    setDraft((c) => ({ ...c, sections: { ...c.sections, [key]: value } }))
  }

  const previewSkill: SkillDefinition = useMemo(() => ({
    name: draft.name || "preview",
    description: draft.description,
    category: draft.category,
    tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
    sections: draft.sections,
    freeformInstructions: draft.freeformInstructions,
    isBuiltIn: draft.isBuiltIn,
    isEditable: draft.isEditable,
    sortOrder: draft.sortOrder,
    builtInSkillKey: draft.builtInSkillKey,
  }), [draft])

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.description.trim()) {
      setFeedback({ kind: "error", message: "Name and description are required." })
      return
    }
    setIsSaving(true)
    setFeedback(null)
    const payload = {
      name: draft.name,
      description: draft.description,
      category: draft.category,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      freeformInstructions: draft.freeformInstructions,
      sections: draft.sections,
      builtInSkillKey: draft.builtInSkillKey,
      isBuiltIn: draft.isBuiltIn,
      isEditable: draft.isEditable,
      sortOrder: draft.sortOrder,
    }
    try {
      if (selectedItem?.dbSkill && !isCreatingNewSkill) {
        await updateSkillMutation({ skillId: selectedItem.dbSkill._id, ...payload })
        setFeedback({ kind: "success", message: "Saved." })
      } else {
        await createSkillMutation(payload)
        setFeedback({ kind: "success", message: draft.builtInSkillKey ? "Customization saved." : "Skill created." })
      }
      setIsCreatingNewSkill(false)
      setSelectedLibraryKey(draft.builtInSkillKey ?? draft.name)
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getUserFacingErrorMessage(error, "Save failed."),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem?.dbSkill) return
    setIsDeleting(true)
    setFeedback(null)
    try {
      await deleteSkillMutation({ skillId: selectedItem.dbSkill._id })
      setFeedback({ kind: "success", message: selectedItem.isStarter ? "Reset to default." : "Deleted." })
      if (!selectedItem.isStarter) setSelectedLibraryKey("renaissance")
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getUserFacingErrorMessage(error, "Delete failed."),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const currentCategoryValue = isSkillCategory(draft.category) ? draft.category : "style"
  const isStarterSkill = Boolean(selectedItem?.isStarter && !isCreatingNewSkill)

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Skills</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Editable slash commands like <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">/renaissance</code> that expand into structured prompts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {feedback && (
              <span className={`text-xs font-medium ${feedback.kind === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {feedback.message}
              </span>
            )}
            <button
              type="button"
              onClick={() => { setIsCreatingNewSkill(true); setFeedback(null) }}
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              New skill
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex gap-6 min-h-0" style={{ height: "calc(100vh - 14rem)" }}>
          {/* Sidebar list */}
          <aside className="flex w-56 shrink-0 flex-col rounded-lg border border-border xl:w-64">
            <div className="flex shrink-0 gap-2 border-b border-border p-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter..."
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : (e.target.value as SkillCategory))}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All</option>
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredItems.map((item) => {
                const isSelected = !isCreatingNewSkill && selectedItem?.libraryKey === item.libraryKey
                return (
                  <button
                    key={item.libraryKey}
                    type="button"
                    onClick={() => { setIsCreatingNewSkill(false); setSelectedLibraryKey(item.libraryKey); setFeedback(null) }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "text-foreground/70 hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className={`shrink-0 font-mono text-xs ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}`}>/</span>
                    <span className="truncate text-sm">{item.skill.name}</span>
                    {item.isCustomized && (
                      <span className="ml-auto shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        edited
                      </span>
                    )}
                  </button>
                )
              })}
              {filteredItems.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No skills match.</p>
              )}
            </div>
          </aside>

          {/* Editor pane */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-border">
            <div className="mx-auto max-w-2xl px-6 py-6 space-y-5">
              {/* Editor header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isCreatingNewSkill ? "New skill" : <><span className="font-mono text-emerald-600 dark:text-emerald-400">/{draft.name}</span></>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isCreatingNewSkill
                      ? "Define a new slash skill with structured art direction."
                      : isStarterSkill && !selectedItem?.dbSkill
                        ? "Starter skill — save changes to create your own version."
                        : "Edit how this slash skill expands in the studio prompt."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isCreatingNewSkill && selectedItem?.dbSkill && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:opacity-50 dark:text-red-400"
                    >
                      {isDeleting ? "..." : selectedItem.isStarter ? "Reset" : "Delete"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Meta fields */}
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Command</label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                    disabled={isStarterSkill}
                    placeholder="e.g. renaissance"
                    className={`${inputClass} font-mono disabled:cursor-not-allowed disabled:opacity-60`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={currentCategoryValue}
                    onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value as SkillCategory }))}
                    className={inputClass}
                  >
                    {SKILL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))}
                  placeholder="What does this skill do?"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tags</label>
                <input
                  type="text"
                  value={draft.tags}
                  onChange={(e) => setDraft((c) => ({ ...c, tags: e.target.value }))}
                  placeholder="painting, classical, museum"
                  className={inputClass}
                />
              </div>

              {/* Sections divider */}
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sections</p>
              </div>

              {/* Structured sections */}
              {SECTION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <textarea
                    rows={2}
                    value={draft.sections[field.key]}
                    onChange={(e) => updateSection(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}

              {/* Freeform divider */}
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Freeform</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Additional instructions</label>
                <textarea
                  rows={4}
                  value={draft.freeformInstructions}
                  onChange={(e) => setDraft((c) => ({ ...c, freeformInstructions: e.target.value }))}
                  placeholder="Additional nuance that doesn't fit the structured fields..."
                  className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Preview */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg className={`h-3.5 w-3.5 transition-transform ${showPreview ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Rendered prompt preview
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">/{draft.name || "preview"}</code>
                </button>
                {showPreview && (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/70">
                    {renderSkillPrompt(previewSkill) || "Fill out fields above to see the generated prompt."}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
