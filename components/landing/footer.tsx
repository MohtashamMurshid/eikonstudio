import { Logo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-8 px-6 bg-card">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Logo size="xs" />
        <p className="text-xs text-foreground/40">
          © 2026 Eikon. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

