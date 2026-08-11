# Swiss Trademark Deposit installation

Version 0.2.0 targets Codex plugins, Claude Code plugins, and Claude Cowork plugin archives. These are configured delivery paths, not a claim that every current host version has passed release installation testing. Check the maintained [host-support matrix](../../docs/host-support.md) before distribution.

Ordinary Claude Desktop Chat uses an MCPB local extension. This repository does **not** ship an MCPB, and its `.plugin` archive must not be presented as one.

## Requirements

- Node.js 22–25
- npm 10 or newer
- network access to the configured npm registry on the first start of a normal package

The runtime uses `better-sqlite3`, a native dependency. Standalone archives must be built and tested on the operating system and CPU architecture where they will run.

## Package contents

The plugin payload contains:

- `.codex-plugin/plugin.json`, including Codex's four inline MCP declarations;
- `.claude-plugin/plugin.json`, including Claude's four inline MCP declarations;
- the shared workflow under `skills/swiss-trademark-deposit/`;
- Claude-only wrappers under `commands/`;
- `scripts/run-mcp-server.mjs`;
- four built MCP entry points under `servers/swiss-trademark-mcp/dist/`;
- `trademark.sqlite` and `source-manifest.json`; and
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `CHANGELOG.md`.

There is no `.mcp.json` and no combined MCP entry point. The raw five-file source snapshot is a maintainer input under the repository's `data-sources/2026-05-05/`; it is not needed to query the included database.

## Codex repository marketplace

For the Codex repository-marketplace UI, the configured source is:

```text
Source: https://github.com/self-tech-labs/ogram-for-IP.git
Git ref: main
Sparse paths:
.agents/plugins
plugins/swiss-trademark-deposit
```

Select **Swiss Trademark Deposit** from **ogram for IP** under **Business & Operations**. Start a new task after installation so the host loads the skill and MCP servers.

For development from a local clone, the expected non-default marketplace CLI flow is:

```sh
codex plugin marketplace add /absolute/path/to/ogram-for-IP
codex plugin add swiss-trademark-deposit@ogram-for-ip
```

Confirm these commands against the installed Codex build and run an end-to-end install test before claiming release support.

## Claude Code

The repository contains a Claude marketplace catalog and plugin manifest. The configured remote flow is:

```sh
claude plugin marketplace add self-tech-labs/ogram-for-IP
claude plugin install swiss-trademark-deposit@ogram-for-ip
```

Start a new Claude Code session after installation. The four named commands are Claude-only. Validate this exact route with the target Claude Code version before publishing it as supported.

For a local clone, Claude Code installations that accept a local marketplace path can point at the repository root, then install `swiss-trademark-deposit@ogram-for-ip`.

## Claude Cowork

Build the normal or standalone `.plugin` archive, then use Cowork's custom-plugin upload flow if it is available in the installed version. Upload-test the exact release archive; successful Claude Code validation does not prove Cowork compatibility.

This route does not add support for ordinary Claude Desktop Chat.

## Normal package

From the repository root:

```sh
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs
```

Outputs:

```text
releases/swiss-trademark-deposit-0.2.0.plugin
releases/swiss-trademark-deposit-0.2.0.plugin.sha256
```

The archive excludes `node_modules`. Because built entry points are included, first startup normally runs:

```text
npm ci --omit=dev --no-audit --no-fund
```

The wrapper serializes concurrent first-run setup, then starts the selected server. After dependencies are installed, corpus queries are local.

## Standalone package

From the repository root:

```sh
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs --with-node-modules
```

Outputs:

```text
releases/swiss-trademark-deposit-0.2.0-standalone-<platform>-<arch>-napi.plugin
releases/swiss-trademark-deposit-0.2.0-standalone-<platform>-<arch>-napi.plugin.sha256
```

The standalone archive includes production `node_modules`, avoiding the dependency download on first start. It is larger and not safely portable across operating systems or CPU architectures. Its N-API SQLite binary supports the declared Node.js 22–25 range on the named platform. Build, scan, and test it on every distributed target.
It also includes `THIRD_PARTY_PACKAGES.json`, a deterministic inventory of the
bundled production packages and their declared license identifiers.

Both package profiles include the generated database and are subject to the dataset redistribution gate below.

## Developer setup and test gate

From the repository root:

```sh
cd plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp
npm ci
npm run build
npm run typecheck:test
npm test
npm run smoke
npm run plugin:smoke
npm run ingest:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

Run `npm run ingest` only when intentionally regenerating the database from `data-sources/2026-05-05` or another complete source root. Review the resulting database and manifest differences; do not treat successful ingestion alone as approval to publish data.

The package script runs its own clean install, build, test typecheck, tests, smoke
suite, reproducible-ingestion check, and plugin checks unless `--skip-checks` is
explicitly supplied. Maintainers should still run the full gate above, including
dependency audits and host validators, before publishing.

## Verify an unpacked archive

Use a clean temporary directory so repository `node_modules` cannot hide missing package content:

```sh
cd releases
shasum -a 256 -c swiss-trademark-deposit-0.2.0.plugin.sha256
cd ..
verification_dir="$(mktemp -d)"
unzip releases/swiss-trademark-deposit-0.2.0.plugin -d "$verification_dir"
cd "$verification_dir/swiss-trademark-deposit"
node scripts/run-mcp-server.mjs nice-headings --check
node scripts/run-mcp-server.mjs wdl --check
node scripts/run-mcp-server.mjs swissreg-corpus --check
node scripts/run-mcp-server.mjs taf-decisions --check
```

The normal archive's first `--check` can install runtime dependencies. Repeat with `SWISS_TRADEMARK_NO_INSTALL=1` if you need to prove the prepared package starts without performing installation.

## Troubleshooting

### Unsupported runtime

Check `node --version` and `npm --version`. Use Node.js 22–25 and npm 10 or newer; Node.js 26 and later are outside the declared engine range.

### First-run dependency installation fails

Confirm registry access and install from the MCP package directory:

```sh
cd servers/swiss-trademark-mcp
npm ci --omit=dev --no-audit --no-fund
cd ../..
node scripts/run-mcp-server.mjs nice-headings --check
```

If `dist/` is missing from an installed archive, treat it as incomplete or corrupt
and reinstall a verified release. Maintainers can rebuild `dist/` from a complete
source checkout before repackaging.

### Installation is intentionally disabled

Setting `SWISS_TRADEMARK_NO_INSTALL=1` makes the wrapper fail rather than download or build missing runtime material. Prepare dependencies and built entry points first, or use a compatible standalone archive.

### Native SQLite module fails to load

Do not reuse a standalone archive from another operating system or CPU architecture. Rebuild it on the target, or use the normal package so npm installs the appropriate native module.

### Runtime setup lock times out

Wait for any other plugin startup to finish. The error reports the exact lock
directory under the operating system's temporary directory. Only after confirming
that no setup process is active, remove that exact directory and retry. Stale
locks older than 15 minutes are normally removed automatically.

### Plugin is visible but MCP tools are missing

Start a new host task/session, run the four `--check` commands above, and confirm the installed 0.2.0 manifests still contain exactly the four inline server declarations. Do not add a legacy `.mcp.json`.

### Claude Desktop Chat cannot install the archive

That is expected: `.plugin` is not MCPB. This repository currently has no supported one-click Claude Desktop Chat installation.

## Dataset redistribution gate

Redistribution rights for the five source inputs and the derived SQLite database have not been confirmed in this repository. Do not publish either `.plugin` archive, a public repository containing the data, or a database release until the applicable terms, permissions, and notices have been established.

See [Third-party data notices](THIRD_PARTY_NOTICES.md) and [Data provenance](../../docs/data-provenance.md). If redistribution cannot be confirmed, exclude restricted material and document a lawful local acquisition/build path.
