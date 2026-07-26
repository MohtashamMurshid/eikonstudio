import { LogoIcon } from "@/components/logo-icon";

function Callout({
  className,
  label,
  align = "left",
}: {
  className: string;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`absolute hidden items-center gap-2 text-[7px] uppercase tracking-[0.14em] text-foreground/45 sm:flex ${className}`}
    >
      {align === "right" && <span className="h-px w-8 bg-foreground/20" />}
      <span>{label}</span>
      {align === "left" && <span className="h-px w-8 bg-foreground/20" />}
    </div>
  );
}

export function TechnicalVisual() {
  return (
    <div className="relative flex min-h-[480px] items-center justify-center overflow-hidden px-5 py-16 sm:min-h-[620px] sm:px-10">
      <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] landing-dots" />

      <div className="absolute left-6 top-5 text-[7px] uppercase tracking-[0.16em] text-foreground/40">
        Fig. 01 — generation engine
      </div>
      <div className="absolute right-6 top-5 flex items-center gap-2 text-[7px] uppercase tracking-[0.16em] text-foreground/40">
        <span>Live render</span>
        <span className="size-1.5 rounded-full bg-emerald-500" />
      </div>

      <Callout className="left-[4%] top-[32%]" label="Prompt input" />
      <Callout className="right-[3%] top-[38%]" label="Model array" align="right" />
      <Callout className="left-[3%] bottom-[28%]" label="Asset library" />
      <Callout className="right-[4%] bottom-[22%]" label="Export bus" align="right" />

      <div className="relative w-full max-w-[480px]">
        <div className="absolute -inset-10 bg-emerald-500/[0.055] blur-3xl" />
        <svg
          viewBox="0 0 520 520"
          className="relative h-auto w-full text-foreground"
          role="img"
          aria-labelledby="render-unit-title render-unit-desc"
        >
          <title id="render-unit-title">Eikon render unit</title>
          <desc id="render-unit-desc">
            A technical illustration of the Eikon image generation workspace.
          </desc>
          <defs>
            <linearGradient id="shell-face" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--card)" />
              <stop offset="1" stopColor="var(--secondary)" />
            </linearGradient>
            <linearGradient id="screen-glow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#063b2f" />
              <stop offset="0.55" stopColor="#0b1714" />
              <stop offset="1" stopColor="#020504" />
            </linearGradient>
            <linearGradient id="art-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#34d399" />
              <stop offset="0.44" stopColor="#14532d" />
              <stop offset="1" stopColor="#030712" />
            </linearGradient>
            <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="13" />
            </filter>
            <clipPath id="screen-clip">
              <rect x="126" y="139" width="226" height="177" rx="3" />
            </clipPath>
          </defs>

          <ellipse
            cx="270"
            cy="450"
            rx="150"
            ry="20"
            fill="currentColor"
            opacity=".09"
            filter="url(#soft-shadow)"
          />

          <path
            d="M111 91 371 66l48 29-259 26Z"
            fill="var(--secondary)"
            stroke="currentColor"
            strokeOpacity=".18"
          />
          <path
            d="m371 66 48 29v288l-48 38Z"
            fill="var(--muted)"
            stroke="currentColor"
            strokeOpacity=".2"
          />
          <path
            d="M111 91 371 66v355L111 391Z"
            fill="url(#shell-face)"
            stroke="currentColor"
            strokeOpacity=".28"
            strokeWidth="1.2"
          />

          <path d="M111 91 371 66" stroke="currentColor" strokeOpacity=".35" />
          <path d="M111 329 371 342" stroke="currentColor" strokeOpacity=".16" />

          <rect
            x="121"
            y="132"
            width="241"
            height="194"
            rx="5"
            fill="currentColor"
            opacity=".88"
          />
          <g clipPath="url(#screen-clip)">
            <rect x="126" y="139" width="226" height="177" fill="url(#screen-glow)" />
            <path d="M126 292 216 214l53 39 83-87v150H126Z" fill="#123f30" />
            <circle cx="301" cy="184" r="45" fill="url(#art-gradient)" opacity=".78" />
            <path
              d="M126 280c48-18 73-12 110 7 35 18 75 12 116-11v40H126Z"
              fill="#020b08"
              opacity=".9"
            />
            <g fill="#34d399">
              <rect x="139" y="153" width="65" height="3" opacity=".92" />
              <rect x="139" y="161" width="43" height="2" opacity=".45" />
              <rect x="139" y="169" width="82" height="2" opacity=".45" />
            </g>
            <rect x="139" y="294" width="49" height="3" fill="#34d399" opacity=".7" />
            <rect x="193" y="294" width="30" height="3" fill="#34d399" opacity=".25" />
            <path
              d="M327 144v167M301 144v167M275 144v167M249 144v167M223 144v167M197 144v167M171 144v167M145 144v167"
              stroke="#fff"
              strokeOpacity=".025"
            />
            <path
              d="M130 167h218M130 193h218M130 219h218M130 245h218M130 271h218M130 297h218"
              stroke="#fff"
              strokeOpacity=".025"
            />
          </g>
          <rect
            x="126"
            y="139"
            width="226"
            height="177"
            rx="3"
            fill="none"
            stroke="#34d399"
            strokeOpacity=".38"
          />

          <g transform="translate(121 344)">
            {Array.from({ length: 7 }).map((_, index) => (
              <rect
                key={`slot-${index}`}
                x={index * 28}
                y={index * 1.25}
                width="20"
                height="10"
                fill="currentColor"
                opacity={index === 0 ? ".72" : ".27"}
              />
            ))}
            <rect x="0" y="24" width="132" height="4" fill="currentColor" opacity=".13" />
            <rect x="0" y="34" width="90" height="4" fill="currentColor" opacity=".13" />
          </g>

          <g transform="translate(305 347)">
            <circle cx="0" cy="0" r="7" fill="#34d399" />
            <circle cx="25" cy="1" r="7" fill="none" stroke="currentColor" strokeOpacity=".45" />
            <circle cx="49" cy="2" r="7" fill="none" stroke="currentColor" strokeOpacity=".2" />
            <rect x="-7" y="22" width="65" height="8" fill="currentColor" opacity=".14" />
          </g>

          <g transform="translate(384 126)">
            <circle cx="0" cy="0" r="12" fill="#34d399" />
            <circle cx="0" cy="0" r="4" fill="#052e26" />
            <rect x="-7" y="25" width="14" height="14" fill="currentColor" opacity=".48" />
            <path d="M-7 49H7M0 42v14" stroke="currentColor" strokeWidth="4" opacity=".7" />
            <circle cx="0" cy="78" r="8" fill="currentColor" opacity=".72" />
            <circle cx="0" cy="103" r="5" fill="currentColor" opacity=".17" />
            <rect x="-7" y="124" width="14" height="44" fill="#34d399" opacity=".72" />
          </g>

          <g transform="translate(239 83)">
            <rect x="-14" y="-10" width="28" height="19" fill="var(--foreground)" />
            <foreignObject x="-8" y="-5" width="16" height="12">
              <div className="flex h-full w-full items-center justify-center text-background">
                <LogoIcon className="size-2.5" strokeWidth={2} />
              </div>
            </foreignObject>
          </g>

          <g fill="currentColor" opacity=".3">
            <rect x="392" y="108" width="8" height="5" />
            <rect x="404" y="108" width="8" height="5" />
            <rect x="392" y="117" width="8" height="5" />
            <rect x="404" y="117" width="8" height="5" />
          </g>

          <path d="M238 67V37" stroke="currentColor" strokeOpacity=".35" />
          <circle cx="238" cy="32" r="3" fill="#34d399" />
          <text
            x="238"
            y="20"
            textAnchor="middle"
            fill="currentColor"
            opacity=".42"
            fontSize="7"
            letterSpacing="1.2"
          >
            EIKON CORE
          </text>
        </svg>
      </div>

      <div className="absolute bottom-5 right-6 text-right text-[7px] uppercase leading-relaxed tracking-[0.14em] text-foreground/35">
        Rev 01 / Build 2026
        <br />
        Models: Gemini + GPT Image
      </div>
    </div>
  );
}
