# ogram for IP

Open-source AI workflows and local MCP retrieval for Swiss intellectual-property practitioners.

The repository currently contains **Swiss Trademark Deposit 0.2.0**, a plugin for preparing Swiss trademark work before the Federal Institute of Intellectual Property (IPI). It is co-authored by [ogram.ch](https://ogram.ch) and [enodo.ch](https://enodo.ch): ogram contributes the legaltech implementation and enodo the law-firm perspective.

## Swiss Trademark Deposit

The plugin helps a practitioner:

- structure filing intake and identify missing facts;
- assess potential absolute-ground issues;
- select Nice classes and draft source-backed goods/services wording;
- search local Swissreg examples and TAF extracts; and
- prepare a live anteriority-search plan and filing note.

It combines one shared workflow skill with four local, read-only MCP servers:

| Server | Purpose |
| --- | --- |
| `nice-headings` | Nice headings, filing intake, and stored filing facts |
| `wdl` | IPI/WDL term search and validation |
| `swissreg-corpus` | Professional examples, class combinations, and clearance planning |
| `taf-decisions` | Absolute-ground decisions, risk screening, and similar-sign retrieval |

The Codex and Claude manifests declare these four servers inline. There is no shared `.mcp.json` and no combined MCP entry point.

## Host support

| Host surface | Repository delivery | Components exposed | Current status |
| --- | --- | --- | --- |
| Codex desktop plugin | Repository marketplace plus `.codex-plugin/plugin.json` | Skill and four local MCP servers | Targeted; validate before release |
| Claude Code | Claude marketplace plus `.claude-plugin/plugin.json` | Skill, four Claude commands, and four local MCP servers | Targeted; validate before release |
| Claude Cowork | Packaged `.plugin` archive | Plugin components supported by the installed Cowork version | Targeted; upload-test the release archive |
| Claude Desktop Chat local extension | MCPB package | Not applicable | Not shipped |

The four command wrappers are Claude-only; Codex users invoke the same workflows with natural-language prompts. See the maintained [host-support matrix](docs/host-support.md) before making compatibility claims.

## Quick start in Codex

Requirements: Node.js 22–25 and npm 10 or newer. A normal package needs registry access on first MCP startup; see [Installation](plugins/swiss-trademark-deposit/INSTALL.md) for the standalone alternative and tested-status caveats.

In Codex's repository-marketplace flow, use:

```text
Source: https://github.com/self-tech-labs/ogram-for-IP.git
Git ref: main
Sparse paths:
.agents/plugins
plugins/swiss-trademark-deposit
```

Then select **Swiss Trademark Deposit** in the **ogram for IP** marketplace. Its Codex category is **Business & Operations**.

Example prompts:

- `Prepare a Swiss trademark deposit for this business: ...`
- `Analyze the absolute-ground risks for this sign in Switzerland: ...`
- `Draft Nice goods and services wording for these activities: ...`

For logos or combined signs, provide the image or describe the visual elements. Include current and planned activities, territory, priority claims, and risk posture when known.

## Package profiles

From the repository root, create the normal portable archive:

```sh
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs
```

It excludes `node_modules` and creates both
`releases/swiss-trademark-deposit-0.2.0.plugin` and its `.sha256` checksum.
Runtime dependencies are installed from the lockfile on first MCP startup.

For a larger build containing production dependencies:

```sh
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs --with-node-modules
```

This creates a platform-tagged archive such as
`releases/swiss-trademark-deposit-0.2.0-standalone-darwin-arm64-napi.plugin`
and its `.sha256` checksum. Because `better-sqlite3` contains native code, build
and test the standalone archive on the target operating system and CPU architecture.
Its N-API SQLite binary supports the declared Node.js 22–25 range.

## Data and limits

The bundled corpus snapshot is dated **2026-05-05**. Stored official filing links and facts were checked separately on **2026-08-04** and must still be verified at filing time.

The plugin does not perform live Swissreg, TMview, WIPO, Zefix, web, or domain searches. It does not guarantee registration, freedom from opposition, completeness of clearance, or current fees. It supports professional preparation; it does not replace legal judgment.

The repository's MIT license covers project material distributed under that license. Redistribution rights for the five source datasets and the derived SQLite database still require confirmation. **Do not publish a repository, database, or plugin archive containing them until that review is complete.** See [Data provenance](docs/data-provenance.md) and [Third-party data notices](plugins/swiss-trademark-deposit/THIRD_PARTY_NOTICES.md).

## Documentation

- [Plugin product and runtime](plugins/swiss-trademark-deposit/README.md)
- [Installation and troubleshooting](plugins/swiss-trademark-deposit/INSTALL.md)
- [Architecture](docs/architecture.md)
- [Maintenance and release checks](docs/maintenance.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [MIT license](LICENSE)
