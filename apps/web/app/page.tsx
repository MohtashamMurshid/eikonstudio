import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { ProvidersStrip } from "@/components/landing/providers-strip";
import { Stats } from "@/components/landing/stats";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { UseCases } from "@/components/landing/use-cases";
import { ByokPricing } from "@/components/landing/byok-pricing";
import { DetailedFeatures } from "@/components/landing/detailed-features";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Eikon Studio — Bring your own keys, own your image and video pipeline",
  description:
    "Open source, self-hostable generative-media platform. Connect OpenAI, Google, Black Forest Labs, BytePlus, Kling, and xAI behind one contract — no markup, no credits.",
  openGraph: {
    title: "Eikon Studio — Bring your own keys, own your image and video pipeline",
    description:
      "A BYOK generative-media platform with a public model catalog, playground, sandbox comparisons, gallery, usage analytics, and a unified API.",
  },
};

export default function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main>
        <Hero />
        <ProvidersStrip />
        <Stats />
        <FeaturesGrid />
        <UseCases />
        <ByokPricing />
        <DetailedFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
