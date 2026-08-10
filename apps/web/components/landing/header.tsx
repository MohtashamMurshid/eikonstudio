"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navigation = [
  ["Models", "/models"],
  ["Capabilities", "/#capabilities"],
  ["Use cases", "/#use-cases"],
  ["Pricing", "/#pricing"],
  ["Providers", "/#providers"],
] as const;

export function LandingHeader() {
  const { isAuthenticated } = useConvexAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="pointer-events-none absolute inset-x-3 top-3 z-50 flex items-start justify-between gap-3 font-sans sm:inset-x-5 sm:top-5"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <div className="pointer-events-auto relative">
        <nav
          className="flex items-center gap-0.5 rounded-2xl border border-black/[0.06] bg-card p-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.14)] dark:border-white/10"
          aria-label="Primary navigation"
        >
          <Link
            href="/"
            className="ui-pressable flex items-center gap-2 rounded-xl py-1.5 pl-2 pr-3 hover:bg-foreground/[0.04]"
            aria-label="Eikon home"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500 text-emerald-950">
              <LogoIcon className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.01em]">
              Eikon
            </span>
          </Link>

          <div className="hidden items-center lg:flex">
            {navigation.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="ui-pressable rounded-xl px-3 py-2 text-[13px] font-medium text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            className="ui-pressable flex items-center rounded-xl px-2.5 py-2 hover:bg-foreground/[0.04] lg:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="size-4" strokeWidth={1.5} />
            ) : (
              <Menu className="size-4" strokeWidth={1.5} />
            )}
          </button>
        </nav>

        {menuOpen && (
          <nav
            id="landing-mobile-nav"
            className="absolute left-0 top-full mt-2 flex w-56 flex-col rounded-2xl border border-black/[0.06] bg-card p-1.5 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.22)] dark:border-white/10 lg:hidden"
            aria-label="Compact navigation"
          >
            {navigation.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="ui-pressable rounded-xl px-3 py-2.5 text-[13px] font-medium text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-black/[0.06] bg-card p-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.14)] dark:border-white/10">
        <ThemeToggle />
        <Link
          href={isAuthenticated ? "/studio" : "/auth"}
          className="ui-pressable hidden items-center rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-85 sm:flex"
        >
          {isAuthenticated ? "Open studio" : "Start creating"}
        </Link>
      </div>
    </header>
  );
}
