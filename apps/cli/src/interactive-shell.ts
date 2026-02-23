import process from "node:process";
import { createInterface } from "node:readline/promises";
import { EikonApiError } from "@eikon/sdk";
import { loadConfig } from "./config";
import { executeGeneration } from "./commands";
import {
  createSession,
  createSessionSettingsFromConfig,
  listSessions,
  loadSession,
  saveSession,
} from "./session-store";
import type { CliConfig, SessionRecord } from "./types";
import { isAspectRatio, isGenerationMode, isImageSize } from "./validators";

type InteractiveState = {
  config: CliConfig;
  session: SessionRecord;
};

function printBanner(state: InteractiveState) {
  const { session } = state;
  console.log("eikon interactive");
  console.log(`session: ${session.id} (${session.title})`);
  console.log("Type a prompt and press Enter to generate.");
  console.log("Commands: /help, /size, /ratio, /mode, /base, /apikey, /image, /session, /exit");
}

function printSettings(state: InteractiveState) {
  const { settings } = state.session;
  console.log(
    `[settings] mode=${settings.mode} size=${settings.imageSize} ratio=${settings.aspectRatio} images=${settings.referenceImages.length}`
  );
}

function printHelp() {
  console.log("");
  console.log("Slash commands:");
  console.log("  /help                         Show this message");
  console.log("  /exit | /quit                 Exit shell");
  console.log("  /size <1K|2K|4K>              Set image size");
  console.log("  /ratio <square|portrait|landscape|wide>");
  console.log("  /mode <text-to-image|image-editing>");
  console.log("  /base <url>                   Set API base URL for this session");
  console.log("  /apikey <key>                 Set API key for this session");
  console.log("  /image add <path>             Add reference image path");
  console.log("  /image clear                  Clear reference images");
  console.log("  /image list                   Show reference images");
  console.log("  /session list                 List saved sessions");
  console.log("  /session new [title]          Create and switch to a new session");
  console.log("  /session open <id>            Open existing session");
  console.log("  /session save                 Persist current session");
  console.log("");
}

function buildPromptLabel(state: InteractiveState): string {
  const { settings } = state.session;
  return `${settings.mode} ${settings.imageSize}/${settings.aspectRatio}> `;
}

async function switchToNewSession(state: InteractiveState, title: string) {
  const session = createSession(title || "Interactive Session", createSessionSettingsFromConfig(state.config));
  await saveSession(session);
  state.session = session;
  console.log(`[session] new session ${session.id}`);
}

async function switchToExistingSession(state: InteractiveState, sessionId: string) {
  const session = await loadSession(sessionId);
  state.session = session;
  console.log(`[session] opened ${session.id}`);
}

async function handleSlashCommand(state: InteractiveState, raw: string): Promise<boolean> {
  const [command, ...rest] = raw.slice(1).trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (command) {
    case "help":
      printHelp();
      return true;
    case "exit":
    case "quit":
      return false;
    case "size":
      if (!arg || !isImageSize(arg)) {
        console.log("Usage: /size <1K|2K|4K>");
        return true;
      }
      state.session.settings.imageSize = arg;
      await saveSession(state.session);
      printSettings(state);
      return true;
    case "ratio":
      if (!arg || !isAspectRatio(arg)) {
        console.log("Usage: /ratio <square|portrait|landscape|wide>");
        return true;
      }
      state.session.settings.aspectRatio = arg;
      await saveSession(state.session);
      printSettings(state);
      return true;
    case "mode":
      if (!arg || !isGenerationMode(arg)) {
        console.log("Usage: /mode <text-to-image|image-editing>");
        return true;
      }
      state.session.settings.mode = arg;
      await saveSession(state.session);
      printSettings(state);
      return true;
    case "base":
      if (!arg) {
        console.log("Usage: /base <url>");
        return true;
      }
      state.session.settings.baseUrl = arg;
      await saveSession(state.session);
      printSettings(state);
      return true;
    case "apikey":
      if (!arg) {
        console.log("Usage: /apikey <key>");
        return true;
      }
      state.session.settings.apiKey = arg;
      await saveSession(state.session);
      console.log("[settings] api key updated");
      return true;
    case "image": {
      const [sub, ...parts] = rest;
      const imageArg = parts.join(" ").trim();
      if (sub === "add" && imageArg) {
        state.session.settings.referenceImages.push(imageArg);
        await saveSession(state.session);
        printSettings(state);
        return true;
      }
      if (sub === "clear") {
        state.session.settings.referenceImages = [];
        await saveSession(state.session);
        printSettings(state);
        return true;
      }
      if (sub === "list") {
        if (state.session.settings.referenceImages.length === 0) {
          console.log("No reference images set.");
          return true;
        }
        for (const img of state.session.settings.referenceImages) {
          console.log(`- ${img}`);
        }
        return true;
      }
      console.log("Usage: /image add <path> | /image clear | /image list");
      return true;
    }
    case "session": {
      const [sub, ...parts] = rest;
      if (sub === "list") {
        const sessions = await listSessions();
        if (sessions.length === 0) {
          console.log("No sessions.");
          return true;
        }
        for (const session of sessions) {
          console.log(
            `${session.id}  ${new Date(session.updatedAt).toISOString()}  ${session.generations.length} generations`
          );
        }
        return true;
      }

      if (sub === "new") {
        await switchToNewSession(state, parts.join(" ").trim() || "Interactive Session");
        return true;
      }

      if (sub === "open") {
        const id = parts.join(" ").trim();
        if (!id) {
          console.log("Usage: /session open <id>");
          return true;
        }
        await switchToExistingSession(state, id);
        printSettings(state);
        return true;
      }

      if (sub === "save") {
        await saveSession(state.session);
        console.log(`[session] saved ${state.session.id}`);
        return true;
      }

      console.log("Usage: /session list | /session new [title] | /session open <id> | /session save");
      return true;
    }
    default:
      console.log(`Unknown command: /${command}. Use /help.`);
      return true;
  }
}

async function generateFromInteractivePrompt(state: InteractiveState, prompt: string): Promise<void> {
  const { settings } = state.session;
  const result = await executeGeneration({
    config: {
      ...state.config,
      outputDirectory: state.config.outputDirectory,
    },
    options: {
      prompt,
      baseUrl: settings.baseUrl,
      imageSize: settings.imageSize,
      aspectRatio: settings.aspectRatio,
      mode: settings.mode,
      apiKey: settings.apiKey || undefined,
      images: settings.referenceImages,
      asJson: false,
    },
    session: state.session,
  });
  console.log(`[interactive] saved ${result.outputPath}`);
}

export async function startInteractiveShell(): Promise<void> {
  const config = await loadConfig();
  const session = createSession("Interactive Session", createSessionSettingsFromConfig(config));
  await saveSession(session);

  const state: InteractiveState = {
    config,
    session,
  };

  printBanner(state);
  printSettings(state);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const line = (await rl.question(buildPromptLabel(state))).trim();
      if (!line) continue;

      if (line.startsWith("/")) {
        const shouldContinue = await handleSlashCommand(state, line);
        if (!shouldContinue) break;
        continue;
      }

      try {
        await generateFromInteractivePrompt(state, line);
      } catch (error) {
        if (error instanceof EikonApiError) {
          console.error(`[api:${error.status}] ${error.message}`);
          if (error.details) {
            console.error(error.details);
          }
        } else {
          console.error((error as Error).message);
        }
      }
    }
  } finally {
    rl.close();
  }
}
