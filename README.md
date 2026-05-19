# ogram for IP

Open-source AI skills and local MCP tools for Swiss intellectual property professionals.

This repository packages AI assistance for lawyers and trademark practitioners working with Swiss filings, especially trademark deposits before the Swiss Federal Institute of Intellectual Property (IPI). It includes a plug-and-play local plugin for Codex, with Claude-compatible MCP metadata for local plugin environments.

The ogram for IP marketplace is co-authored by [ogram.ch](https://ogram.ch) and [enodo.ch](https://enodo.ch). Ogram contributed the legaltech AI technical side, while enodo contributed the law-firm expertise. Together, they created and open-sourced this set of skills for professionals in intellectual property.

Repository: [github.com/self-tech-labs/ogram-for-IP](https://github.com/self-tech-labs/ogram-for-IP)

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).

## What Is Inside

| Item | Name | Purpose |
| --- | --- | --- |
| Marketplace | `ogram-for-ip` | Presents the available IP tools in Codex. |
| Plugin | Swiss Trademark Deposit | Prepares Swiss trademark filing recommendations. |
| Skill | `swiss-trademark-deposit` | Guides the assistant through Swiss trademark deposit work. |
| MCP servers | `nice-headings`, `wdl`, `swissreg-corpus`, `taf-decisions` | Give the assistant controlled access to local Nice, WDL, Swissreg, and TAF sources. |
| Commands | `depot-marque`, `analyse-signe`, `rediger-libelles`, `recherche-anteriorite` | Ready-made workflows for common practitioner tasks. |

## Main Plugin

### Swiss Trademark Deposit

Use this when you need to:

- assess whether a word mark, logo, or combined sign may face absolute-ground objections in Switzerland;
- identify relevant Nice classes for a Swiss trademark filing;
- draft goods and services wording using Nice headings, IPI/WDL terms, and comparable Swissreg examples;
- prepare a practical anteriority search plan across Swissreg, TMview, Global Brand Database, Madrid Monitor, Zefix, and web search;
- produce an action-oriented filing note for internal review or client discussion.

The plugin uses local corpora, including Nice class headings, IPI/WDL terms, professional Swissreg examples, and TAF/IGE precedent extracts. It is offline-first once runtime dependencies are installed; the normal package installs those automatically on first MCP startup.

For the TAF PDF corpus, ingestion includes a reusable `swiss-trademark-langextract` layer with field-level extraction evidence and confidence telemetry. This is surfaced in corpus stats and the source manifest so maintainers can detect weak document parsing before relying on a regenerated package.

## Install In Codex

Add this repository as a marketplace in Codex:

```text
Source: https://github.com/self-tech-labs/ogram-for-IP.git
Git ref: main
Sparse paths:
.agents/plugins
plugins/swiss-trademark-deposit
```

Then install **Swiss Trademark Deposit** from the **ogram for IP** marketplace.

Start with one of these prompts:
   - `Prepare a Swiss trademark deposit for this business: ...`
   - `Analyze whether this sign is registrable in Switzerland: ...`
   - `Draft Swiss Nice labels for these products and services: ...`
   - `Prepare an anteriority search strategy for this mark: ...`

For best results, give the assistant the proposed sign, the applicant's activity, the current and planned products or services, and the risk posture. For logos or combined marks, provide the image or describe the visual elements.

## Plug-And-Play Packaging

Create a portable plugin package:

```bash
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs
```

This verifies the plugin and creates:

```text
releases/swiss-trademark-deposit/
releases/swiss-trademark-deposit-0.1.0.plugin
```

For an offline, platform-specific package that includes production `node_modules`, run:

```bash
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs --with-node-modules
```

Installation details for repo-local Codex, home-local Codex, and Claude-compatible MCP use are in:

```text
plugins/swiss-trademark-deposit/INSTALL.md
```

## Claude Cowork And Claude Code

Claude-compatible metadata is included at the repository root and plugin root:

- marketplace catalog: `.claude-plugin/marketplace.json`;
- plugin manifest: `plugins/swiss-trademark-deposit/.claude-plugin/plugin.json`;
- MCP server config: `plugins/swiss-trademark-deposit/.mcp.json`.

For Claude Cowork, build the `.plugin` archive and upload it as a custom plugin file from the Cowork plugin browser.

For Claude Code marketplace-style installation:

```bash
claude plugin marketplace add self-tech-labs/ogram-for-IP --sparse .claude-plugin plugins/swiss-trademark-deposit
claude plugin install swiss-trademark-deposit@ogram-for-ip
```

## Legal Positioning

This marketplace is built for legal preparation, not automatic legal conclusions.

The plugin does not guarantee registration by the IPI, does not guarantee absence of opposition, and does not replace a lawyer's professional judgement. It is especially useful for structuring the work, checking terminology, surfacing comparable materials, and documenting uncertainty.

The local Swissreg corpus is a professional example corpus. It is not a complete anteriority search.

## Source Coverage

The current package is based on the local source bundle dated 2026-05-05:

- 45 Nice headings, version NCL(13-2026);
- 41,539 usable IPI/WDL goods and services terms;
- 75,155 Swissreg professional goods/services rows from 25,823 marks;
- 558 Swissreg mandataire metadata rows;
- 549 TAF/IGE absolute-ground precedent extracts;
- stored IPI/WIPO filing facts checked on 2026-05-16.

Before using outputs in a live filing, verify current IPI fees, filing requirements, and any updated official sources.

Current non-capabilities:

- no complete live anteriority search;
- no live Swissreg, TMview, WIPO Global Brand Database, Madrid Monitor, Zefix, or web querying;
- no EUIPO TMclass or Trademark Search API integration yet;
- no row-level Swissreg mandataire filtering;
- no embeddings for TAF similar-sign matching.

## For Maintainers

The marketplace entry is:

```text
.agents/plugins/marketplace.json
```

The plugin lives at:

```text
plugins/swiss-trademark-deposit
```

Developer setup for the local MCP servers:

```bash
cd plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp
npm ci
npm run ingest
npm run build
npm test
```

Smoke-check the plugin package:

```bash
node plugins/swiss-trademark-deposit/scripts/check-plugin.mjs
```

Do not commit `node_modules/` or local machine files such as `.DS_Store`. The legal source files and generated SQLite corpus should only be published where redistribution rights have been reviewed.
