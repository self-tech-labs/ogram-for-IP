# Swiss Trademark Deposit

Swiss Trademark Deposit 0.2.0 is a local, source-grounded assistant for lawyers and trademark practitioners preparing Swiss filings before the IPI. It structures the work and retrieves evidence; it does not make autonomous filing decisions or replace professional review.

The plugin is co-authored by [ogram.ch](https://ogram.ch) and [enodo.ch](https://enodo.ch) as part of the ogram for IP marketplace.

## Product workflow

The shared skill guides five connected tasks:

1. collect the applicant, sign, activity, priority, territory, use, and risk facts;
2. screen absolute-ground issues;
3. identify relevant Nice classes;
4. draft goods/services wording from local Nice, WDL, and Swissreg evidence; and
5. define the live clearance and filing steps that remain.

Typical prompts include:

- `Prepare a Swiss trademark deposit for this business: ...`
- `Analyze the absolute-ground risks for this sign: ...`
- `Draft Swiss Nice labels for these products and services: ...`
- `Prepare an anteriority-search plan for this mark: ...`

## Runtime

The Codex and Claude manifests each declare the same four read-only stdio MCP servers inline:

| Server | Runtime role |
| --- | --- |
| `nice-headings` | Nice headings, filing-intake checks, and stored official filing facts |
| `wdl` | WDL search, class retrieval, and term validation |
| `swissreg-corpus` | Example wording, class combinations, sector benchmarks, mark detail, and search planning |
| `taf-decisions` | Risk screening, decision search, decision detail, and lexical similar-sign retrieval |

Each server starts through `scripts/run-mcp-server.mjs` and reads the same generated SQLite database. Paths are resolved from the installed plugin root. Version 0.2.0 exposes only these four entry points—there is no combined server and no `.mcp.json`.

The package declares Node.js 22–25 and npm 10 or newer. The normal archive includes built JavaScript but not `node_modules`; its first MCP startup runs a locked production dependency install. The standalone archive includes production dependencies and is platform-specific because of the native SQLite module. SQLite uses N-API, so one archive supports the declared Node range on the named operating system and CPU architecture.

## Host-specific components

The workflow skill is shared by Codex and Claude plugin hosts. The four files under `commands/` are Claude-only slash-command wrappers:

- `depot-marque`
- `analyse-signe`
- `rediger-libelles`
- `recherche-anteriorite`

They do not create equivalent Codex slash commands. Ordinary Claude Desktop Chat also requires a separate MCPB artifact, which this repository does not ship. Consult the exact [host-support matrix](../../docs/host-support.md) and [installation guide](INSTALL.md).

## Data snapshot

Runtime data comes from the immutable [2026-05-05 source snapshot](../../data-sources/2026-05-05/README.md):

| Ingestion source | Accepted records |
| --- | ---: |
| Nice headings | 45 |
| IPI/WDL terms | 41,539 |
| Swissreg goods/services examples | 75,155 |
| Class examples | 1,346 |
| TAF precedent extracts | 549 |

The generated [source manifest](servers/swiss-trademark-mcp/data/source-manifest.json) records hashes, counts, warnings, and extraction telemetry. The TAF parser currently records 246 warnings and uneven optional-field coverage, so confidence figures must not be treated as legal reliability.

Stored official filing links and facts were checked separately on 2026-08-04. Verify fees, filing requirements, timelines, classification practice, and official database behavior again when preparing a live filing.

## Boundaries

- The Swissreg data is a partial example corpus, not a complete clearance search.
- The plugin does not query live Swissreg, TMview, WIPO Global Brand Database, Madrid Monitor, Zefix, web, or domain sources.
- Swissreg representative information is metadata only; source rows are not mapped to representatives.
- TAF similar-sign retrieval is lexical and structural, not embedding-based.
- Outputs do not guarantee registration, absence of opposition, or freedom to use a sign.

## Build and package

From this plugin directory, the full verification gate is:

```sh
cd servers/swiss-trademark-mcp
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

From the repository root, the normal and standalone package commands create:

- `releases/swiss-trademark-deposit-0.2.0.plugin`
- `releases/swiss-trademark-deposit-0.2.0-standalone-<platform>-<arch>-napi.plugin`

Each archive has an adjacent `.sha256` checksum. The packager uses an explicit
runtime allowlist, verifies the completed ZIP structure and contents, and removes
its temporary staging directory.

See [Installation](INSTALL.md) for package behavior and verification, and [Maintenance](../../docs/maintenance.md) for ingestion and release operations.

## Licensing and redistribution

Project material distributed under the included [MIT license](LICENSE) is separate from the bundled third-party source material. Rights to redistribute the five source inputs and the derived database have not been confirmed in this repository. Do not publish either package profile until the review and required notices are complete. See [Third-party data notices](THIRD_PARTY_NOTICES.md) and [Data provenance](../../docs/data-provenance.md).
