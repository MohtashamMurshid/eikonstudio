"use client";

import type { ModelCatalogEntry } from "@eikonstudio/core";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  google: "Google",
  bfl: "Black Forest Labs",
  byteplus: "BytePlus",
  kling: "Kling AI",
  xai: "xAI",
} as const;

const lifecycleClasses = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  preview: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  deprecated: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  uncertain: "border-foreground/20 bg-foreground/5 text-foreground/60",
} as const;

const selectClass = "h-10 border border-foreground/15 bg-background px-3 text-[10px] uppercase tracking-[0.12em] text-foreground outline-none focus:border-foreground/50";

export function ModelCatalog({ models }: { models: readonly ModelCatalogEntry[] }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [media, setMedia] = useState("all");
  const [readiness, setReadiness] = useState("all");

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return models.filter((model) => {
      const searchable = [model.displayName, model.nativeId ?? "", model.familyId, model.providerId, ...model.aliases, ...model.tasks].join(" ").toLowerCase();
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (provider === "all" || model.providerId === provider) &&
        (media === "all" || model.mediaTypes.includes(media as "image" | "video")) &&
        (readiness === "all" || model.readiness === readiness)
      );
    });
  }, [media, models, provider, query, readiness]);

  return (
    <section aria-labelledby="catalog-heading">
      <div className="sticky top-0 z-20 border-y border-foreground/10 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1500px] gap-px bg-foreground/10 sm:grid-cols-2 xl:grid-cols-[1.6fr_repeat(3,0.7fr)_auto]">
          <label className="relative flex items-center bg-background">
            <Search className="absolute left-4 size-3.5 text-foreground/40" strokeWidth={1.5} />
            <span className="sr-only">Search models</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, ID, family, or task"
              className="h-12 w-full bg-transparent pl-11 pr-4 text-xs outline-none placeholder:text-foreground/35"
            />
          </label>
          <select aria-label="Filter by provider" value={provider} onChange={(event) => setProvider(event.target.value)} className={selectClass}>
            <option value="all">All providers</option>
            {Object.entries(PROVIDER_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select aria-label="Filter by media" value={media} onChange={(event) => setMedia(event.target.value)} className={selectClass}>
            <option value="all">Image + video</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <select aria-label="Filter by Eikon readiness" value={readiness} onChange={(event) => setReadiness(event.target.value)} className={selectClass}>
            <option value="all">All readiness</option>
            <option value="ready">Eikon ready</option>
            <option value="discovered">Discovered</option>
            <option value="deprecated">Deprecated</option>
          </select>
          <div className="flex h-12 items-center gap-2 bg-background px-4 text-[9px] uppercase tracking-[0.14em] text-foreground/45 sm:col-span-2 xl:col-span-1">
            <SlidersHorizontal className="size-3" strokeWidth={1.5} />
            {filteredModels.length} / {models.length}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <h2 id="catalog-heading" className="sr-only">Model variants</h2>
        {filteredModels.length ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredModels.map((model, index) => (
              <article key={model.id} className="group flex min-h-[300px] flex-col border border-foreground/12 bg-card/50 transition-colors hover:border-foreground/30 hover:bg-card">
                <div className="flex items-start justify-between gap-4 border-b border-foreground/10 p-5">
                  <div className="min-w-0">
                    <p className="mb-3 text-[8px] uppercase tracking-[0.18em] text-foreground/40">
                      {String(index + 1).padStart(2, "0")} / {PROVIDER_LABELS[model.providerId]}
                    </p>
                    <h3 className="text-xl font-medium tracking-[-0.035em] text-foreground">{model.displayName}</h3>
                    {model.aliases.length > 0 && <p className="mt-1 text-xs text-foreground/50">{model.aliases.join(" · ")}</p>}
                  </div>
                  <span className={`shrink-0 border px-2 py-1 text-[8px] uppercase tracking-[0.14em] ${lifecycleClasses[model.providerLifecycle]}`}>
                    {model.providerLifecycle}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-5 p-5">
                  <div>
                    <p className="mb-1.5 text-[8px] uppercase tracking-[0.16em] text-foreground/35">Native ID</p>
                    <code className="block break-all text-[11px] leading-relaxed text-foreground/75">{model.nativeId ?? "Not published"}</code>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div>
                      <p className="mb-1 text-[8px] uppercase tracking-[0.14em] text-foreground/35">Family</p>
                      <p className="capitalize text-foreground/70">{model.familyId.replaceAll("-", " ")}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[8px] uppercase tracking-[0.14em] text-foreground/35">Surface</p>
                      <p className="text-foreground/70">{model.apiSurface}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {model.tasks.map((task) => <span key={task} className="border border-foreground/10 bg-foreground/[0.035] px-2 py-1 text-[8px] tracking-[0.04em] text-foreground/55">{task}</span>)}
                  </div>

                  <p className="text-[10px] leading-relaxed text-foreground/48">{model.availabilityNotes}</p>
                </div>

                <div className="flex items-stretch border-t border-foreground/10">
                  <span className={`flex flex-1 items-center px-5 py-3 text-[8px] font-medium uppercase tracking-[0.15em] ${model.readiness === "ready" ? "text-emerald-600 dark:text-emerald-300" : "text-foreground/45"}`}>
                    {model.readiness === "ready" ? "Eikon ready" : `${model.readiness} · not integrated`}
                  </span>
                  <a href={model.sourceUrl} target="_blank" rel="noopener noreferrer" className="ui-pressable flex items-center gap-2 border-l border-foreground/10 px-4 py-3 text-[8px] uppercase tracking-[0.14em] text-foreground/55 hover:bg-foreground/5 hover:text-foreground">
                    Source <ArrowUpRight className="size-3" strokeWidth={1.5} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 items-center justify-center border border-dashed border-foreground/15 text-center">
            <div>
              <p className="text-sm font-medium">No matching variants</p>
              <button type="button" onClick={() => { setQuery(""); setProvider("all"); setMedia("all"); setReadiness("all"); }} className="mt-3 text-[9px] uppercase tracking-[0.15em] text-foreground/50 underline underline-offset-4 hover:text-foreground">Reset filters</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
