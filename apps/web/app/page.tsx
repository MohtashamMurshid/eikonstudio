import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { DetailedFeatures } from "@/components/landing/detailed-features";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Eikon — Give every idea a point of view",
  description:
    "Explore and compare image and video models, run durable generations, and build through one open BYOK media platform.",
  openGraph: {
    title: "Eikon — Give every idea a point of view",
    description:
      "Explore and compare image and video models, run durable generations, and build through one open BYOK media platform.",
    images: ["/eikon-roman-camera-hero.png"],
  },
};

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen">
      <LandingHeader />
      <main>
        <Hero />
        <FeaturesGrid />
        <DetailedFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
