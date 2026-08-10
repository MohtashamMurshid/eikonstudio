import Image from "next/image";
import {
  Blocks,
  ChevronRight,
  Images,
  LayoutGrid,
  LibraryBig,
  PanelLeft,
  Plug,
  Star,
  TrendingUp,
} from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";

const sidebarNav = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Catalog", icon: LibraryBig, active: false },
  { label: "Playground", icon: Blocks, active: false },
  { label: "Gallery", icon: Images, active: false },
  { label: "Providers", icon: Plug, active: false },
];

const statCards = [
  { label: "Generations", value: "24,987", trend: "+11.0%" },
  { label: "Assets stored", value: "8,412", trend: "+4.2%" },
];

const chartMonths: {
  label: string;
  value: number;
  callout: string | null;
  active?: boolean;
}[] = [
  { label: "Jan", value: 62, callout: "120K" },
  { label: "Feb", value: 100, callout: "80K", active: true },
  { label: "Mar", value: 70, callout: "90K" },
  { label: "Apr", value: 30, callout: "34K" },
  { label: "May", value: 92, callout: "130K" },
  { label: "Jun", value: 55, callout: null },
];

export function HeroVisual() {
  return (
    <div className="relative flex h-full min-h-[460px] items-center overflow-hidden font-sans sm:min-h-[580px]">
      <Image
        src="/ocean-cliffs-aerial.png"
        alt="An aerial coastline scene generated inside Eikon Studio"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        priority
      />

      {/* Vertically centered; intentionally oversized + right-shifted so ~half clips off-screen */}
      <div className="relative z-10 ml-5 w-[140%] max-w-none sm:ml-9 lg:ml-12 lg:w-[155%]">
        <div className="flex overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_60px_120px_-30px_rgba(0,0,0,0.55)] dark:border-white/10">
          <div className="flex w-[150px] shrink-0 flex-col border-r border-border py-3 sm:w-[172px]">
            <div className="mx-2.5 mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-emerald-950">
                <LogoIcon className="size-3.5" strokeWidth={2.4} />
              </span>
              <span className="truncate text-[12px] font-semibold text-foreground">
                Eikon
              </span>
            </div>

            <nav className="flex flex-col gap-0.5 px-2">
              {sidebarNav.map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                      item.active
                        ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" strokeWidth={1.6} />
                    <span className="truncate">{item.label}</span>
                  </span>
                );
              })}
            </nav>

            <div className="mt-auto flex items-center gap-2 px-3 pt-10">
              <span className="size-5 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600" />
              <span className="truncate text-[10.5px] text-muted-foreground">
                Your workspace
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 bg-muted">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <PanelLeft className="size-3.5 text-foreground/30" strokeWidth={1.6} />
              <Star className="size-3.5 text-foreground/30" strokeWidth={1.6} />
              <div className="ml-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span>Dashboards</span>
                <ChevronRight className="size-2.5" strokeWidth={1.8} />
                <span className="text-foreground/70">Overview</span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <h3 className="font-serif text-xl text-foreground sm:text-2xl">
                Dashboard
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="text-foreground/70">Welcome,</span> track
                generations, providers, and spend in one place.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-border bg-card p-3.5"
                  >
                    <p className="text-[10px] text-muted-foreground">
                      {card.label}
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="font-serif text-xl text-foreground sm:text-2xl">
                        {card.value}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
                        {card.trend}
                        <TrendingUp className="size-2.5" strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] text-muted-foreground">
                  Generation volume
                </p>
                <p className="mt-1 font-serif text-xl text-foreground sm:text-2xl">
                  18,204 monthly jobs
                </p>
                <p className="mt-1 text-[9px] text-muted-foreground">
                  20 May, 2026{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +12%
                  </span>{" "}
                  vs last month
                </p>

                <div className="mt-5 flex items-end gap-2.5 sm:gap-3">
                  {chartMonths.map((month) => (
                    <div
                      key={month.label}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      {month.active ? (
                        <span className="rounded bg-foreground px-1 py-0.5 text-[8px] font-medium text-background">
                          {month.callout}
                        </span>
                      ) : (
                        <span className="h-[15px] text-[8px] text-muted-foreground">
                          {month.callout}
                        </span>
                      )}
                      <div className="flex h-24 w-full items-end sm:h-28">
                        <span
                          className={`w-full rounded-md ${
                            month.active
                              ? "bg-emerald-500"
                              : "bg-foreground/[0.07] dark:bg-white/10"
                          }`}
                          style={{ height: `${month.value}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-muted-foreground">
                        {month.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
