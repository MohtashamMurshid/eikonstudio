#!/usr/bin/env bun

type CliArgs = {
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  return {
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log("eikon CLI (scaffold)");
  console.log("");
  console.log("Usage:");
  console.log("  bun run src/index.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help   Show help");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  console.log("eikon CLI scaffold ready. OpenTUI implementation coming next.");
}

main();
