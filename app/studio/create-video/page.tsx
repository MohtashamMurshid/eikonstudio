"use client";

import { VideoCombiner } from "@/components/video-combiner/index";
import { useStudioContext } from "../layout";

export default function CreateVideoPage() {
  const { apiKey } = useStudioContext();

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      {/* Video Creation Tab */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <VideoCombiner apiKey={apiKey} />
      </div>
    </div>
  );
}
