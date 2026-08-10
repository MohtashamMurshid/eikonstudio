"use client";

import Image from "next/image";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Blocks,
  Check,
  ChevronRight,
  Circle,
  ImageIcon,
  Images,
  LayoutGrid,
  LibraryBig,
  PanelLeft,
  Play,
  Plug,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";

type MockPage = "Dashboard" | "Catalog" | "Playground" | "Gallery" | "Providers";

type NavItem = {
  label: MockPage;
  icon: LucideIcon;
};

const sidebarNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Catalog", icon: LibraryBig },
  { label: "Playground", icon: Blocks },
  { label: "Gallery", icon: Images },
  { label: "Providers", icon: Plug },
];

const chartMonths = [
  { label: "Jan", value: 62, callout: "120K" },
  { label: "Feb", value: 100, callout: "148K", active: true },
  { label: "Mar", value: 70, callout: "90K" },
  { label: "Apr", value: 30, callout: "34K" },
  { label: "May", value: 92, callout: "130K" },
  { label: "Jun", value: 55, callout: "76K" },
];

const models = [
  {
    name: "GPT Image 2",
    provider: "OpenAI",
    speed: "Balanced",
    color: "bg-emerald-500",
  },
  {
    name: "Nano Banana Pro",
    provider: "Google",
    speed: "Fast",
    color: "bg-blue-500",
  },
  {
    name: "FLUX.2 Max",
    provider: "Black Forest Labs",
    speed: "Quality",
    color: "bg-violet-500",
  },
];

const galleryImages = [
  { src: "/ai-image-japanese-garden.png", alt: "AI generated Japanese garden" },
  { src: "/sakura-castle-cityscape.png", alt: "AI generated sakura cityscape" },
  { src: "/neon-city-rain.png", alt: "AI generated neon city in rain" },
  { src: "/sunlit-mystic-forest.png", alt: "AI generated sunlit forest" },
];

const providers = [
  { name: "OpenAI", detail: "Images and edits", color: "bg-emerald-500" },
  { name: "Google", detail: "Images and video", color: "bg-blue-500" },
  { name: "Black Forest Labs", detail: "FLUX image models", color: "bg-violet-500" },
  { name: "Kling", detail: "Video generation", color: "bg-orange-500" },
];

function DashboardPage({ onNewGeneration }: { onNewGeneration: () => void }) {
  return (
    <div className="mock-page-enter">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
            Workspace overview
          </p>
          <h3 className="mt-1 text-[23px] font-semibold tracking-[-0.035em] text-foreground sm:text-[27px]">
            Good morning, Mohtasham
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Your creative pipeline is running smoothly.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewGeneration}
          className="mock-button hidden items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[10px] font-semibold text-background sm:inline-flex"
        >
          <Sparkles className="size-3" />
          New generation
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[
          ["Generations", "24,987", "+11.0%"],
          ["Assets stored", "8,412", "+4.2%"],
          ["Avg. cost", "$0.042", "−7.4%"],
        ].map(([label, value, trend]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <p className="truncate text-[9px] font-medium text-muted-foreground">{label}</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <p className="text-[18px] font-semibold tracking-[-0.035em] text-foreground sm:text-[21px]">
                {value}
              </p>
              <span className="hidden items-center gap-0.5 text-[8px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400">
                {trend}
                <TrendingUp className="size-2" strokeWidth={2} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-medium text-muted-foreground">Generation volume</p>
            <p className="mt-0.5 text-[18px] font-semibold tracking-[-0.035em] text-foreground sm:text-[21px]">
              18,204 monthly jobs
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">
            +12.4%
          </span>
        </div>

        <div className="mt-3 flex h-[116px] items-end gap-2 sm:gap-2.5">
          {chartMonths.map((month, index) => (
            <div key={month.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[7px] ${month.active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {month.callout}
              </span>
              <div className="flex h-[84px] w-full items-end overflow-hidden rounded-md bg-foreground/[0.035] dark:bg-white/[0.04]">
                <span
                  className={`mock-chart-bar w-full rounded-md ${month.active ? "bg-emerald-500" : "bg-foreground/[0.1] dark:bg-white/15"}`}
                  style={{ height: `${month.value}%`, animationDelay: `${index * 55}ms` }}
                />
              </div>
              <span className="text-[7px] font-medium text-muted-foreground">{month.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CatalogPage({ onOpen }: { onOpen: (model: string) => void }) {
  const [query, setQuery] = useState("");
  const filteredModels = models.filter((model) =>
    `${model.name} ${model.provider}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mock-page-enter">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
            Model catalog
          </p>
          <h3 className="mt-1 text-[25px] font-semibold tracking-[-0.035em] text-foreground">Pick your engine</h3>
        </div>
        <label className="flex h-8 w-[190px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-muted-foreground">
          <Search className="size-3" />
          <span className="sr-only">Search models</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models"
            className="min-w-0 flex-1 bg-transparent text-[9px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {filteredModels.map((model) => (
          <article key={model.name} className="mock-card group rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <span className={`flex size-7 items-center justify-center rounded-lg ${model.color} text-white`}>
                <Sparkles className="size-3.5" />
              </span>
              <span className="rounded-full bg-foreground/[0.05] px-2 py-1 text-[7px] font-semibold text-muted-foreground">
                {model.speed}
              </span>
            </div>
            <h4 className="mt-4 truncate text-[12px] font-semibold tracking-[-0.02em] text-foreground">{model.name}</h4>
            <p className="mt-0.5 truncate text-[8px] text-muted-foreground">{model.provider}</p>
            <button
              type="button"
              onClick={() => onOpen(model.name)}
              className="mock-button mt-4 flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-[8px] font-semibold text-foreground hover:border-foreground/20 hover:bg-foreground/[0.03]"
            >
              Try model
              <ArrowUpRight className="size-2.5" />
            </button>
          </article>
        ))}
      </div>

      {filteredModels.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card p-8 text-center text-[10px] text-muted-foreground">
          No models match “{query}”.
        </div>
      ) : null}
    </div>
  );
}

function PlaygroundPage({ selectedModel }: { selectedModel: string }) {
  const [prompt, setPrompt] = useState("A glass observatory above a sea of clouds, editorial photography");
  const [generation, setGeneration] = useState(0);
  const [saved, setSaved] = useState(false);

  return (
    <div className="mock-page-enter">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">Playground</p>
        <h3 className="mt-1 text-[25px] font-semibold tracking-[-0.035em] text-foreground">Make something new</h3>
      </div>

      <div className="mt-4 grid grid-cols-[1.05fr_0.95fr] gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Prompt</span>
            <span className="rounded-md bg-foreground/[0.05] px-2 py-1 text-[8px] font-medium text-foreground">{selectedModel}</span>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-3 h-[112px] w-full resize-none bg-transparent text-[11px] leading-5 text-foreground outline-none"
            aria-label="Generation prompt"
          />
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex gap-1.5 text-[8px] text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1">1:1</span>
              <span className="rounded-md bg-muted px-2 py-1">2K</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setGeneration((current) => current + 1);
                setSaved(false);
              }}
              className="mock-button flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[9px] font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              <Play className="size-2.5 fill-current" />
              Generate
            </button>
          </div>
        </div>

        <div className="relative min-h-[240px] overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
          <Image
            key={generation}
            src="/glass-panels-mountain-studio.png"
            alt="Generated mountain studio preview"
            fill
            sizes="360px"
            className="mock-result-enter object-cover"
          />
          <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between rounded-lg bg-black/55 px-2.5 py-2 text-white backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-[8px] font-medium">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Ready in 4.2s
            </span>
            <button
              type="button"
              onClick={() => setSaved((current) => !current)}
              className="mock-button rounded-md bg-white/10 px-2 py-1 text-[8px] hover:bg-white/20"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryPage() {
  const [selected, setSelected] = useState(0);
  const [uploadQueued, setUploadQueued] = useState(false);

  return (
    <div className="mock-page-enter">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">Gallery</p>
          <h3 className="mt-1 text-[25px] font-semibold tracking-[-0.035em] text-foreground">Recent creations</h3>
        </div>
        <button
          type="button"
          onClick={() => setUploadQueued((current) => !current)}
          className="mock-button flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[9px] font-semibold text-foreground hover:bg-foreground/[0.03]"
        >
          {uploadQueued ? <Check className="size-3 text-emerald-500" /> : <ImageIcon className="size-3" />}
          {uploadQueued ? "Upload ready" : "Upload"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {galleryImages.map((asset, index) => (
          <button
            type="button"
            key={asset.src}
            onClick={() => setSelected(index)}
            className={`mock-gallery-card group relative aspect-[4/5] overflow-hidden rounded-xl border-2 text-left ${selected === index ? "border-emerald-500" : "border-transparent"}`}
            aria-label={`Select ${asset.alt}`}
            aria-pressed={selected === index}
          >
            <Image src={asset.src} alt={asset.alt} fill sizes="180px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-x-2 bottom-2 rounded-md bg-black/45 px-2 py-1.5 text-[7px] font-medium text-white backdrop-blur-md">
              {index === 0 ? "Garden study" : index === 1 ? "Sakura city" : index === 2 ? "Neon rain" : "Forest light"}
            </span>
            {selected === index ? (
              <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-emerald-950">
                <Check className="size-3" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvidersPage() {
  const [connected, setConnected] = useState(() => new Set(["OpenAI", "Google"]));

  function toggleProvider(name: string) {
    setConnected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="mock-page-enter">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Providers</p>
        <h3 className="mt-1 text-[25px] font-semibold tracking-[-0.035em] text-foreground">Bring your own keys</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Connect directly. Your credentials remain encrypted and under your control.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {providers.map((provider) => {
          const isConnected = connected.has(provider.name);
          return (
            <div key={provider.name} className="mock-card flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${provider.color} text-white`}>
                <Circle className="size-3 fill-current" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-foreground">{provider.name}</p>
                <p className="truncate text-[8px] text-muted-foreground">{provider.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleProvider(provider.name)}
                className={`mock-button rounded-lg px-2.5 py-2 text-[8px] font-semibold ${isConnected ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border border-border text-foreground hover:bg-foreground/[0.03]"}`}
              >
                {isConnected ? "Connected" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 p-3 text-[8px] text-muted-foreground">
        <Check className="size-3 text-emerald-500" />
        Keys are encrypted before they are stored. Eikon never adds model markup.
      </div>
    </div>
  );
}

export function HeroVisual() {
  const [activePage, setActivePage] = useState<MockPage>("Dashboard");
  const [favorite, setFavorite] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState("GPT Image 2");

  function openModel(model: string) {
    setSelectedModel(model);
    setActivePage("Playground");
  }

  return (
    <div className="relative flex h-full min-h-[490px] items-center overflow-hidden font-sans sm:min-h-[600px]">
      <Image
        src="/ocean-cliffs-aerial.png"
        alt="An aerial coastline scene generated inside Eikon Studio"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-sky-950/10 via-transparent to-white/10" aria-hidden="true" />

      <div className="dashboard-reveal relative z-10 ml-5 w-[760px] shrink-0 sm:ml-10 sm:w-[900px] lg:ml-12 lg:w-[940px] xl:w-[1040px]">
        <div className="flex h-[520px] overflow-hidden rounded-2xl border border-white/20 bg-card shadow-[0_60px_120px_-30px_rgba(0,0,0,0.55)] sm:h-[548px]">
          <aside className={`flex shrink-0 flex-col border-r border-border bg-card py-3 transition-[width] duration-300 ${sidebarCollapsed ? "w-[54px]" : "w-[142px] sm:w-[164px]"}`}>
            <div className="mx-2.5 mb-4 flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-emerald-950">
                <LogoIcon className="size-3.5" strokeWidth={2.4} />
              </span>
              {sidebarCollapsed ? null : <span className="truncate text-[12px] font-semibold tracking-[-0.02em] text-foreground">Eikon</span>}
            </div>

            <nav className="flex flex-col gap-0.5 px-2" aria-label="Dashboard preview pages">
              {sidebarNav.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.label;
                return (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => setActivePage(item.label)}
                    className={`mock-nav-item flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] ${active ? "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="size-3.5 shrink-0" strokeWidth={1.7} />
                    {sidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>

            <div className={`mx-3 mt-auto rounded-xl border border-border bg-muted p-2.5 ${sidebarCollapsed ? "hidden" : ""}`}>
              <div className="flex items-center justify-between text-[8px] font-medium text-muted-foreground">
                <span>Monthly usage</span>
                <span>64%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                <span className="mock-usage-bar block h-full w-[64%] rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 pb-1 pt-3">
              <span className="size-5 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600" />
              {sidebarCollapsed ? null : <span className="truncate text-[9px] font-medium text-muted-foreground">Mohtasham</span>}
            </div>
          </aside>

          <div className="min-w-0 flex-1 bg-muted">
            <div className="flex h-11 items-center gap-2.5 border-b border-border bg-card/70 px-4 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="mock-icon-button"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={sidebarCollapsed}
              >
                <PanelLeft className="size-3.5" strokeWidth={1.7} />
              </button>
              <button
                type="button"
                onClick={() => setFavorite((current) => !current)}
                className={`mock-icon-button ${favorite ? "text-amber-500" : ""}`}
                aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={favorite}
              >
                <Star className={`size-3.5 ${favorite ? "fill-current" : ""}`} strokeWidth={1.7} />
              </button>
              <div className="ml-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span>Workspace</span>
                <ChevronRight className="size-2.5" strokeWidth={1.8} />
                <span className="font-medium text-foreground/80">{activePage}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="hidden items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[7px] font-medium text-muted-foreground sm:flex">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  All systems live
                </span>
              </div>
            </div>

            <main className="h-[calc(100%-44px)] overflow-hidden p-4 sm:p-5" aria-live="polite">
              <div key={activePage} className="max-w-[710px]">
                {activePage === "Dashboard" ? <DashboardPage onNewGeneration={() => setActivePage("Playground")} /> : null}
                {activePage === "Catalog" ? <CatalogPage onOpen={openModel} /> : null}
                {activePage === "Playground" ? <PlaygroundPage selectedModel={selectedModel} /> : null}
                {activePage === "Gallery" ? <GalleryPage /> : null}
                {activePage === "Providers" ? <ProvidersPage /> : null}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
