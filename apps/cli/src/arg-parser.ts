import type { ParsedArgs } from "./types";

function addFlag(
  flags: Record<string, string | string[] | boolean>,
  key: string,
  value: string | boolean
) {
  const existing = flags[key];
  if (existing === undefined) {
    flags[key] = value;
    return;
  }

  if (typeof existing === "boolean") {
    flags[key] = [String(existing), String(value)];
    return;
  }

  if (Array.isArray(existing)) {
    existing.push(String(value));
    flags[key] = existing;
    return;
  }

  flags[key] = [existing, String(value)];
}

export function parseArgv(argv: string[]): ParsedArgs {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [commandToken] = normalizedArgv;
  const commandIsFlag = typeof commandToken === "string" && commandToken.startsWith("-");
  const command = commandToken && !commandIsFlag ? commandToken : null;
  const rest = command ? normalizedArgv.slice(1) : normalizedArgv;
  const positional: string[] = [];
  const flags: Record<string, string | string[] | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === "-h") {
      flags.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const arg = token.slice(2);
    const eqIndex = arg.indexOf("=");
    if (eqIndex !== -1) {
      const key = arg.slice(0, eqIndex);
      const value = arg.slice(eqIndex + 1);
      addFlag(flags, key, value);
      continue;
    }

    const next = rest[i + 1];
    if (next && !next.startsWith("-")) {
      addFlag(flags, arg, next);
      i++;
      continue;
    }

    addFlag(flags, arg, true);
  }

  return { command, positional, flags };
}

export function getFlagString(
  flags: Record<string, string | string[] | boolean>,
  key: string
): string | undefined {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") return undefined;
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

export function getFlagBoolean(
  flags: Record<string, string | string[] | boolean>,
  key: string
): boolean {
  const value = flags[key];
  return value === true || value === "true";
}

export function getFlagList(
  flags: Record<string, string | string[] | boolean>,
  key: string
): string[] {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value;
  return [value];
}
