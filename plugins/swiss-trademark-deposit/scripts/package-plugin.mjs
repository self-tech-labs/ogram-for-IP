#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "../..");
const serverRoot = resolve(pluginRoot, "servers/swiss-trademark-mcp");
const releasesRoot = resolve(repoRoot, "releases");
const args = new Set(process.argv.slice(2));
const withNodeModules = args.has("--with-node-modules");
const skipChecks = args.has("--skip-checks");

function log(message) {
  process.stderr.write(`${message}\n`);
}

function run(command, commandArgs, options = {}) {
  log(`> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function copyPlugin(stagingRoot) {
  const excluded = new Set([
    "node_modules",
    ".DS_Store",
    "coverage",
    ".cache",
    ".turbo",
  ]);
  cpSync(pluginRoot, stagingRoot, {
    recursive: true,
    filter: (source) => {
      const name = source.split(/[\\/]/).pop();
      if (excluded.has(name)) return false;
      const rel = relative(pluginRoot, source);
      if (!rel) return true;
      if (rel.startsWith("servers/swiss-trademark-mcp/node_modules")) return false;
      return true;
    },
  });
}

function folderSize(path) {
  if (!existsSync(path)) return 0;
  const stats = statSync(path);
  if (stats.isFile()) return stats.size;
  const result = spawnSync("du", ["-sk", path], { encoding: "utf8" });
  if (result.status !== 0) return 0;
  return Number(result.stdout.split(/\s+/)[0] ?? 0) * 1024;
}

function main() {
  const manifest = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  const archiveName = `${manifest.name}-${manifest.version}${withNodeModules ? "-standalone" : ""}`;
  const stagingFolderName = manifest.name;
  const stagingRoot = resolve(releasesRoot, stagingFolderName);
  const archivePath = resolve(releasesRoot, `${archiveName}.plugin`);

  if (!skipChecks) {
    run("npm", ["run", "build"], { cwd: serverRoot });
    run("npm", ["test"], { cwd: serverRoot });
    run("node", [resolve(pluginRoot, "scripts/check-plugin.mjs")], { cwd: repoRoot });
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  rmSync(archivePath, { force: true });
  mkdirSync(releasesRoot, { recursive: true });
  copyPlugin(stagingRoot);

  if (withNodeModules) {
    run("npm", ["ci", "--omit=dev"], { cwd: resolve(stagingRoot, "servers/swiss-trademark-mcp") });
  }

  run("zip", ["-qry", archivePath, stagingFolderName], { cwd: releasesRoot });
  const mb = Math.round((folderSize(archivePath) / 1024 / 1024) * 10) / 10;
  log(`Packaged ${archivePath} (${mb} MB)`);
  log(`Staged folder: ${stagingRoot}`);
}

try {
  main();
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
