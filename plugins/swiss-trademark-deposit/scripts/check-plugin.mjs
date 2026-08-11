#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { sourceSetDigest } from "../servers/swiss-trademark-mcp/dist/types.js";

const PLUGIN_NAME = "swiss-trademark-deposit";
const PLUGIN_VERSION = "0.2.0";
const CATEGORY = "Business & Operations";
const MINIMUM_NODE_MAJOR = 22;
const MAXIMUM_NODE_MAJOR_EXCLUSIVE = 26;
const MAX_DATABASE_BYTES = 100_000_000;
const MAX_SOURCE_MANIFEST_BYTES = 1024 * 1024;
const expectedServers = ["nice-headings", "swissreg-corpus", "taf-decisions", "wdl"];
const expectedSourceNames = [
  "Class examples",
  "Nice headings",
  "Swissreg Produits-services",
  "TAF precedents",
  "WDL IPI",
];
const corpusSecretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[oprsu]_[A-Za-z0-9]{32,}\b/],
  ["API token", /\bsk-[A-Za-z0-9_-]{20,}\b/],
];
const corpusSecretFields = {
  nice_headings: ["heading"],
  wdl_terms: ["term", "comment"],
  swissreg_marks: ["title"],
  swissreg_goods_services: ["goods_services"],
  class_examples: ["example_text"],
  taf_entries: ["title", "text"],
};

const pluginRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(pluginRoot, "../..");
const serverRoot = resolve(pluginRoot, "servers/swiss-trademark-mcp");
const runnerPath = resolve(pluginRoot, "scripts/run-mcp-server.mjs");
const databasePath = resolve(serverRoot, "data/trademark.sqlite");
const sourceManifestPath = resolve(serverRoot, "data/source-manifest.json");

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "CHANGELOG.md",
  "README.md",
  "INSTALL.md",
  "assets/ogram-logo.png",
  "skills/swiss-trademark-deposit/SKILL.md",
  "commands/depot-marque.md",
  "commands/analyse-signe.md",
  "commands/rediger-libelles.md",
  "commands/recherche-anteriorite.md",
  "scripts/run-mcp-server.mjs",
  "scripts/package-plugin.mjs",
  "servers/swiss-trademark-mcp/package.json",
  "servers/swiss-trademark-mcp/package-lock.json",
  "servers/swiss-trademark-mcp/dist/db.js",
  "servers/swiss-trademark-mcp/dist/langextract.js",
  "servers/swiss-trademark-mcp/dist/mcp-schemas.js",
  "servers/swiss-trademark-mcp/dist/mcp-shared.js",
  "servers/swiss-trademark-mcp/dist/nice-headings.js",
  "servers/swiss-trademark-mcp/dist/normalize.js",
  "servers/swiss-trademark-mcp/dist/paths.js",
  "servers/swiss-trademark-mcp/dist/schema.js",
  "servers/swiss-trademark-mcp/dist/swissreg-corpus.js",
  "servers/swiss-trademark-mcp/dist/taf-decisions.js",
  "servers/swiss-trademark-mcp/dist/types.js",
  "servers/swiss-trademark-mcp/dist/wdl.js",
  "servers/swiss-trademark-mcp/data/trademark.sqlite",
  "servers/swiss-trademark-mcp/data/source-manifest.json",
];

function fail(message) {
  throw new Error(message);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
}

function assertOnlyKeys(value, allowed, label) {
  assertObject(value, label);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) fail(`${label} has unsupported key(s): ${unexpected.join(", ")}`);
}

function assertExactSet(actual, expected, label) {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (sortedActual.join("\0") !== sortedExpected.join("\0")) {
    fail(`${label} must contain exactly: ${sortedExpected.join(", ")}; found: ${sortedActual.join(", ")}`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be a non-empty string.`);
}

function assertPluginRelativePath(path, label) {
  assertString(path, label);
  if (!path.startsWith("./")) fail(`${label} must start with ./`);
  const target = resolve(pluginRoot, path);
  const rel = relative(pluginRoot, target);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    fail(`${label} escapes the plugin root.`);
  }
  if (!existsSync(target)) fail(`${label} points to a missing path: ${path}`);
}

function validateCommonManifest(manifest, label) {
  assertObject(manifest, label);
  if (manifest.name !== PLUGIN_NAME) fail(`${label}.name must be ${PLUGIN_NAME}.`);
  if (manifest.version !== PLUGIN_VERSION || !semverPattern.test(manifest.version)) {
    fail(`${label}.version must be strict semver ${PLUGIN_VERSION}.`);
  }
  assertString(manifest.description, `${label}.description`);
  assertObject(manifest.author, `${label}.author`);
  assertString(manifest.author.name, `${label}.author.name`);
  if (manifest.license !== "MIT") fail(`${label}.license must be MIT.`);
  if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
    fail(`${label}.keywords must be a non-empty array.`);
  }
  if (manifest.skills !== "./skills/") fail(`${label}.skills must be ./skills/.`);
}

function validateMcpServers(servers, host) {
  assertObject(servers, `${host}.mcpServers`);
  assertExactSet(Object.keys(servers), expectedServers, `${host}.mcpServers`);
  for (const serverName of expectedServers) {
    const server = servers[serverName];
    const label = `${host}.mcpServers.${serverName}`;
    if (host === "Codex") {
      assertOnlyKeys(server, new Set(["args", "command", "cwd"]), label);
      if (server.cwd !== ".") fail(`${label}.cwd must be '.'.`);
      if (server.command !== "node") fail(`${label}.command must be node.`);
      const expectedArgs = ["./scripts/run-mcp-server.mjs", serverName];
      if (JSON.stringify(server.args) !== JSON.stringify(expectedArgs)) {
        fail(`${label}.args must be ${JSON.stringify(expectedArgs)}.`);
      }
      assertPluginRelativePath(server.args[0], `${label}.args[0]`);
    } else {
      assertOnlyKeys(server, new Set(["args", "command"]), label);
      if (server.command !== "node") fail(`${label}.command must be node.`);
      const expectedArgs = ["${CLAUDE_PLUGIN_ROOT}/scripts/run-mcp-server.mjs", serverName];
      if (JSON.stringify(server.args) !== JSON.stringify(expectedArgs)) {
        fail(`${label}.args must use the Claude plugin-root variable.`);
      }
    }
  }
}

function validateManifests() {
  const codex = readJson(resolve(pluginRoot, ".codex-plugin/plugin.json"), "Codex manifest");
  assertOnlyKeys(
    codex,
    new Set([
      "author",
      "description",
      "homepage",
      "interface",
      "keywords",
      "license",
      "mcpServers",
      "name",
      "repository",
      "skills",
      "version",
    ]),
    "Codex manifest",
  );
  validateCommonManifest(codex, "Codex manifest");
  validateMcpServers(codex.mcpServers, "Codex");
  assertObject(codex.interface, "Codex manifest.interface");
  if (codex.interface.category !== CATEGORY) {
    fail(`Codex manifest.interface.category must be ${CATEGORY}.`);
  }
  for (const key of ["displayName", "shortDescription", "longDescription", "developerName"]) {
    assertString(codex.interface[key], `Codex manifest.interface.${key}`);
  }
  if (codex.interface.logo !== "./assets/ogram-logo.png") {
    fail("Codex manifest.interface.logo must point to ./assets/ogram-logo.png.");
  }
  assertPluginRelativePath(codex.interface.logo, "Codex manifest.interface.logo");

  const claude = readJson(resolve(pluginRoot, ".claude-plugin/plugin.json"), "Claude manifest");
  assertOnlyKeys(
    claude,
    new Set([
      "author",
      "commands",
      "description",
      "homepage",
      "keywords",
      "license",
      "mcpServers",
      "name",
      "repository",
      "skills",
      "version",
    ]),
    "Claude manifest",
  );
  validateCommonManifest(claude, "Claude manifest");
  if (claude.commands !== "./commands/") fail("Claude manifest.commands must be ./commands/.");
  validateMcpServers(claude.mcpServers, "Claude");
}

function validateMarketplaces() {
  const codexPath = resolve(repoRoot, ".agents/plugins/marketplace.json");
  const codex = readJson(codexPath, "Codex marketplace");
  assertOnlyKeys(codex, new Set(["interface", "name", "plugins"]), "Codex marketplace");
  if (codex.name !== "ogram-for-ip") fail("Codex marketplace.name must be ogram-for-ip.");
  assertOnlyKeys(codex.interface, new Set(["displayName"]), "Codex marketplace.interface");
  assertString(codex.interface.displayName, "Codex marketplace.interface.displayName");
  if (!Array.isArray(codex.plugins)) fail("Codex marketplace.plugins must be an array.");
  const codexEntry = codex.plugins.find((plugin) => plugin.name === PLUGIN_NAME);
  if (!codexEntry) fail("Codex marketplace plugin entry is missing.");
  assertOnlyKeys(codexEntry, new Set(["category", "name", "policy", "source"]), "Codex marketplace entry");
  if (codexEntry.category !== CATEGORY) fail(`Codex marketplace category must be ${CATEGORY}.`);
  if (codexEntry.source?.source !== "local" || codexEntry.source?.path !== `./plugins/${PLUGIN_NAME}`) {
    fail("Codex marketplace source must be the repository-local plugin path.");
  }
  if (
    codexEntry.policy?.installation !== "AVAILABLE" ||
    codexEntry.policy?.authentication !== "ON_INSTALL"
  ) {
    fail("Codex marketplace policy must be AVAILABLE/ON_INSTALL.");
  }

  const claudePath = resolve(repoRoot, ".claude-plugin/marketplace.json");
  const claude = readJson(claudePath, "Claude marketplace");
  assertOnlyKeys(
    claude,
    new Set(["$schema", "metadata", "name", "owner", "plugins"]),
    "Claude marketplace",
  );
  if (claude.name !== "ogram-for-ip") fail("Claude marketplace.name must be ogram-for-ip.");
  assertString(claude.owner?.name, "Claude marketplace.owner.name");
  assertString(claude.metadata?.description, "Claude marketplace.metadata.description");
  if (claude.metadata?.version !== PLUGIN_VERSION) fail("Claude marketplace metadata version is out of sync.");
  if (!Array.isArray(claude.plugins)) fail("Claude marketplace.plugins must be an array.");
  const claudeEntry = claude.plugins.find((plugin) => plugin.name === PLUGIN_NAME);
  if (!claudeEntry) fail("Claude marketplace plugin entry is missing.");
  assertOnlyKeys(
    claudeEntry,
    new Set(["author", "category", "description", "license", "name", "source", "tags", "version"]),
    "Claude marketplace entry",
  );
  if (claudeEntry.source !== `./plugins/${PLUGIN_NAME}`) fail("Claude marketplace source path is incorrect.");
  if (claudeEntry.version !== PLUGIN_VERSION) fail("Claude marketplace plugin version is out of sync.");
  if (claudeEntry.category !== CATEGORY) fail(`Claude marketplace category must be ${CATEGORY}.`);
}

function validatePackageLock() {
  const packageJson = readJson(resolve(serverRoot, "package.json"), "MCP package.json");
  const packageLock = readJson(resolve(serverRoot, "package-lock.json"), "MCP package-lock.json");
  if (packageLock.lockfileVersion !== 3) fail("MCP package-lock.json must use lockfileVersion 3.");
  if (packageLock.name !== packageJson.name || packageLock.version !== packageJson.version) {
    fail("MCP package.json and package-lock.json identities are out of sync.");
  }
  if (packageJson.version !== PLUGIN_VERSION) fail("MCP package version is out of sync with plugin manifests.");
  if (packageJson.engines?.node !== ">=22 <26" || packageJson.engines?.npm !== ">=10") {
    fail("MCP package engine declarations must match the supported Node.js 22-25 and npm 10+ runtime.");
  }
  const approvedScripts = packageJson.allowScripts ?? {};
  if (
    approvedScripts["better-sqlite3@13.0.2"] !== true ||
    approvedScripts["esbuild@0.28.1"] !== true ||
    approvedScripts["fsevents@2.3.3"] !== true ||
    Object.keys(approvedScripts).length !== 3
  ) {
    fail("Install-script approvals must remain pinned to the reviewed better-sqlite3, esbuild, and fsevents versions.");
  }
  const lockedRoot = packageLock.packages?.[""];
  if (!lockedRoot) fail("MCP package-lock.json has no root package record.");
  if (JSON.stringify(lockedRoot.dependencies) !== JSON.stringify(packageJson.dependencies)) {
    fail("MCP runtime dependencies are out of sync with the package lock.");
  }
}

function validateDatabase() {
  const databaseBytes = statSync(databasePath).size;
  if (databaseBytes < 1024 * 1024) fail("Trademark database is unexpectedly small.");
  if (databaseBytes >= MAX_DATABASE_BYTES) {
    fail(`Trademark database is ${databaseBytes} bytes; it must stay below ${MAX_DATABASE_BYTES} bytes.`);
  }
  const sourceManifestBytes = statSync(sourceManifestPath).size;
  if (sourceManifestBytes > MAX_SOURCE_MANIFEST_BYTES) {
    fail(`Data source manifest is ${sourceManifestBytes} bytes; maximum is ${MAX_SOURCE_MANIFEST_BYTES}.`);
  }
  const sourceManifest = readJson(sourceManifestPath, "Data source manifest");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(sourceManifest.generated_at ?? "")) {
    fail("Data source manifest generated_at must be a UTC ISO-8601 timestamp.");
  }
  if (!Array.isArray(sourceManifest.sources) || sourceManifest.sources.length !== expectedSourceNames.length) {
    fail(`Data source manifest must describe exactly ${expectedSourceNames.length} bundled corpora.`);
  }
  if (!Array.isArray(sourceManifest.warnings)) fail("Data source manifest warnings must be an array.");
  const actualSourceNames = sourceManifest.sources.map((source) => source.name).sort();
  if (JSON.stringify(actualSourceNames) !== JSON.stringify(expectedSourceNames)) {
    fail("Data source manifest corpus names do not match the expected source set.");
  }
  for (const source of sourceManifest.sources) {
    assertString(source.name, "Data source name");
    assertString(source.path, `Data source path for ${source.name}`);
    const normalizedPath = source.path.replaceAll("\\", "/");
    if (
      normalizedPath.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalizedPath) ||
      normalizedPath.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      fail(`Data source path for ${source.name} must be a safe relative path.`);
    }
    if (source.source_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(source.source_date ?? "")) {
      fail(`Invalid source date for ${source.name}.`);
    }
    if (source.ingested_at !== sourceManifest.generated_at) {
      fail(`Ingestion timestamp for ${source.name} is out of sync with the manifest.`);
    }
    if (!Number.isInteger(source.rows) || source.rows <= 0) fail(`Invalid source row count for ${source.name}.`);
    if (!/^[a-f0-9]{64}$/.test(source.sha256 ?? "")) fail(`Invalid source SHA-256 for ${source.name}.`);
    if (!Array.isArray(source.warnings)) fail(`Warnings for ${source.name} must be an array.`);
  }
  if (new Set(sourceManifest.sources.map((source) => source.path)).size !== sourceManifest.sources.length) {
    fail("Data source manifest paths must be unique.");
  }

  const requireFromServer = createRequire(resolve(serverRoot, "package.json"));
  let Database;
  try {
    Database = requireFromServer("better-sqlite3");
  } catch (error) {
    fail(`better-sqlite3 is unavailable; run npm ci before checking the plugin: ${error.message}`);
  }

  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") fail(`SQLite integrity_check failed: ${integrity}`);
    const applicationId = database.pragma("application_id", { simple: true });
    if (applicationId !== 1398033731) fail(`Unexpected SQLite application_id: ${applicationId}.`);
    const userVersion = database.pragma("user_version", { simple: true });
    if (userVersion !== 1) fail(`Unexpected SQLite user_version: ${userVersion}.`);
    const metadata = new Map(
      database.prepare("SELECT key, value FROM corpus_metadata").all().map((row) => [row.key, row.value]),
    );
    const schemaVersion = metadata.get("schema_version");
    if (schemaVersion !== "1") fail(`Unexpected corpus_metadata schema_version: ${schemaVersion}.`);
    if (metadata.get("manifest_generated_at") !== sourceManifest.generated_at) {
      fail("Database manifest timestamp does not match source-manifest.json.");
    }
    if (metadata.get("source_set_sha256") !== sourceSetDigest(sourceManifest.sources)) {
      fail("Database source-set digest does not match source-manifest.json.");
    }
    const foreignKeyErrors = database.pragma("foreign_key_check");
    if (foreignKeyErrors.length > 0) fail(`SQLite foreign_key_check returned ${foreignKeyErrors.length} error(s).`);

    const rowsBySource = new Map(sourceManifest.sources.map((source) => [source.name, source.rows]));
    const expectedCounts = new Map([
      ["nice_headings", rowsBySource.get("Nice headings")],
      ["wdl_terms", rowsBySource.get("WDL IPI")],
      ["swissreg_goods_services", rowsBySource.get("Swissreg Produits-services")],
      ["class_examples", rowsBySource.get("Class examples")],
      ["taf_entries", rowsBySource.get("TAF precedents")],
    ]);
    for (const [table, expectedCount] of expectedCounts) {
      if (!Number.isInteger(expectedCount)) fail(`Source manifest has no row count for ${table}.`);
      const actual = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
      if (actual !== expectedCount) fail(`${table} has ${actual} rows; source manifest declares ${expectedCount}.`);
    }
    const markCount = database.prepare("SELECT COUNT(*) AS count FROM swissreg_marks").get().count;
    if (markCount <= 0) fail("swissreg_marks must not be empty.");

    // Scan logical text fields rather than raw SQLite bytes: adjacent values on
    // a database page can otherwise concatenate into false token-shaped matches.
    for (const [table, fields] of Object.entries(corpusSecretFields)) {
      const columns = fields.map((field) => `"${field}"`).join(", ");
      for (const row of database.prepare(`SELECT rowid AS "_rowid", ${columns} FROM "${table}"`).iterate()) {
        for (const field of fields) {
          const value = String(row[field] ?? "");
          const match = corpusSecretPatterns.find(([, pattern]) => pattern.test(value));
          if (match) fail(`Potential ${match[0]} found in ${table}.${field} at rowid ${row._rowid}.`);
        }
      }
    }
  } finally {
    database.close();
  }
}

function validateRunnerInvocations() {
  for (const serverName of expectedServers) {
    const result = spawnSync(process.execPath, [runnerPath, serverName, "--check"], {
      cwd: pluginRoot,
      env: { ...process.env, SWISS_TRADEMARK_NO_INSTALL: "1" },
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0 || result.stdout.trim() !== `${serverName}: ready`) {
      const detail = result.error?.message ?? result.stderr.trim() ?? result.stdout.trim() ?? `exit ${result.status}`;
      fail(`MCP runner check failed for ${serverName}: ${detail}`);
    }
  }
  const invalid = spawnSync(process.execPath, [runnerPath, "not-a-server", "--check"], {
    cwd: pluginRoot,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (invalid.status !== 2) fail("MCP runner must reject unknown server names with exit code 2.");
}

function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (
    !Number.isInteger(nodeMajor) ||
    nodeMajor < MINIMUM_NODE_MAJOR ||
    nodeMajor >= MAXIMUM_NODE_MAJOR_EXCLUSIVE
  ) {
    fail(`Plugin checks require Node.js ${MINIMUM_NODE_MAJOR} through ${MAXIMUM_NODE_MAJOR_EXCLUSIVE - 1}.`);
  }

  for (const file of requiredFiles) {
    if (!existsSync(resolve(pluginRoot, file))) fail(`Missing required plugin file: ${file}`);
  }
  for (const removedFile of [".mcp.json", "manifest.json"]) {
    if (existsSync(resolve(pluginRoot, removedFile))) fail(`Obsolete shared manifest must be removed: ${removedFile}`);
  }
  if (existsSync(resolve(serverRoot, "dist/index.js"))) {
    fail("Obsolete combined MCP entry point dist/index.js must not be shipped.");
  }

  validateManifests();
  validateMarketplaces();
  validatePackageLock();
  validateDatabase();
  validateRunnerInvocations();
  process.stdout.write("Plugin validation passed: manifests, marketplaces, database, lockfile, and four MCP launchers.\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
