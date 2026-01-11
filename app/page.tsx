import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { Stats } from "@/components/landing/stats";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { DetailedFeatures } from "@/components/landing/detailed-features";
import { Pricing } from "@/components/landing/pricing";
import { LandingFooter } from "@/components/landing/footer";
import { StripedDivider } from "@/components/landing/striped-divider";

export const metadata: Metadata = {
  title: "Eikon Studio - AI Image Generation Platform",
  description: "Eikon combines, transforms, and generates images with AI — built for designers, creators, and developers who demand precision.",
  openGraph: {
    title: "Eikon Studio - AI Image Generation Platform",
    description: "The image studio for creative AI. Generate, transform, and combine images with precision.",
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* Striped border - top */}
      <div className="fixed top-[72px] left-0 right-0 z-40">
        <StripedDivider />
          </div>

      <Hero />

      <FeatureShowcase />

        {/* Striped border - middle */}
      <div className="max-w-5xl mx-auto mt-20">
        <StripedDivider />
            </div>

      <Stats />

      <FeaturesGrid />

        {/* Striped divider */}
      <div className="max-w-5xl mx-auto mt-24">
        <StripedDivider />
            </div>

      <DetailedFeatures />

        {/* Striped divider */}
      <div className="max-w-5xl mx-auto mt-24">
        <StripedDivider />
            </div>

      <Pricing />

      <LandingFooter />
    </div>
  );
}
