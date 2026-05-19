# Swiss Trademark Deposit

Swiss Trademark Deposit is a Codex/Claude-compatible plugin for lawyers and trademark practitioners preparing Swiss trademark filings before the IPI.

It is part of the ogram for IP marketplace, co-authored by [ogram.ch](https://ogram.ch) and [enodo.ch](https://enodo.ch). Ogram contributed the legaltech AI technical side, and enodo contributed the law-firm expertise. Both contributed to creating and open-sourcing this set of skills for professionals in IP.

It is packaged as an offline-first local plugin: the skill, commands, four MCP servers, built JavaScript, and generated SQLite corpus live inside this folder. The normal package is portable and installs MCP runtime dependencies on first use; a larger platform-specific standalone package can include production `node_modules`.

## What It Does

The plugin helps structure Swiss trademark filing work around five practical questions:

- Can the sign face absolute-ground objections in Switzerland?
- Which Nice classes fit the applicant's real activity?
- Which goods and services wording is supported by Nice, IPI/WDL, and comparable Swissreg examples?
- What anteriority searches should be run before filing?
- Is the filing file complete enough for a lawyer to move to live clearance and e-trademark?

## Included Sources

The plugin combines a workflow skill with four local read-only MCP servers over:

- Nice class headings, version NCL(13-2026);
- IPI WDL terms from `wdl_toutes_classes_FR.csv`;
- professional Swissreg examples from the 2026-05-05 partial corpus;
- TAF/IGE absolute-ground precedent extracts from `report_2026-05-05.pdf`;
- stored IPI/WIPO filing facts checked on 2026-05-16, with official links for verification.

Current generated corpus counts:

| Source | Count |
| --- | ---: |
| Nice headings | 45 |
| WDL usable terms | 41,539 |
| Swissreg goods/services rows | 75,155 |
| Swissreg marks | 25,823 |
| Swissreg mandataire metadata rows | 558 |
| TAF/IGE precedent entries | 549 |

TAF PDF ingestion uses a reusable `swiss-trademark-langextract` utility layer. It segments the report, extracts source-backed legal articles, Nice-class outcomes, TAF references, sign type, risk tags, page spans, and per-entry extraction confidence, then records aggregate parser telemetry in `source-manifest.json`.

## MCP Server Layout

The configured servers mirror the developer documentation:

| Server | Main tools |
| --- | --- |
| `nice-headings` | `get_nice_heading`, `list_nice_headings`, `filing_intake_check`, `filing_requirements_snapshot`, `corpus_stats` |
| `wdl` | `search_wdl`, `get_wdl_terms_by_class`, `validate_term`, `corpus_stats` |
| `swissreg-corpus` | `search_swissreg_terms`, `get_class_combinations`, `get_sector_benchmark`, `list_mandataires`, `swissreg_mark_detail`, `clearance_search_plan`, `corpus_stats` |
| `taf-decisions` | `sign_risk_screen`, `search_taf_decisions`, `get_taf_decision`, `find_similar_signs`, `corpus_stats` |

The older combined `swiss-trademark` entry point is still built for local compatibility, but `.mcp.json` exposes the four corpus-specific servers.

The `.mcp.json` entries start through `scripts/run-mcp-server.mjs`. This wrapper keeps MCP stdout clean, installs production runtime dependencies on first run when needed, then launches the requested built server.

## Typical Use

Use one of the marketplace prompts, or ask directly:

- `Prepare a Swiss trademark deposit for this business: ...`
- `Analyze whether this sign is registrable in Switzerland: ...`
- `Draft Swiss Nice labels for these products and services: ...`
- `Prepare an anteriority search strategy for this mark: ...`

The plugin works best when it receives the proposed sign, the applicant activity, current and planned goods or services, and the desired risk posture. For logos or combined marks, provide the image or describe the visual elements.

## Packaging And Installation

See `INSTALL.md` for Codex and Claude-compatible installation details.

Build and verify from the repository root:

```bash
cd plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp
npm ci
npm run build
npm test
cd -
node plugins/swiss-trademark-deposit/scripts/check-plugin.mjs
```

Create a portable `.plugin` archive:

```bash
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs
```

This creates:

- `releases/swiss-trademark-deposit/`
- `releases/swiss-trademark-deposit-0.1.0.plugin`

Create an offline, platform-specific package that includes production dependencies:

```bash
node plugins/swiss-trademark-deposit/scripts/package-plugin.mjs --with-node-modules
```

## Commands And Workflows

- `depot-marque` prepares a complete Swiss filing recommendation.
- `analyse-signe` analyzes absolute grounds and TAF precedent.
- `rediger-libelles` drafts Nice/WDL/Swissreg-backed labels.
- `recherche-anteriorite` prepares the manual Swissreg, TMview, BrandDB, Madrid Monitor, and Zefix search strategy.

The MCP servers also expose filing-intake, sign-risk, clearance-plan, fee/timing snapshot, mandataire-metadata, and corpus-freshness tools for lawyer-facing workflows.

## Current Non-Capabilities

- It does not perform a complete live anteriority search.
- It does not query live Swissreg, TMview, WIPO Global Brand Database, Madrid Monitor, Zefix, or web sources.
- It does not integrate EUIPO TMclass or EUIPO Trademark Search APIs yet.
- It does not apply Swissreg mandataire filters to goods/services rows; mandataire data is metadata only in the delivered source.
- It does not use embeddings for TAF similar-sign matching.
- It does not guarantee IPI registration, absence of opposition, or current official fee accuracy.

## Legal Posture

This plugin provides preparatory assistance based on supplied information and local corpora. It does not guarantee registration by the IPI, does not guarantee absence of opposition, and does not replace specialized legal advice for commercially significant matters.

The local Swissreg material is a professional example corpus, not a complete clearance search. Relative-ground clearance still requires live Swissreg, TMview, WIPO Global Brand Database, Madrid Monitor, Zefix, and web/domain searches or a professional search provider.

## Data Updates

Replace the source files in `swiss-trademark-deposit-developer-package-2026-05-05`, then run `npm run ingest` from `servers/swiss-trademark-mcp`. The source manifest records hashes, source dates, counts, and warnings.

Fees, filing requirements, official database behavior, and classification practice must be verified against the official IPI/WIPO sources at filing time.
