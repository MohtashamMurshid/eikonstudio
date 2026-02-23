import {
  decodeDataUrl,
  generateImage,
  mimeTypeToExtension,
  normalizeBaseUrl,
  type AspectRatio,
  type GenerationMode,
  type ImageSize,
} from "@eikon/sdk";
import { getFlagBoolean, getFlagList, getFlagString } from "./arg-parser";
import { loadConfig, patchConfig, setConfigValue } from "./config";
import { makeOutputPath, imageFileToDataUrl, saveDataUrlToFile } from "./image-utils";
import {
  appendGenerationToSession,
  createSession,
  createSessionSettingsFromConfig,
  deleteSession,
  listSessions,
  loadSession,
  saveSession,
} from "./session-store";
import type { CliConfig, ParsedArgs, SessionRecord } from "./types";
import { isAspectRatio, isGenerationMode, isImageSize } from "./validators";

type ResolvedGenerationOptions = {
  prompt: string;
  baseUrl: string;
  imageSize: ImageSize;
  aspectRatio: AspectRatio;
  mode: GenerationMode;
  apiKey?: string;
  images: string[];
  out?: string;
  asJson: boolean;
  sessionId?: string;
};

export function printGlobalHelp() {
  console.log("eikon CLI");
  console.log("");
  console.log("Usage:");
  console.log("  eikon                           Start interactive shell");
  console.log("  eikon run <prompt> [flags]      Generate image from text");
  console.log("  eikon edit <prompt> [flags]     Image editing mode");
  console.log("  eikon config <subcommand>       Manage CLI config");
  console.log("  eikon session <subcommand>      Manage local sessions");
  console.log("");
  console.log("Run flags:");
  console.log("  --size <1K|2K|4K>");
  console.log("  --ratio <square|portrait|landscape|wide>");
  console.log("  --mode <text-to-image|image-editing>");
  console.log("  --image <path>                  Repeatable, for image-editing");
  console.log("  --out <path>                    Output file path");
  console.log("  --api-key <key>");
  console.log("  --base-url <url>");
  console.log("  --session <id>                  Append generation to session");
  console.log("  --json                          Print JSON result");
  console.log("");
  console.log("Examples:");
  console.log("  eikon run \"A cozy cabin in snow\" --size 2K --ratio landscape");
  console.log("  eikon edit \"Add neon lights\" --image ./input.png --out ./edited.png");
  console.log("  eikon config set baseUrl https://eikonstudio.xyz");
}

function getPromptFromParsed(parsed: ParsedArgs): string {
  const prompt = parsed.positional.join(" ").trim();
  if (!prompt) {
    throw new Error("Missing prompt. Example: eikon run \"A cinematic mountain landscape\"");
  }
  return prompt;
}

function resolveImagePaths(parsed: ParsedArgs): string[] {
  const values = getFlagList(parsed.flags, "image");
  const flattened = values.flatMap((value) => value.split(",").map((item) => item.trim()));
  return flattened.filter(Boolean);
}

function resolveGenerationOptions(
  parsed: ParsedArgs,
  config: CliConfig,
  forcedMode?: GenerationMode
): ResolvedGenerationOptions {
  const prompt = getPromptFromParsed(parsed);

  const sizeFlag = getFlagString(parsed.flags, "size");
  const ratioFlag = getFlagString(parsed.flags, "ratio");
  const modeFlag = getFlagString(parsed.flags, "mode");
  const baseUrlFlag = getFlagString(parsed.flags, "base-url") ?? getFlagString(parsed.flags, "baseUrl");
  const apiKeyFlag = getFlagString(parsed.flags, "api-key") ?? getFlagString(parsed.flags, "apiKey");
  const outFlag = getFlagString(parsed.flags, "out");
  const sessionFlag = getFlagString(parsed.flags, "session");

  const imageSize = sizeFlag ? parseImageSize(sizeFlag) : config.defaultImageSize;
  const aspectRatio = ratioFlag ? parseAspectRatio(ratioFlag) : config.defaultAspectRatio;
  const mode = forcedMode ?? (modeFlag ? parseMode(modeFlag) : config.defaultMode);
  const baseUrl = normalizeBaseUrl(baseUrlFlag || config.baseUrl);
  const apiKey = (apiKeyFlag || config.apiKey || "").trim() || undefined;
  const images = resolveImagePaths(parsed);

  if (mode === "image-editing" && images.length === 0) {
    throw new Error("Image editing mode requires at least one --image path");
  }

  return {
    prompt,
    baseUrl,
    imageSize,
    aspectRatio,
    mode,
    apiKey,
    images,
    out: outFlag,
    asJson: getFlagBoolean(parsed.flags, "json"),
    sessionId: sessionFlag,
  };
}

function parseImageSize(value: string): ImageSize {
  if (!isImageSize(value)) throw new Error(`Invalid --size: ${value}`);
  return value;
}

function parseAspectRatio(value: string): AspectRatio {
  if (!isAspectRatio(value)) throw new Error(`Invalid --ratio: ${value}`);
  return value;
}

function parseMode(value: string): GenerationMode {
  if (!isGenerationMode(value)) throw new Error(`Invalid --mode: ${value}`);
  return value;
}

type ExecuteGenerationInput = {
  config: CliConfig;
  options: ResolvedGenerationOptions;
  session?: SessionRecord;
};

export type ExecuteGenerationResult = {
  outputPath: string;
  prompt: string;
  metadata: {
    mode: GenerationMode;
    imageSize: ImageSize;
    aspectRatio: AspectRatio;
  };
};

export async function executeGeneration(input: ExecuteGenerationInput): Promise<ExecuteGenerationResult> {
  const { config, options, session } = input;
  const imageDataUrls = await Promise.all(options.images.map((filePath) => imageFileToDataUrl(filePath)));

  console.log("");
  console.log(`[eikon] generating image (${options.mode}, ${options.imageSize}, ${options.aspectRatio})...`);
  const response = await generateImage(options.baseUrl, {
    prompt: options.prompt,
    imageSize: options.imageSize,
    aspectRatio: options.aspectRatio,
    mode: options.mode,
    apiKey: options.apiKey,
    images: imageDataUrls,
  });

  const extension = mimeTypeToExtension(decodeDataUrl(response.url).mimeType);
  const outputPath = makeOutputPath(config.outputDirectory, options.prompt, options.out, extension);
  const savedPath = await saveDataUrlToFile(response.url, outputPath);

  if (session) {
    await appendGenerationToSession(session, {
      prompt: options.prompt,
      outputPath: savedPath,
      mode: options.mode,
      imageSize: options.imageSize,
      aspectRatio: options.aspectRatio,
    });
  }

  if (options.asJson) {
    console.log(
      JSON.stringify(
        {
          outputPath: savedPath,
          prompt: response.prompt,
          metadata: response.metadata,
        },
        null,
        2
      )
    );
  } else {
    console.log(`[eikon] done -> ${savedPath}`);
  }

  return {
    outputPath: savedPath,
    prompt: response.prompt,
    metadata: {
      mode: response.metadata.mode,
      imageSize: response.metadata.imageSize,
      aspectRatio: response.metadata.aspectRatio,
    },
  };
}

async function loadOptionalSession(sessionId: string | undefined): Promise<SessionRecord | undefined> {
  if (!sessionId) return undefined;
  return await loadSession(sessionId);
}

export async function runCommand(parsed: ParsedArgs): Promise<void> {
  const config = await loadConfig();
  const options = resolveGenerationOptions(parsed, config);
  const session = await loadOptionalSession(options.sessionId);
  await executeGeneration({ config, options, session });
}

export async function editCommand(parsed: ParsedArgs): Promise<void> {
  const config = await loadConfig();
  const options = resolveGenerationOptions(parsed, config, "image-editing");
  const session = await loadOptionalSession(options.sessionId);
  await executeGeneration({ config, options, session });
}

export async function configCommand(parsed: ParsedArgs): Promise<void> {
  const [subcommand, ...rest] = parsed.positional;

  if (!subcommand || subcommand === "list") {
    const config = await loadConfig();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (subcommand === "get") {
    const [key] = rest;
    if (!key) throw new Error("Usage: eikon config get <key>");
    const config = await loadConfig();
    const value = (config as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(`Unknown config key: ${key}`);
    }
    console.log(typeof value === "string" ? value : JSON.stringify(value));
    return;
  }

  if (subcommand === "set") {
    const [key, ...valueParts] = rest;
    if (!key || valueParts.length === 0) {
      throw new Error("Usage: eikon config set <key> <value>");
    }
    const value = valueParts.join(" ");
    const updated = await setConfigValue(key, value);
    console.log(`[eikon] updated ${key}`);
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  if (subcommand === "reset") {
    const updated = await patchConfig({
      baseUrl: "https://eikonstudio.xyz",
      apiKey: "",
      defaultImageSize: "2K",
      defaultAspectRatio: "square",
      defaultMode: "text-to-image",
    });
    console.log("[eikon] config reset");
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  throw new Error(`Unknown config subcommand: ${subcommand}`);
}

export async function sessionCommand(parsed: ParsedArgs): Promise<void> {
  const [subcommand, ...rest] = parsed.positional;

  if (!subcommand || subcommand === "list") {
    const sessions = await listSessions();
    if (sessions.length === 0) {
      console.log("No sessions yet.");
      return;
    }
    for (const session of sessions) {
      const updated = new Date(session.updatedAt).toISOString();
      console.log(`${session.id}  ${updated}  ${session.generations.length} generations  ${session.title}`);
    }
    return;
  }

  if (subcommand === "new") {
    const title = rest.join(" ").trim() || "Untitled Session";
    const config = await loadConfig();
    const session = createSession(title, createSessionSettingsFromConfig(config));
    await saveSession(session);
    console.log(`Created session ${session.id}`);
    return;
  }

  if (subcommand === "show") {
    const [sessionId] = rest;
    if (!sessionId) throw new Error("Usage: eikon session show <id>");
    const session = await loadSession(sessionId);
    console.log(JSON.stringify(session, null, 2));
    return;
  }

  if (subcommand === "delete") {
    const [sessionId] = rest;
    if (!sessionId) throw new Error("Usage: eikon session delete <id>");
    await deleteSession(sessionId);
    console.log(`Deleted session ${sessionId}`);
    return;
  }

  throw new Error(`Unknown session subcommand: ${subcommand}`);
}

export async function createDefaultSession(title: string): Promise<SessionRecord> {
  const config = await loadConfig();
  const session = createSession(title, createSessionSettingsFromConfig(config));
  await saveSession(session);
  return session;
}
