#!/usr/bin/env bun
import { parseArgv } from "./arg-parser";
import {
  configCommand,
  editCommand,
  printGlobalHelp,
  runCommand,
  sessionCommand,
} from "./commands";
import { startInteractiveShell } from "./interactive-shell";

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const command = parsed.command;

  if (!command || command === "interactive") {
    await startInteractiveShell();
    return;
  }

  if (command === "help" || parsed.flags.help || parsed.flags["help"] === true) {
    printGlobalHelp();
    return;
  }

  switch (command) {
    case "run":
      await runCommand(parsed);
      break;
    case "edit":
      await editCommand(parsed);
      break;
    case "config":
      await configCommand(parsed);
      break;
    case "session":
      await sessionCommand(parsed);
      break;
    default:
      throw new Error(`Unknown command: ${command}. Run "eikon help".`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eikon] ${message}`);
  process.exitCode = 1;
});
