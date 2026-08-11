#!/usr/bin/env node
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const MINIMUM_NODE_MAJOR = 22;
const MAXIMUM_NODE_MAJOR_EXCLUSIVE = 26;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 5_000;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_DEFLATE_METHOD = 8;
const ZIP_DOS_TIME = 0;
const ZIP_DOS_DATE = 33; // 1980-01-01

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "../..");
const serverRoot = resolve(pluginRoot, "servers/swiss-trademark-mcp");
const releasesRoot = resolve(repoRoot, "releases");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const expectedArguments = new Set(["--skip-checks", "--with-node-modules"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const runtimeFiles = [
  [resolve(pluginRoot, ".codex-plugin/plugin.json"), ".codex-plugin/plugin.json"],
  [resolve(pluginRoot, ".claude-plugin/plugin.json"), ".claude-plugin/plugin.json"],
  [resolve(pluginRoot, "LICENSE"), "LICENSE"],
  [resolve(pluginRoot, "THIRD_PARTY_NOTICES.md"), "THIRD_PARTY_NOTICES.md"],
  [resolve(pluginRoot, "CHANGELOG.md"), "CHANGELOG.md"],
  [resolve(pluginRoot, "README.md"), "README.md"],
  [resolve(pluginRoot, "INSTALL.md"), "INSTALL.md"],
  [resolve(pluginRoot, "assets/ogram-logo.png"), "assets/ogram-logo.png"],
  [resolve(pluginRoot, "scripts/run-mcp-server.mjs"), "scripts/run-mcp-server.mjs"],
  [resolve(serverRoot, "package.json"), "servers/swiss-trademark-mcp/package.json"],
  [resolve(serverRoot, "package-lock.json"), "servers/swiss-trademark-mcp/package-lock.json"],
  [
    resolve(serverRoot, "data/trademark.sqlite"),
    "servers/swiss-trademark-mcp/data/trademark.sqlite",
  ],
  [
    resolve(serverRoot, "data/source-manifest.json"),
    "servers/swiss-trademark-mcp/data/source-manifest.json",
  ],
  ...[
    "db.js",
    "langextract.js",
    "mcp-schemas.js",
    "mcp-shared.js",
    "nice-headings.js",
    "normalize.js",
    "paths.js",
    "schema.js",
    "swissreg-corpus.js",
    "taf-decisions.js",
    "types.js",
    "wdl.js",
  ].map((file) => [
    resolve(serverRoot, "dist", file),
    `servers/swiss-trademark-mcp/dist/${file}`,
  ]),
];

const runtimeDirectories = [
  [resolve(pluginRoot, "skills"), "skills"],
  [resolve(pluginRoot, "commands"), "commands"],
];

const secretNamePatterns = [
  /^\.env(?:\..+)?$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^credentials(?:\..+)?$/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
  /^service[-_]?account(?:\..+)?$/i,
];

const secretContentPatterns = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[oprsu]_[A-Za-z0-9]{32,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
];
const secretScanExtensions = new Set(["json", "md", "mjs", "js", "txt", "yaml", "yml", "toml"]);

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function log(message) {
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

function parseArguments() {
  const values = process.argv.slice(2);
  const unknown = values.filter((value) => !expectedArguments.has(value));
  if (unknown.length > 0) throw new Error(`Unknown package argument(s): ${unknown.join(", ")}`);
  if (new Set(values).size !== values.length) throw new Error("Duplicate package arguments are not allowed.");
  return {
    skipChecks: values.includes("--skip-checks"),
    withNodeModules: values.includes("--with-node-modules"),
  };
}

function assertManifestIdentity(manifest) {
  if (typeof manifest?.name !== "string" || !slugPattern.test(manifest.name) || manifest.name.length > 64) {
    throw new Error("Plugin manifest name must be a lowercase kebab-case slug of at most 64 characters.");
  }
  if (typeof manifest?.version !== "string" || !semverPattern.test(manifest.version)) {
    throw new Error("Plugin manifest version must be strict semantic versioning.");
  }
}

function assertDescendant(base, target, label) {
  const rel = relative(resolve(base), resolve(target));
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    throw new Error(`${label} must remain inside ${base}: ${target}`);
  }
}

function removeContained(path, label) {
  assertDescendant(releasesRoot, path, label);
  rmSync(path, { recursive: true, force: true });
}

function run(command, commandArgs, options = {}) {
  log(`> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
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
  if (result.error) throw new Error(`Unable to run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function assertSafeRelativePath(path) {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe archive path: ${path}`);
  }
  for (const part of normalized.split("/")) {
    if (secretNamePatterns.some((pattern) => pattern.test(part))) {
      throw new Error(`Refusing to package secret-like path: ${path}`);
    }
  }
  return normalized;
}

function assertNoEmbeddedSecret(source, path, size) {
  if (size > 2 * 1024 * 1024) return;
  const extension = path.split(".").pop()?.toLowerCase();
  if (!secretScanExtensions.has(extension)) return;
  const text = readFileSync(source, "utf8");
  const matched = secretContentPatterns.find((pattern) => pattern.test(text));
  if (matched) throw new Error(`Refusing to package probable secret material from ${path}.`);
}

function copyRegularFile(source, destination, archivePath) {
  const sourceStats = lstatSync(source);
  if (sourceStats.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${source}`);
  if (!sourceStats.isFile()) throw new Error(`Runtime allowlist entry is not a regular file: ${source}`);
  const safePath = assertSafeRelativePath(archivePath);
  assertNoEmbeddedSecret(source, safePath, sourceStats.size);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  chmodSync(destination, safePath === "scripts/run-mcp-server.mjs" ? 0o755 : 0o644);
}

function copyDirectory(sourceRoot, destinationRoot, destinationPrefix) {
  const rootStats = lstatSync(sourceRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Runtime allowlist directory is not a real directory: ${sourceRoot}`);
  }
  mkdirSync(destinationRoot, { recursive: true });
  const visit = (sourceDirectory, destinationDirectory, relativeDirectory = "") => {
    const entries = readdirSync(sourceDirectory, { withFileTypes: true }).sort((a, b) =>
      compareNames(a.name, b.name),
    );
    for (const entry of entries) {
      const source = resolve(sourceDirectory, entry.name);
      const destination = resolve(destinationDirectory, entry.name);
      const nestedRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const archivePath = `${destinationPrefix}/${nestedRelative}`;
      assertSafeRelativePath(archivePath);
      const stats = lstatSync(source);
      if (stats.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${source}`);
      if (stats.isDirectory()) {
        mkdirSync(destination, { recursive: true });
        visit(source, destination, nestedRelative);
      } else if (stats.isFile()) {
        copyRegularFile(source, destination, archivePath);
      } else {
        throw new Error(`Refusing non-regular filesystem entry: ${source}`);
      }
    }
  };
  visit(sourceRoot, destinationRoot);
}

function stageRuntime(stagingRoot) {
  mkdirSync(stagingRoot, { recursive: true });
  for (const [source, archivePath] of runtimeFiles) {
    if (!existsSync(source)) throw new Error(`Missing required runtime file: ${source}`);
    const destination = resolve(stagingRoot, archivePath);
    assertDescendant(stagingRoot, destination, "Staged runtime file");
    copyRegularFile(source, destination, archivePath);
  }
  for (const [source, archivePath] of runtimeDirectories) {
    if (!existsSync(source)) throw new Error(`Missing required runtime directory: ${source}`);
    const destination = resolve(stagingRoot, archivePath);
    assertDescendant(stagingRoot, destination, "Staged runtime directory");
    copyDirectory(source, destination, archivePath);
  }
}

function prepareSource({ skipChecks }) {
  if (!skipChecks) {
    log("Installing the exact package-lock before the maintainer build and test sequence.");
    run(npmCommand, ["ci", "--no-audit", "--no-fund"], { cwd: serverRoot });
    run(npmCommand, ["run", "build"], { cwd: serverRoot });
    run(npmCommand, ["run", "typecheck:test"], { cwd: serverRoot });
    run(npmCommand, ["test"], { cwd: serverRoot });
    run(npmCommand, ["run", "smoke"], { cwd: serverRoot });
    run(npmCommand, ["run", "ingest:check"], { cwd: serverRoot });
  } else {
    log("Skipping the maintainer build/test/data gate because --skip-checks was explicitly supplied.");
  }
  run(process.execPath, [resolve(pluginRoot, "scripts/check-plugin.mjs")], { cwd: repoRoot });
}

function removeNodeBinSymlinks(stagingRoot) {
  const binPath = resolve(stagingRoot, "servers/swiss-trademark-mcp/node_modules/.bin");
  if (!existsSync(binPath)) return;
  assertDescendant(stagingRoot, binPath, "Generated node_modules binary directory");
  rmSync(binPath, { recursive: true, force: true });
}

function pruneStandaloneNativeArtifacts(stagingRoot) {
  const sqliteRoot = resolve(
    stagingRoot,
    "servers/swiss-trademark-mcp/node_modules/better-sqlite3",
  );
  const prebuildsRoot = resolve(sqliteRoot, "prebuilds");
  if (!existsSync(prebuildsRoot)) {
    throw new Error("Standalone staging is missing better-sqlite3 prebuilt binaries.");
  }

  const allowedPrebuilds = new Set(
    process.platform === "linux"
      ? [`linux-${process.arch}.node`, `linuxmusl-${process.arch}.node`]
      : [`${process.platform}-${process.arch}.node`],
  );
  let retainedPrebuilds = 0;
  for (const entry of readdirSync(prebuildsRoot, { withFileTypes: true })) {
    const path = resolve(prebuildsRoot, entry.name);
    if (!entry.isFile()) {
      throw new Error(`Unexpected better-sqlite3 prebuild entry: ${path}`);
    }
    if (allowedPrebuilds.has(entry.name)) {
      retainedPrebuilds += 1;
    } else {
      removeContained(path, "Unused native prebuild");
    }
  }
  if (retainedPrebuilds === 0) {
    throw new Error(
      `better-sqlite3 has no prebuilt binary for ${process.platform}/${process.arch}.`,
    );
  }

  for (const relativePath of ["binding.gyp", "build", "deps", "src"]) {
    const path = resolve(sqliteRoot, relativePath);
    if (existsSync(path)) removeContained(path, "Standalone-only native build source");
  }
}

function validateStandaloneRuntime(stagingRoot) {
  const stagedRunner = resolve(stagingRoot, "scripts/run-mcp-server.mjs");
  for (const serverName of ["nice-headings", "wdl", "swissreg-corpus", "taf-decisions"]) {
    const result = spawnSync(process.execPath, [stagedRunner, serverName, "--check"], {
      cwd: stagingRoot,
      env: { ...process.env, SWISS_TRADEMARK_NO_INSTALL: "1" },
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    if (result.error || result.status !== 0 || result.stdout.trim() !== `${serverName}: ready`) {
      const detail = result.error?.message ?? result.stderr.trim() ?? result.stdout.trim() ?? `exit ${result.status}`;
      throw new Error(`Staged standalone runtime check failed for ${serverName}: ${detail}`);
    }
  }
}

function writeThirdPartyInventory(stagingRoot) {
  const stagedServerRoot = resolve(stagingRoot, "servers/swiss-trademark-mcp");
  const lock = JSON.parse(readFileSync(resolve(stagedServerRoot, "package-lock.json"), "utf8"));
  const packages = [];
  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {}).sort(([a], [b]) =>
    compareNames(a, b),
  )) {
    if (!packagePath.startsWith("node_modules/") || metadata?.dev) continue;
    const installedManifestPath = resolve(stagedServerRoot, packagePath, "package.json");
    if (!existsSync(installedManifestPath)) {
      if (metadata.optional) continue;
      throw new Error(`Missing locked production package in standalone staging: ${packagePath}`);
    }
    const installed = JSON.parse(readFileSync(installedManifestPath, "utf8"));
    packages.push({
      name: installed.name,
      version: installed.version,
      license: typeof installed.license === "string" ? installed.license : "UNKNOWN",
      path: packagePath,
    });
  }
  const inventoryPath = resolve(stagingRoot, "THIRD_PARTY_PACKAGES.json");
  assertDescendant(stagingRoot, inventoryPath, "Third-party package inventory");
  writeFileSync(
    inventoryPath,
    `${JSON.stringify({ schemaVersion: 1, source: "package-lock.json", packages }, null, 2)}\n`,
    { mode: 0o644 },
  );
}

function collectRegularFiles(root) {
  const files = [];
  const visit = (directory, relativeDirectory = "") => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      compareNames(a.name, b.name),
    );
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const rel = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const safePath = assertSafeRelativePath(rel);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) throw new Error(`Refusing symbolic link in staged plugin: ${path}`);
      if (stats.isDirectory()) {
        visit(path, safePath);
      } else if (stats.isFile()) {
        if (stats.size > MAX_ENTRY_BYTES) {
          throw new Error(`Archive member exceeds ${MAX_ENTRY_BYTES} bytes: ${safePath}`);
        }
        if (!safePath.includes("/node_modules/")) {
          assertNoEmbeddedSecret(path, safePath, stats.size);
        }
        files.push({ absolutePath: path, relativePath: safePath, size: stats.size });
      } else {
        throw new Error(`Refusing non-regular filesystem entry in staged plugin: ${path}`);
      }
    }
  };
  visit(root);
  return files;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function writeAll(fileDescriptor, buffer) {
  let written = 0;
  while (written < buffer.length) written += writeSync(fileDescriptor, buffer, written);
}

function writeDeterministicZip(archivePath, rootFolder, files) {
  const expectedEntries = new Map();
  const centralRecords = [];
  let offset = 0;
  const fileDescriptor = openSync(archivePath, "wx", 0o644);
  try {
    for (const file of files) {
      const entryName = `${rootFolder}/${file.relativePath}`;
      const name = Buffer.from(entryName, "utf8");
      const data = readFileSync(file.absolutePath);
      const compressed = deflateRawSync(data, { level: 9 });
      const checksum = crc32(data);
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
      localHeader.writeUInt16LE(ZIP_DEFLATE_METHOD, 8);
      localHeader.writeUInt16LE(ZIP_DOS_TIME, 10);
      localHeader.writeUInt16LE(ZIP_DOS_DATE, 12);
      localHeader.writeUInt32LE(checksum, 14);
      localHeader.writeUInt32LE(compressed.length, 18);
      localHeader.writeUInt32LE(data.length, 22);
      localHeader.writeUInt16LE(name.length, 26);
      localHeader.writeUInt16LE(0, 28);
      writeAll(fileDescriptor, localHeader);
      writeAll(fileDescriptor, name);
      writeAll(fileDescriptor, compressed);

      centralRecords.push({
        checksum,
        compressedSize: compressed.length,
        entryName,
        localOffset: offset,
        name,
        size: data.length,
        mode: file.relativePath === "scripts/run-mcp-server.mjs" ? 0o100755 : 0o100644,
      });
      expectedEntries.set(entryName, { checksum, size: data.length });
      offset += localHeader.length + name.length + compressed.length;
    }

    const centralOffset = offset;
    for (const record of centralRecords) {
      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(0x0314, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
      centralHeader.writeUInt16LE(ZIP_DEFLATE_METHOD, 10);
      centralHeader.writeUInt16LE(ZIP_DOS_TIME, 12);
      centralHeader.writeUInt16LE(ZIP_DOS_DATE, 14);
      centralHeader.writeUInt32LE(record.checksum, 16);
      centralHeader.writeUInt32LE(record.compressedSize, 20);
      centralHeader.writeUInt32LE(record.size, 24);
      centralHeader.writeUInt16LE(record.name.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE((record.mode << 16) >>> 0, 38);
      centralHeader.writeUInt32LE(record.localOffset, 42);
      writeAll(fileDescriptor, centralHeader);
      writeAll(fileDescriptor, record.name);
      offset += centralHeader.length + record.name.length;
    }

    const centralSize = offset - centralOffset;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(centralRecords.length, 8);
    end.writeUInt16LE(centralRecords.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    end.writeUInt16LE(0, 20);
    writeAll(fileDescriptor, end);
    fsyncSync(fileDescriptor);
  } finally {
    closeSync(fileDescriptor);
  }
  return expectedEntries;
}

function verifyArchive(archivePath, rootFolder, expectedEntries) {
  const archive = readFileSync(archivePath);
  if (archive.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive is ${archive.length} bytes; cross-host limit is ${MAX_ARCHIVE_BYTES} bytes.`);
  }
  if (archive.length < 22 || archive.readUInt32LE(archive.length - 22) !== 0x06054b50) {
    throw new Error("Archive has no valid ZIP end-of-central-directory record.");
  }

  const endOffset = archive.length - 22;
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  if (entryCount > MAX_ENTRIES) throw new Error(`Archive contains ${entryCount} entries; limit is ${MAX_ENTRIES}.`);
  if (centralOffset + centralSize !== endOffset) throw new Error("ZIP central-directory bounds are invalid.");

  const actualNames = new Set();
  let totalExtracted = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset) throw new Error(`Truncated ZIP central record ${index}.`);
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Invalid ZIP central record ${index}.`);
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const entryName = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (method !== ZIP_DEFLATE_METHOD || flags !== ZIP_UTF8_FLAG) {
      throw new Error(`Unexpected ZIP encoding for ${entryName}.`);
    }
    assertSafeRelativePath(entryName);
    if (!entryName.startsWith(`${rootFolder}/`)) throw new Error(`Archive member escapes root folder: ${entryName}`);
    if (actualNames.has(entryName)) throw new Error(`Duplicate archive member: ${entryName}`);
    actualNames.add(entryName);
    totalExtracted += size;
    if (size > MAX_ENTRY_BYTES) throw new Error(`Archive member is too large: ${entryName}`);

    const expected = expectedEntries.get(entryName);
    if (!expected || expected.size !== size || expected.checksum !== checksum) {
      throw new Error(`Archive member does not match staged content: ${entryName}`);
    }
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local header: ${entryName}`);
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localChecksum = archive.readUInt32LE(localOffset + 14);
    const localCompressedSize = archive.readUInt32LE(localOffset + 18);
    const localSize = archive.readUInt32LE(localOffset + 22);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localName = archive.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8");
    if (
      localFlags !== flags ||
      localMethod !== method ||
      localChecksum !== checksum ||
      localCompressedSize !== compressedSize ||
      localSize !== size ||
      localName !== entryName
    ) {
      throw new Error(`Local and central ZIP headers disagree: ${entryName}`);
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    if (compressed.length !== compressedSize) throw new Error(`Truncated archive member: ${entryName}`);
    const data = method === ZIP_DEFLATE_METHOD ? inflateRawSync(compressed) : compressed;
    if (data.length !== size || crc32(data) !== checksum) throw new Error(`CRC verification failed: ${entryName}`);

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== endOffset || actualNames.size !== expectedEntries.size) {
    throw new Error("Archive entry set does not match the staged runtime allowlist.");
  }
  if (totalExtracted > MAX_EXTRACTED_BYTES) {
    throw new Error(`Archive extracts to ${totalExtracted} bytes; limit is ${MAX_EXTRACTED_BYTES}.`);
  }
  return { archiveBytes: archive.length, entryCount, extractedBytes: totalExtracted };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main() {
  assertSupportedNode();
  const options = parseArguments();
  const manifest = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  assertManifestIdentity(manifest);

  const platformSuffix = options.withNodeModules
    ? `-standalone-${process.platform}-${process.arch}-napi`
    : "";
  const archiveBase = `${manifest.name}-${manifest.version}${platformSuffix}`;
  const stagingRoot = resolve(releasesRoot, `.staging-${manifest.name}-${process.pid}`);
  const archivePath = resolve(releasesRoot, `${archiveBase}.plugin`);
  const temporaryArchivePath = resolve(releasesRoot, `.${archiveBase}.${process.pid}.tmp`);
  const checksumPath = resolve(releasesRoot, `${archiveBase}.plugin.sha256`);
  for (const [path, label] of [
    [stagingRoot, "Staging directory"],
    [archivePath, "Archive path"],
    [temporaryArchivePath, "Temporary archive path"],
    [checksumPath, "Checksum path"],
  ]) {
    assertDescendant(releasesRoot, path, label);
  }

  mkdirSync(releasesRoot, { recursive: true });
  removeContained(stagingRoot, "Staging directory");
  removeContained(temporaryArchivePath, "Temporary archive path");

  try {
    log(
      "Release gate: the publisher must confirm redistribution rights for the bundled trademark.sqlite corpus before distribution.",
    );
    prepareSource(options);
    stageRuntime(stagingRoot);

    if (options.withNodeModules) {
      log(`Creating a platform-specific standalone runtime for ${process.platform}/${process.arch}.`);
      run(npmCommand, ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
        cwd: resolve(stagingRoot, "servers/swiss-trademark-mcp"),
      });
      removeNodeBinSymlinks(stagingRoot);
      pruneStandaloneNativeArtifacts(stagingRoot);
      validateStandaloneRuntime(stagingRoot);
      writeThirdPartyInventory(stagingRoot);
    }

    const files = collectRegularFiles(stagingRoot);
    if (files.length === 0 || files.length > MAX_ENTRIES) {
      throw new Error(`Staged runtime contains ${files.length} files; allowed range is 1-${MAX_ENTRIES}.`);
    }
    const expectedEntries = writeDeterministicZip(temporaryArchivePath, manifest.name, files);
    const verification = verifyArchive(temporaryArchivePath, manifest.name, expectedEntries);

    removeContained(archivePath, "Archive path");
    renameSync(temporaryArchivePath, archivePath);
    const digest = sha256(archivePath);
    removeContained(checksumPath, "Checksum path");
    writeFileSync(checksumPath, `${digest}  ${archiveBase}.plugin\n`, { mode: 0o644 });

    log(
      `Packaged ${archivePath} (${verification.archiveBytes} bytes, ${verification.entryCount} files, ${verification.extractedBytes} bytes extracted).`,
    );
    log(`SHA-256 ${digest}`);
    process.stdout.write(`${archivePath}\n${checksumPath}\n`);
  } finally {
    removeContained(stagingRoot, "Staging directory");
    removeContained(temporaryArchivePath, "Temporary archive path");
  }
}

try {
  main();
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
