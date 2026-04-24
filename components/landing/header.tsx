"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { Github } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function LandingHeader() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Logo asLink href="/" size="sm" />

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/studio"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Studio
            </Link>
            <Link
              href="/api-docs"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              API
            </Link>
            <Link
              href="#features"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#docs"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/mohtashammurshid/eikonstudio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-full text-sm hover:bg-accent transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
          <Link
            href={isAuthenticated ? "/studio" : "/auth"}
            className="px-5 py-2 bg-emerald-500 text-white font-medium rounded-lg text-sm hover:bg-emerald-600 transition-all"
          >
            {isAuthenticated ? "Open Studio" : "Get Started"}
          </Link>
        </div>
      </div>
    </header>
  );
}

