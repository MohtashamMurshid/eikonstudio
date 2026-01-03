"use client";

import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";

export function ClientProviders() {
  return (
    <>
      <Toaster theme="dark" richColors closeButton />
      <Analytics />
    </>
  );
}

