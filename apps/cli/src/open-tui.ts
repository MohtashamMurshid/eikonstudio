import { EikonApiError } from "@eikon/sdk";
import { loadConfig } from "./config";
import { executeGeneration } from "./commands";
import { createSession, createSessionSettingsFromConfig, saveSession } from "./session-store";
import type { SessionRecord } from "./types";
import { isAspectRatio, isGenerationMode, isImageSize } from "./validators";

type TuiState = {
  session: SessionRecord;
  prompt: string;
  logs: string[];
  busy: boolean;
};

type OpenTuiModule = {
  createCliRenderer: (config?: Record<string, unknown>) => Promise<any>;
  Text: (props?: Record<string, unknown>, ...children: unknown[]) => unknown;
};

function pushLog(state: TuiState, line: string) {
  state.logs.push(line);
  if (state.logs.length > 18) {
    state.logs.shift();
  }
}

function buildScreen(state: TuiState): string {
  const settings = state.session.settings;
  const help =
    "Enter: generate | Ctrl+C or /exit: quit | /help /size /ratio /mode /image /clear-images";
  const imagesLine =
    settings.referenceImages.length > 0
      ? `Images: ${settings.referenceImages.join(", ")}`
      : "Images: none";
  const logBody = state.logs.length > 0 ? state.logs.join("\n") : "(no activity yet)";
  const status = state.busy ? "busy" : "ready";

  return [
    "eikon OpenTUI",
    `session: ${state.session.id} (${state.session.title})`,
    `status: ${status} | mode: ${settings.mode} | size: ${settings.imageSize} | ratio: ${settings.aspectRatio}`,
    imagesLine,
    "",
    "Prompt:",
    `> ${state.prompt}`,
    "",
    "Activity:",
    logBody,
    "",
    help,
  ].join("\n");
}

function render(state: TuiState, renderer: any, opentui: OpenTuiModule) {
  renderer.root.clear();
  renderer.root.add(
    opentui.Text({
      content: buildScreen(state),
      width: "100%",
      height: "100%",
    })
  );
}

async function handleSlashCommand(state: TuiState, commandLine: string): Promise<boolean> {
  const [command, ...rest] = commandLine.slice(1).trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  if (command === "help") {
    pushLog(state, "Commands: /help /size /ratio /mode /image /clear-images /exit");
    return true;
  }

  if (command === "exit" || command === "quit") {
    return false;
  }

  if (command === "size") {
    if (!arg || !isImageSize(arg)) {
      pushLog(state, "Usage: /size <1K|2K|4K>");
      return true;
    }
    state.session.settings.imageSize = arg;
    await saveSession(state.session);
    pushLog(state, `Size set to ${arg}`);
    return true;
  }

  if (command === "ratio") {
    if (!arg || !isAspectRatio(arg)) {
      pushLog(state, "Usage: /ratio <square|portrait|landscape|wide>");
      return true;
    }
    state.session.settings.aspectRatio = arg;
    await saveSession(state.session);
    pushLog(state, `Ratio set to ${arg}`);
    return true;
  }

  if (command === "mode") {
    if (!arg || !isGenerationMode(arg)) {
      pushLog(state, "Usage: /mode <text-to-image|image-editing>");
      return true;
    }
    state.session.settings.mode = arg;
    await saveSession(state.session);
    pushLog(state, `Mode set to ${arg}`);
    return true;
  }

  if (command === "image") {
    if (!arg) {
      pushLog(state, "Usage: /image <path>");
      return true;
    }
    state.session.settings.referenceImages.push(arg);
    await saveSession(state.session);
    pushLog(state, `Added image: ${arg}`);
    return true;
  }

  if (command === "clear-images") {
    state.session.settings.referenceImages = [];
    await saveSession(state.session);
    pushLog(state, "Cleared reference images");
    return true;
  }

  pushLog(state, `Unknown slash command: /${command}`);
  return true;
}

function keyToText(key: any): string {
  if (typeof key?.sequence === "string" && /^[ -~]$/.test(key.sequence)) {
    return key.sequence;
  }
  if (typeof key?.name === "string" && key.name.length === 1 && /^[ -~]$/.test(key.name)) {
    return key.name;
  }
  return "";
}

async function submitPrompt(state: TuiState): Promise<boolean> {
  const prompt = state.prompt.trim();
  state.prompt = "";
  if (!prompt) return true;

  if (prompt.startsWith("/")) {
    return await handleSlashCommand(state, prompt);
  }

  const settings = state.session.settings;
  if (settings.mode === "image-editing" && settings.referenceImages.length === 0) {
    pushLog(state, "image-editing mode needs at least one /image <path>");
    return true;
  }

  state.busy = true;
  pushLog(state, `Generating: ${prompt}`);
  try {
    const config = await loadConfig();
    const result = await executeGeneration({
      config,
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
    pushLog(state, `Saved: ${result.outputPath}`);
  } catch (error) {
    if (error instanceof EikonApiError) {
      pushLog(state, `API error (${error.status}): ${error.message}`);
    } else {
      pushLog(state, `Error: ${(error as Error).message}`);
    }
  } finally {
    state.busy = false;
  }

  return true;
}

async function loadOpenTui(): Promise<OpenTuiModule> {
  const moduleValue = (await import("@opentui/core")) as unknown as OpenTuiModule;
  return moduleValue;
}

export async function startOpenTuiMode(): Promise<boolean> {
  let opentui: OpenTuiModule;
  try {
    opentui = await loadOpenTui();
  } catch (error) {
    console.error("[eikon] OpenTUI not available in this runtime.");
    console.error((error as Error).message);
    return false;
  }

  const config = await loadConfig();
  const session = createSession("OpenTUI Session", createSessionSettingsFromConfig(config));
  await saveSession(session);

  const state: TuiState = {
    session,
    prompt: "",
    logs: [`Session ${session.id} created`],
    busy: false,
  };

  let renderer: any;
  try {
    renderer = await opentui.createCliRenderer({
      exitOnCtrlC: true,
      targetFps: 30,
      useMouse: false,
    });
  } catch (error) {
    console.error("[eikon] Failed to initialize OpenTUI renderer.");
    console.error((error as Error).message);
    return false;
  }

  render(state, renderer, opentui);

  return await new Promise<boolean>((resolve) => {
    const refresh = () => render(state, renderer, opentui);

    const keypressHandler = async (key: any) => {
      if (state.busy) return;

      if (key?.ctrl && key?.name === "c") {
        renderer.destroy();
        resolve(true);
        return;
      }

      if (key?.name === "return" || key?.name === "enter") {
        const shouldContinue = await submitPrompt(state);
        refresh();
        if (!shouldContinue) {
          renderer.destroy();
          resolve(true);
        }
        return;
      }

      if (key?.name === "backspace") {
        state.prompt = state.prompt.slice(0, -1);
        refresh();
        return;
      }

      const text = keyToText(key);
      if (text) {
        state.prompt += text;
        refresh();
      }
    };

    renderer.keyInput.on("keypress", keypressHandler);
    renderer.on("destroy", () => {
      resolve(true);
    });
  });
}
