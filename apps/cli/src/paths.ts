import { homedir } from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { DEFAULT_OUTPUT_SUBDIR } from "./constants";

const EIKON_HOME_DIRNAME = ".eikon";

export function getEikonHomeDir(): string {
  return path.join(homedir(), EIKON_HOME_DIRNAME);
}

export function getConfigPath(): string {
  return path.join(getEikonHomeDir(), "config.json");
}

export function getSessionsDir(): string {
  return path.join(getEikonHomeDir(), "sessions");
}

export function getDefaultOutputDir(): string {
  return path.join(getEikonHomeDir(), DEFAULT_OUTPUT_SUBDIR);
}

export async function ensureEikonDirs(): Promise<void> {
  await mkdir(getEikonHomeDir(), { recursive: true });
  await mkdir(getSessionsDir(), { recursive: true });
  await mkdir(getDefaultOutputDir(), { recursive: true });
}
