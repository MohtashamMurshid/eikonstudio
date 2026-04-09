"use client";

import { VideoCombiner } from "@/components/video-combiner/index";
import { useStudioContext } from "../layout";

export default function CreateVideoPage() {
  const { apiKey } = useStudioContext();

  return (
    <div className="h-screen">
      <VideoCombiner apiKey={apiKey} />
    </div>
  );
}
