import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
export function packageRoot() {
    return resolve(here, "..");
}
export function defaultDbPath() {
    return resolve(packageRoot(), "data", "trademark.sqlite");
}
export function defaultManifestPath() {
    return resolve(packageRoot(), "data", "source-manifest.json");
}
export function defaultSourceRoot() {
    return resolve(packageRoot(), "../../../..", "data-sources", "2026-05-05");
}
export function configuredDbPath() {
    return process.env.SWISS_TRADEMARK_DB || defaultDbPath();
}
export function configuredManifestPath() {
    return process.env.SWISS_TRADEMARK_MANIFEST || defaultManifestPath();
}
export function configuredSourceRoot() {
    return process.env.SWISS_TRADEMARK_SOURCE_ROOT || defaultSourceRoot();
}
