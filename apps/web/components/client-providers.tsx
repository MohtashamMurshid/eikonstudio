"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ClientProviders() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <Toaster 
        theme={resolvedTheme === "dark" ? "dark" : "light"} 
        richColors 
        closeButton 
      />
    </>
  );
}

