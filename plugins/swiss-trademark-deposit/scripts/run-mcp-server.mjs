#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(pluginRoot, "servers/swiss-trademark-mcp");

const entryPoints = new Map([
  ["nice-headings", "dist/nice-headings.js"],
  ["wdl", "dist/wdl.js"],
  ["swissreg-corpus", "dist/swissreg-corpus.js"],
  ["taf-decisions", "dist/taf-decisions.js"],
  ["swiss-trademark", "dist/index.js"],
]);

function stderr(message) {
  process.stderr.write(`${message}\n`);
}

function runSetup(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function ensureRuntime() {
  const nodeModulesReady =
    existsSync(resolve(serverRoot, "node_modules/@modelcontextprotocol/sdk")) &&
    existsSync(resolve(serverRoot, "node_modules/better-sqlite3")) &&
    existsSync(resolve(serverRoot, "node_modules/zod"));
  if (!nodeModulesReady) {
    stderr("[swiss-trademark-deposit] Installing MCP runtime dependencies. This is a first-run setup step.");
    runSetup("npm", ["ci", "--omit=dev"]);
  }
}

function ensureEntryPoint(entryPoint) {
  const entryPath = resolve(serverRoot, entryPoint);
  if (!existsSync(entryPath)) {
    stderr("[swiss-trademark-deposit] Built MCP files are missing; building from TypeScript sources.");
    runSetup("npm", ["ci"]);
    runSetup("npm", ["run", "build"]);
  }
  if (!existsSync(entryPath)) {
    throw new Error(`Missing MCP entry point after setup: ${entryPath}`);
  }
  return entryPath;
}

const serverName = process.argv[2];
const entryPoint = entryPoints.get(serverName);
if (!entryPoint) {
  stderr(`Usage: run-mcp-server.mjs <${[...entryPoints.keys()].join("|")}>`);
  process.exit(2);
}

try {
  ensureRuntime();
  const entryPath = ensureEntryPoint(entryPoint);
  const child = spawn(process.execPath, [entryPath], {
    cwd: serverRoot,
    env: process.env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
  child.on("error", (error) => {
    stderr(`[swiss-trademark-deposit] Failed to start ${serverName}: ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  stderr(`[swiss-trademark-deposit] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
