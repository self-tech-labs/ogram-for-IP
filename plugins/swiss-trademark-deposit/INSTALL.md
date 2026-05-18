# Swiss Trademark Deposit Installation

This plugin is packaged for Codex first, with Claude-compatible local MCP metadata included.

## What The Package Contains

- Codex manifest: `.codex-plugin/plugin.json`
- Claude compatibility manifest: `.claude-plugin/plugin.json`
- Shared MCP config: `.mcp.json`
- Runtime wrapper: `scripts/run-mcp-server.mjs`
- Skill and references: `skills/swiss-trademark-deposit/`
- Commands: `commands/`
- Built MCP JavaScript: `servers/swiss-trademark-mcp/dist/`
- Local corpus database: `servers/swiss-trademark-mcp/data/trademark.sqlite`
- Source manifest: `servers/swiss-trademark-mcp/data/source-manifest.json`

The normal package excludes `node_modules`. On first MCP startup, the wrapper installs production runtime dependencies with `npm ci --omit=dev` if they are missing. This keeps the package portable across operating systems, including the native SQLite dependency.

## Requirements

- Node.js 22 or newer.
- npm available on the machine.
- Network access on first run unless the package was built with `--with-node-modules`.

## Install In Codex From GitHub

Use the Codex **Add marketplace** dialog with:

```text
Source: https://github.com/self-tech-labs/ogram-for-IP.git
Git ref: main
Sparse paths:
.agents/plugins
plugins/swiss-trademark-deposit
```

Then install **Swiss Trademark Deposit** from the **ogram for IP** marketplace.

## Install In Codex From This Repository

1. Keep the plugin at `plugins/swiss-trademark-deposit`.
2. Make sure `.agents/plugins/marketplace.json` contains the local entry:

```json
{
  "name": "swiss-trademark-deposit",
  "source": {
    "source": "local",
    "path": "./plugins/swiss-trademark-deposit"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Legal"
}
```

3. In Codex, install or enable **Swiss Trademark Deposit** from the local marketplace.

## Install As A Home-Local Codex Plugin

1. Unpack `swiss-trademark-deposit-0.1.0.plugin` into `~/plugins`. The archive contains a top-level `swiss-trademark-deposit` folder.
2. Add this entry to `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "swiss-trademark-deposit",
  "source": {
    "source": "local",
    "path": "./plugins/swiss-trademark-deposit"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Legal"
}
```

3. Restart Codex if the marketplace was already open.

## Claude Cowork And Claude Code

The package includes `.claude-plugin/plugin.json` and `.mcp.json`. The MCP config uses `${CLAUDE_PLUGIN_ROOT}` so it can be relocated as a plugin folder. In Claude environments that support local plugin roots and MCP server declarations, point the plugin root at the unpacked `swiss-trademark-deposit` folder.

If the host does not expand `${CLAUDE_PLUGIN_ROOT}`, replace it with the absolute plugin path in `.mcp.json`.

For Claude Cowork, create the `.plugin` archive and upload it as a custom plugin file from the Cowork plugin browser.

For Claude Code marketplace-style installation, this repository also includes a root marketplace catalog at `.claude-plugin/marketplace.json`:

```bash
claude plugin marketplace add self-tech-labs/ogram-for-IP --sparse .claude-plugin plugins/swiss-trademark-deposit
claude plugin install swiss-trademark-deposit@ogram-for-ip
```

## Build And Package

From the repository root:

```bash
cd plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp
npm ci
npm run build
npm test
cd -
node plugins/swiss-trademark-deposit/scripts/check-plugin.mjs
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs
```

The package script creates:

- `releases/swiss-trademark-deposit/`
- `releases/swiss-trademark-deposit-0.1.0.plugin`

For an offline, platform-specific package that includes production `node_modules`, run:

```bash
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs --with-node-modules
```

## Verify A Fresh Package

After unpacking, run:

```bash
node scripts/check-plugin.mjs
node scripts/run-mcp-server.mjs nice-headings
```

The second command starts an MCP server and waits for MCP messages; stop it once startup succeeds.

## Current Limits

- The local Swissreg corpus is for professional examples and class calibration, not a complete clearance search.
- Mandataire filters are metadata only in v0.1.0 because the delivered workbook does not map rows to mandataires.
- TAF similar-sign search uses local lexical and structural scoring, not embeddings.
- EUIPO TMclass and TMview APIs are not integrated yet.
- Fees, filing requirements, and official source behavior must be verified at the filing date.
