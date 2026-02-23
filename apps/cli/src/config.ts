import { readFile, writeFile } from "node:fs/promises";
import type { CliConfig } from "./types";
import { DEFAULT_BASE_URL } from "./constants";
import { ensureEikonDirs, getConfigPath, getDefaultOutputDir } from "./paths";
import { isAspectRatio, isGenerationMode, isImageSize } from "./validators";

const DEFAULT_CONFIG: CliConfig = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: "",
  defaultImageSize: "2K",
  defaultAspectRatio: "square",
  defaultMode: "text-to-image",
  outputDirectory: getDefaultOutputDir(),
};

export async function loadConfig(): Promise<CliConfig> {
  await ensureEikonDirs();
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    return sanitizeConfig(parsed);
  } catch {
    await saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await ensureEikonDirs();
  await writeFile(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function patchConfig(patch: Partial<CliConfig>): Promise<CliConfig> {
  const current = await loadConfig();
  const next = sanitizeConfig({ ...current, ...patch });
  await saveConfig(next);
  return next;
}

export async function setConfigValue(key: string, value: string): Promise<CliConfig> {
  switch (key) {
    case "baseUrl":
      return patchConfig({ baseUrl: value.trim() });
    case "apiKey":
      return patchConfig({ apiKey: value.trim() });
    case "defaultImageSize":
      if (!isImageSize(value)) throw new Error(`Invalid image size: ${value}`);
      return patchConfig({ defaultImageSize: value });
    case "defaultAspectRatio":
      if (!isAspectRatio(value)) throw new Error(`Invalid aspect ratio: ${value}`);
      return patchConfig({ defaultAspectRatio: value });
    case "defaultMode":
      if (!isGenerationMode(value)) throw new Error(`Invalid mode: ${value}`);
      return patchConfig({ defaultMode: value });
    case "outputDirectory":
      return patchConfig({ outputDirectory: value.trim() });
    default:
      throw new Error(`Unknown config key: ${key}`);
  }
}

export function sanitizeConfig(input: Partial<CliConfig>): CliConfig {
  return {
    baseUrl: input.baseUrl?.trim() || DEFAULT_CONFIG.baseUrl,
    apiKey: input.apiKey?.trim() || "",
    defaultImageSize: isImageSize(input.defaultImageSize ?? "") ? input.defaultImageSize! : DEFAULT_CONFIG.defaultImageSize,
    defaultAspectRatio: isAspectRatio(input.defaultAspectRatio ?? "") ? input.defaultAspectRatio! : DEFAULT_CONFIG.defaultAspectRatio,
    defaultMode: isGenerationMode(input.defaultMode ?? "") ? input.defaultMode! : DEFAULT_CONFIG.defaultMode,
    outputDirectory: input.outputDirectory?.trim() || DEFAULT_CONFIG.outputDirectory,
  };
}
