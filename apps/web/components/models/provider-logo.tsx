import type { ProviderId } from "@eikonstudio/core";

import { cn } from "@/lib/utils";

export const PROVIDER_META = {
  openai: { label: "OpenAI", slug: "openai", color: false },
  google: { label: "Google", slug: "google", color: true },
  bfl: { label: "Black Forest Labs", slug: "bfl", color: false },
  byteplus: { label: "BytePlus", slug: "bytedance", color: true },
  kling: { label: "Kling AI", slug: "kling", color: true },
  xai: { label: "xAI", slug: "xai", color: false },
} as const satisfies Record<ProviderId, { label: string; slug: string; color: boolean }>;

export function ProviderLogo({
  providerId,
  className,
  variant = "mono",
}: {
  providerId: ProviderId;
  className?: string;
  variant?: "mono" | "color";
}) {
  const { label, slug, color } = PROVIDER_META[providerId];

  if (variant === "color") {
    return (
      <img
        src={color ? `/providers/${slug}-color.svg` : `/providers/${slug}.svg`}
        alt=""
        aria-hidden
        className={cn("size-4 shrink-0 object-contain", !color && "dark:invert", className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-block size-4 shrink-0 bg-current", className)}
      style={{
        mask: `url(/providers/${slug}.svg) center / contain no-repeat`,
        WebkitMask: `url(/providers/${slug}.svg) center / contain no-repeat`,
      }}
    />
  );
}
