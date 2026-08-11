# Architecture

This document describes the repository's intended runtime and maintenance boundaries. It is not a statement that every host combination has been certified; see [Host support](host-support.md) for the current delivery matrix.

## System shape

The project has three cooperating layers:

1. A host-facing plugin supplies the Swiss trademark workflow through `skills/`, and Claude-specific convenience commands through `commands/`.
2. Four local, read-only MCP servers expose narrow search operations for Nice headings, WDL terms, Swissreg examples, and TAF decisions.
3. All four servers query the same generated SQLite database. The database is built from the versioned source snapshot under `data-sources/`.

```text
Codex or Claude host
  -> plugin skill / Claude command
  -> MCP declarations in the platform manifest
  -> scripts/run-mcp-server.mjs
  -> one of four stdio MCP entry points
  -> servers/swiss-trademark-mcp/data/trademark.sqlite
```

The MCP services retrieve evidence. The skill coordinates that evidence into a practitioner workflow. Neither layer replaces professional judgment or an official register search.

## Repository boundaries

| Path | Responsibility |
| --- | --- |
| `.agents/plugins/marketplace.json` | Codex repository marketplace entry |
| `.claude-plugin/marketplace.json` | Claude repository marketplace entry |
| `plugins/swiss-trademark-deposit/` | Installable plugin payload |
| `plugins/swiss-trademark-deposit/.codex-plugin/` | Codex plugin metadata |
| `plugins/swiss-trademark-deposit/.claude-plugin/` | Claude plugin metadata |
| `plugins/swiss-trademark-deposit/skills/` | Host-facing workflow and reference material |
| `plugins/swiss-trademark-deposit/commands/` | Claude-specific thin command wrappers |
| `plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp/` | TypeScript sources, generated JavaScript, tests, database, and source manifest |
| `data-sources/<date>/` | Immutable inputs used to regenerate the database |
| `docs/archive/` | Historical design material; not normative runtime documentation |

## MCP runtime

Each platform manifest declares four separate servers so a host can grant and display narrowly scoped tools. Every declaration launches `scripts/run-mcp-server.mjs` with a server name. Codex resolves the wrapper from the plugin working directory; Claude resolves it through `CLAUDE_PLUGIN_ROOT`.

The wrapper:

- resolves all paths from the installed plugin root;
- verifies installed production package versions against the lockfile;
- serializes a locked production-only npm install when dependencies are absent;
- rejects a package whose prebuilt `dist/` entry points are absent; and
- replaces itself with the selected Node.js stdio server.

Consequently, a non-standalone package can require network access on first run for npm installation. Corpus queries use the local SQLite database after dependencies are present.

The database path can be overridden with `SWISS_TRADEMARK_DB`. The ingestion source root can be overridden with `SWISS_TRADEMARK_SOURCE_ROOT`.

## Data build

```text
five dated source inputs
  -> src/ingest.ts
  -> data/trademark.sqlite
  -> data/source-manifest.json
  -> four MCP query services
```

`source-manifest.json` records the source date, hash, ingested row count, warnings, and available extraction telemetry. The checksums next to the raw snapshot independently guard the moved inputs against accidental modification.
SQLite metadata binds each generated database to the manifest timestamp and a
deterministic digest of its source set; startup and release checks reject a
mismatched pair.

The source snapshot and generated database have separate roles:

- source files provide reproducibility and provenance;
- the SQLite database is the runtime artifact;
- `dist/` is generated application code; and
- the source manifest connects a database build to its inputs.

## Design constraints

- MCP tools are read-only and must not mutate the corpora or file system.
- SQL is an implementation detail; callers receive bounded, structured results.
- Tool output must identify its source and limitations rather than imply legal certainty.
- The plugin must remain relocatable: runtime paths cannot depend on a developer's absolute path.
- Historical handoff documents are evidence of earlier decisions, not an authoritative specification.
- Raw and derived data must not be publicly redistributed until the relevant rights and required notices have been confirmed. See [Data provenance](data-provenance.md).

## Release artifacts

The repository marketplace installs directly from `plugins/swiss-trademark-deposit/`. The packaging script can also produce a `.plugin` archive for compatible Claude plugin surfaces. The plugin directory therefore carries its own `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `CHANGELOG.md` rather than depending on files outside the packaged payload.

An MCPB package for ordinary Claude Desktop Chat is not currently part of this architecture.
