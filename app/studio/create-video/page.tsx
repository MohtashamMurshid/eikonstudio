"use client";

import { VideoCombiner } from "@/components/video-combiner/index";
import { useStudioContext } from "../layout";

export default function CreateVideoPage() {
  const { apiKey } = useStudioContext();

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#020202] min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />
        <VideoCombiner apiKey={apiKey} />
      </div>
    </div>
  );
}
