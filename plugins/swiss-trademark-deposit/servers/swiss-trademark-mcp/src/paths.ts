import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function packageRoot(): string {
  return resolve(here, "..");
}

export function defaultDbPath(): string {
  return resolve(packageRoot(), "data", "trademark.sqlite");
}

export function defaultManifestPath(): string {
  return resolve(packageRoot(), "data", "source-manifest.json");
}

export function defaultSourceRoot(): string {
  return resolve(packageRoot(), "../../../..", "data-sources", "2026-05-05");
}

export function configuredDbPath(): string {
  return process.env.SWISS_TRADEMARK_DB || defaultDbPath();
}

export function configuredManifestPath(): string {
  return process.env.SWISS_TRADEMARK_MANIFEST || defaultManifestPath();
}

export function configuredSourceRoot(): string {
  return process.env.SWISS_TRADEMARK_SOURCE_ROOT || defaultSourceRoot();
}
