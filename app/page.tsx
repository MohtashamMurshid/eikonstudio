import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { DetailedFeatures } from "@/components/landing/detailed-features";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Eikon — The AI image workshop",
  description:
    "Generate, transform, and organize production-ready images with a precise AI creative workspace.",
  openGraph: {
    title: "Eikon — The AI image workshop",
    description:
      "A precise creative workspace for generating, transforming, and organizing images with AI.",
  },
};

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <div className="landing-grid" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1240px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden border border-foreground/15 bg-background shadow-[0_20px_70px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
          <LandingHeader />
          <main>
            <Hero />
            <Stats />
            <FeaturesGrid />
            <DetailedFeatures />
          </main>
          <LandingFooter />
        </div>
      </div>
    </div>
  );
}
