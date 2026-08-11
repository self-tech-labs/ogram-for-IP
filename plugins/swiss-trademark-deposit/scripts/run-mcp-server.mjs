#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const MINIMUM_NODE_MAJOR = 22;
const MAXIMUM_NODE_MAJOR_EXCLUSIVE = 26;
const LOCK_WAIT_MS = 250;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(pluginRoot, "servers/swiss-trademark-mcp");
const rootIdentity = createHash("sha256").update(pluginRoot).digest("hex").slice(0, 16);
const setupLock = resolve(tmpdir(), `swiss-trademark-deposit-${rootIdentity}.runtime-setup.lock`);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const entryPoints = new Map([
  ["nice-headings", "dist/nice-headings.js"],
  ["wdl", "dist/wdl.js"],
  ["swissreg-corpus", "dist/swissreg-corpus.js"],
  ["taf-decisions", "dist/taf-decisions.js"],
]);

function stderr(message) {
  process.stderr.write(`${message}\n`);
}

function assertSupportedNode() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (
    !Number.isInteger(major) ||
    major < MINIMUM_NODE_MAJOR ||
    major >= MAXIMUM_NODE_MAJOR_EXCLUSIVE
  ) {
    throw new Error(
      `Node.js ${MINIMUM_NODE_MAJOR} through ${MAXIMUM_NODE_MAJOR_EXCLUSIVE - 1} is required; found ${process.versions.node}.`,
    );
  }
}

function runSetup(command, args) {
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function runtimeReady() {
  try {
    const lock = JSON.parse(readFileSync(resolve(serverRoot, "package-lock.json"), "utf8"));
    for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
      if (!packagePath.startsWith("node_modules/") || metadata?.dev || !metadata?.version) continue;
      const installedManifestPath = resolve(serverRoot, packagePath, "package.json");
      if (!existsSync(installedManifestPath)) {
        if (metadata.optional) continue;
        return false;
      }
      const installed = JSON.parse(readFileSync(installedManifestPath, "utf8"));
      if (installed.version !== metadata.version) return false;
    }
    return [
      "node_modules/@modelcontextprotocol/sdk",
      "node_modules/better-sqlite3",
      "node_modules/zod",
    ].every((path) => existsSync(resolve(serverRoot, path)));
  } catch {
    return false;
  }
}

function entryPointReady(entryPoint) {
  return existsSync(resolve(serverRoot, entryPoint));
}

function sleep(milliseconds) {
  const state = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(state, 0, 0, milliseconds);
}

function removeStaleLock() {
  try {
    const age = Date.now() - statSync(setupLock).mtimeMs;
    let ownerIsAlive;
    try {
      const owner = JSON.parse(readFileSync(resolve(setupLock, "owner.json"), "utf8"));
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try {
          process.kill(owner.pid, 0);
          ownerIsAlive = true;
        } catch (error) {
          ownerIsAlive = error?.code === "EPERM";
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    // Never evict a lock whose owner is still alive, even if an unusually slow
    // install exceeds the age threshold. Use age only when owner state cannot be
    // established (for example after a crash before owner.json was completed).
    if (ownerIsAlive === true) return false;
    if (ownerIsAlive === undefined && age <= STALE_LOCK_MS) return false;
    stderr("[swiss-trademark-deposit] Removing an abandoned runtime setup lock.");
    rmSync(setupLock, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

function acquireSetupLock() {
  const startedAt = Date.now();
  while (true) {
    try {
      mkdirSync(setupLock);
      try {
        writeFileSync(
          resolve(setupLock, "owner.json"),
          `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
          { flag: "wx" },
        );
      } catch (error) {
        rmSync(setupLock, { recursive: true, force: true });
        throw error;
      }
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (removeStaleLock()) continue;
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(
          `Timed out waiting for runtime setup lock ${setupLock}. Remove it only if no plugin setup is running.`,
        );
      }
      sleep(LOCK_WAIT_MS);
    }
  }
}

function ensurePrepared(entryPoint) {
  if (!entryPointReady(entryPoint)) {
    throw new Error(
      `Missing compiled MCP entry point ${entryPoint}. The plugin package is incomplete or corrupt; reinstall a verified release.`,
    );
  }
  if (runtimeReady()) return;
  if (process.env.SWISS_TRADEMARK_NO_INSTALL === "1") {
    throw new Error("Runtime dependencies are not prepared. Run npm ci --omit=dev in the MCP server directory.");
  }

  acquireSetupLock();
  try {
    // Another MCP process may have completed setup while this process waited.
    if (runtimeReady()) return;

    if (!runtimeReady()) {
      stderr("[swiss-trademark-deposit] Installing locked MCP runtime dependencies (first run).");
      runSetup(npmCommand, ["ci", "--omit=dev", "--no-audit", "--no-fund"]);
    }

    if (!runtimeReady()) {
      throw new Error("Runtime dependency installation completed without all required packages.");
    }
  } finally {
    rmSync(setupLock, { recursive: true, force: true });
  }
}

function validateRuntimeLoad() {
  const probe = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        "import { createRequire } from 'node:module';",
        "const require = createRequire(import.meta.url);",
        "const Database = require('better-sqlite3');",
        "await import('@modelcontextprotocol/sdk/server/index.js');",
        "await import('zod');",
        "const database = new Database('./data/trademark.sqlite', { readonly: true, fileMustExist: true });",
        "database.prepare('SELECT 1').get();",
        "database.close();",
      ].join(""),
    ],
    {
      cwd: serverRoot,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    },
  );
  if (probe.error || probe.status !== 0) {
    const detail = probe.error?.message ?? probe.stderr.trim() ?? probe.stdout.trim() ?? `exit ${probe.status}`;
    throw new Error(`Runtime/native dependency probe failed: ${detail}`);
  }
}

function usage() {
  return `Usage: run-mcp-server.mjs <${[...entryPoints.keys()].join("|")}> [--check]`;
}

function main() {
  assertSupportedNode();

  const serverName = process.argv[2];
  const entryPoint = entryPoints.get(serverName);
  const options = process.argv.slice(3);
  if (!entryPoint || options.some((option) => option !== "--check") || options.length > 1) {
    stderr(usage());
    process.exitCode = 2;
    return;
  }

  ensurePrepared(entryPoint);
  if (options[0] === "--check") {
    validateRuntimeLoad();
    process.stdout.write(`${serverName}: ready\n`);
    return;
  }

  const child = spawn(process.execPath, [resolve(serverRoot, entryPoint)], {
    cwd: serverRoot,
    env: process.env,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }

  child.once("exit", (code, signal) => {
    if (signal) {
      const signalNumber = signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1;
      process.exit(128 + (signalNumber ?? 1));
    }
    process.exit(code ?? 0);
  });
  child.once("error", (error) => {
    stderr(`[swiss-trademark-deposit] Failed to start ${serverName}: ${error.message}`);
    process.exit(1);
  });
}

try {
  main();
} catch (error) {
  stderr(`[swiss-trademark-deposit] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
