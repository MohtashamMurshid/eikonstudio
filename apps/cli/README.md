# @eikon/cli

CLI workspace package for Eikon Studio.

## Runtime

OpenTUI is Bun-first, so this package is intended to run with Bun for full TUI behavior.
If OpenTUI cannot initialize in your runtime, `eikon` falls back to the readline shell.

## Scripts

- `pnpm --filter @eikon/cli dev`
- `pnpm --filter @eikon/cli build`
- `pnpm --filter @eikon/cli typecheck`

## Commands

- `eikon` -> launch OpenTUI (fallback to shell)
- `eikon tui` -> force OpenTUI mode
- `eikon shell` -> readline interactive mode
- `eikon run "<prompt>" --size 2K --ratio square --out ./out.png`
- `eikon edit "<prompt>" --image ./input.png --out ./edited.png`
- `eikon config list|get|set`
- `eikon session list|new|show|delete`
