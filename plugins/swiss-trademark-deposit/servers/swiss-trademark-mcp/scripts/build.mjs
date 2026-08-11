#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compiler = resolve(packageRoot, "node_modules/typescript/bin/tsc");

rmSync(resolve(packageRoot, "dist"), { recursive: true, force: true });

const result = spawnSync(process.execPath, [compiler, "-p", "tsconfig.json"], {
  cwd: packageRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
