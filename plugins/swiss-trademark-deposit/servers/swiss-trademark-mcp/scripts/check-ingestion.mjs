#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const committedDb = resolve(packageRoot, "data/trademark.sqlite");
const committedManifest = resolve(packageRoot, "data/source-manifest.json");
const ingestionEntry = resolve(packageRoot, "dist/ingest.js");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const manifestText = readFileSync(committedManifest, "utf8");
const manifest = JSON.parse(manifestText);
const generatedAt = new Date(manifest.generated_at);
if (Number.isNaN(generatedAt.getTime())) throw new Error("Committed source manifest has an invalid generated_at timestamp.");
if (generatedAt.getUTCMilliseconds() !== 0) {
  throw new Error("Committed source manifest generated_at must use whole seconds for reproducible ingestion.");
}

const temporaryRoot = mkdtempSync(resolve(tmpdir(), "swiss-trademark-ingest-check-"));
const generatedDb = resolve(temporaryRoot, "trademark.sqlite");
const generatedManifest = resolve(temporaryRoot, "source-manifest.json");

try {
  const result = spawnSync(process.execPath, [ingestionEntry], {
    cwd: packageRoot,
    env: {
      ...process.env,
      SOURCE_DATE_EPOCH: String(Math.floor(generatedAt.getTime() / 1_000)),
      SWISS_TRADEMARK_DB: generatedDb,
      SWISS_TRADEMARK_MANIFEST: generatedManifest,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Reproducible ingestion failed with exit code ${result.status ?? "unknown"}.`);

  const committedDbHash = sha256(committedDb);
  const generatedDbHash = sha256(generatedDb);
  if (generatedDbHash !== committedDbHash) {
    throw new Error(`Generated database differs from the committed artifact: ${generatedDbHash} != ${committedDbHash}.`);
  }
  if (readFileSync(generatedManifest, "utf8") !== manifestText) {
    throw new Error("Generated source manifest differs from the committed artifact.");
  }

  process.stdout.write(`Reproducible ingestion passed: ${committedDbHash}\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
