"use client";

import { MODEL_FAMILY_REGISTRY, type ModelCatalogEntry, type ProviderId } from "@eikonstudio/core";
import { ArrowUpRight, Search } from "lucide-react";
import { startTransition, useMemo, useState, type ReactNode } from "react";

import { PROVIDER_META, ProviderLogo } from "@/components/models/provider-logo";
import { cn } from "@/lib/utils";

const PROVIDERS = Object.keys(PROVIDER_META) as ProviderId[];
const CHIP_LABELS = {
  openai: "OpenAI",
  google: "Google",
  bfl: "BFL",
  byteplus: "BytePlus",
  kling: "Kling",
  xai: "xAI",
} as const satisfies Record<ProviderId, string>;

const chipClass = "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors";
const chipIdle = "border-foreground/10 text-foreground/55 hover:border-foreground/20 hover:text-foreground";
const chipActive = "border-foreground/80 bg-foreground text-background";

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
      <h2 id="catalog-heading" className="sr-only">Model variants</h2>

      <div className="sticky top-0 z-20 border-y border-foreground/8 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-3 sm:px-8">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-0 size-3.5 text-foreground/35" strokeWidth={1.75} />
            <label className="sr-only" htmlFor="model-search">Search models</label>
            <input
              id="model-search"
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                startTransition(() => setQuery(next));
              }}
              placeholder="Search models"
              className="h-9 w-full bg-transparent pl-7 pr-16 text-[13px] outline-none placeholder:text-foreground/35"
            />
            <span className="pointer-events-none absolute right-0 text-[11px] tabular-nums text-foreground/35">
              {filteredModels.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PROVIDERS.map((id) => (
              <FilterChip key={id} active={provider === id} onClick={() => setProvider(provider === id ? "all" : id)}>
                <ProviderLogo providerId={id} className="size-3.5" />
                {CHIP_LABELS[id]}
              </FilterChip>
            ))}
            <span className="mx-1 hidden h-3.5 w-px bg-foreground/10 sm:block" />
            <FilterChip active={media === "image"} onClick={() => setMedia(media === "image" ? "all" : "image")}>Image</FilterChip>
            <FilterChip active={media === "video"} onClick={() => setMedia(media === "video" ? "all" : "video")}>Video</FilterChip>
            <span className="mx-1 hidden h-3.5 w-px bg-foreground/10 sm:block" />
            <FilterChip active={readiness === "ready"} onClick={() => setReadiness(readiness === "ready" ? "all" : "ready")}>Ready</FilterChip>
            <FilterChip active={readiness === "discovered"} onClick={() => setReadiness(readiness === "discovered" ? "all" : "discovered")}>Cataloged</FilterChip>
            <FilterChip active={readiness === "deprecated"} onClick={() => setReadiness(readiness === "deprecated" ? "all" : "deprecated")}>Deprecated</FilterChip>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] overflow-x-auto px-5 sm:px-8">
        {filteredModels.length ? (
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-foreground/8 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/35">
                <th className="py-3 pr-4 font-medium">Model</th>
                <th className="py-3 pr-4 font-medium">Provider</th>
                <th className="py-3 pr-4 font-medium">Family</th>
                <th className="py-3 pr-4 font-medium">Media</th>
                <th className="py-3 pr-4 font-medium">Lifecycle</th>
                <th className="py-3 pr-4 font-medium">Eikon</th>
                <th className="py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => (
                <ModelRow key={model.id} model={model} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex min-h-72 items-center justify-center text-center">
            <div>
              <p className="text-sm">No matching models</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setProvider("all");
                  setMedia("all");
                  setReadiness("all");
                }}
                className="mt-2 text-[12px] text-foreground/45 underline underline-offset-4 hover:text-foreground"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(chipClass, active ? chipActive : chipIdle)}>
      {children}
    </button>
  );
}

function ModelRow({ model }: { model: ModelCatalogEntry }) {
  const family = MODEL_FAMILY_REGISTRY[model.familyId];

  return (
    <tr
      className="border-b border-foreground/[0.06] [contain-intrinsic-size:0_56px] [content-visibility:auto] hover:bg-foreground/[0.03]"
      title={model.availabilityNotes}
    >
      <td className="py-3.5 pr-4 align-middle">
        <p className="text-[13.5px] font-medium tracking-[-0.015em]">{model.displayName}</p>
        <p className="mt-0.5 font-mono text-[11px] text-foreground/40">{model.nativeId ?? model.id}</p>
      </td>
      <td className="py-3.5 pr-4 align-middle">
        <span className="inline-flex items-center gap-2 text-[13px] text-foreground/70">
          <ProviderLogo providerId={model.providerId} className="size-3.5" />
          {PROVIDER_META[model.providerId].label}
        </span>
      </td>
      <td className="py-3.5 pr-4 align-middle text-[13px] text-foreground/60">{family.displayName}</td>
      <td className="py-3.5 pr-4 align-middle text-[13px] capitalize text-foreground/60">{model.mediaTypes.join(" · ")}</td>
      <td className="py-3.5 pr-4 align-middle text-[13px] capitalize text-foreground/55">{model.providerLifecycle}</td>
      <td className="py-3.5 pr-4 align-middle text-[13px]">
        {model.readiness === "ready" ? (
          <span className="text-emerald-600 dark:text-emerald-400">Ready</span>
        ) : (
          <span className="text-foreground/35">{model.readiness === "deprecated" ? "Deprecated" : "—"}</span>
        )}
      </td>
      <td className="py-3.5 align-middle">
        <a
          href={model.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-foreground/40 hover:text-foreground"
        >
          Docs
          <ArrowUpRight className="size-3" strokeWidth={1.75} />
        </a>
      </td>
    </tr>
  );
}
