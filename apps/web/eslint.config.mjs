import coreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  // Project-specific ignores
  {
    ignores: [".next/**", "node_modules/**", "convex/_generated/**"],
  },
  ...coreWebVitals,
  // This repo historically relied on Next's (now-removed) `next lint`.
  // The Next 16 ESLint preset enables a few strict rules that are currently violated
  // across existing code. We disable those to keep `pnpm lint` usable.
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

