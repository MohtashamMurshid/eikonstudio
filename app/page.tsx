"use client";

import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { Stats } from "@/components/landing/stats";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { DetailedFeatures } from "@/components/landing/detailed-features";
import { Pricing } from "@/components/landing/pricing";
import { LandingFooter } from "@/components/landing/footer";
import { StripedDivider } from "@/components/landing/striped-divider";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-foreground">
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
