# PLAN.md - Swiss Trademark Deposit Plugin

## Summary

Build a private, repo-local Codex plugin at `plugins/swiss-trademark-deposit` with Claude plugin compatibility. The v1 implementation is offline-first: four read-only TypeScript MCP servers backed by the same SQLite/FTS corpus, local source corpora, the Swiss trademark workflow skill, practical commands, and automated verification against the supplied package.

## Iterations

1. Scaffold and finalize plugin manifests, marketplace entry, README, PLAN, skill, references, and commands.
2. Build the TypeScript MCP package and ingestion pipeline that generates `servers/swiss-trademark-mcp/data/trademark.sqlite` and `source-manifest.json`.
3. Implement four MCP entry points matching the developer documentation: `nice-headings`, `wdl`, `swissreg-corpus`, and `taf-decisions`.
4. Expose DOCX-facing contracts: `get_nice_heading`, `list_nice_headings`, `search_wdl`, `get_wdl_terms_by_class`, `validate_term`, `search_swissreg_terms`, `get_class_combinations`, `get_sector_benchmark`, `list_mandataires`, `search_taf_decisions`, `get_taf_decision`, and `find_similar_signs`, with compatibility aliases for the previous combined server tool names.
5. Add resources: `nice://headings`, `nice://heading/{class_number}`, `corpus://stats`, and `source://manifest`.
6. Verify ingestion counts, tool behavior, acceptance scenarios, plugin loading assumptions, and offline operation.
7. Package the plugin for Codex-first local installation with Claude-compatible metadata, runtime dependency bootstrap, install documentation, and `.plugin` archive generation.

## Acceptance Gates

- WDL ingestion loads 41,539 usable terms across 45 classes and reports the two empty source rows it skipped.
- Nice ingestion loads exactly 45 headings and reports NCL(13-2026).
- Swissreg ingestion loads 75,155 searchable `Produits-services` rows and excludes `A reprendre`.
- Class examples ingestion records 1,346 non-empty examples and warnings for unclassified cells.
- TAF ingestion extracts 78 pages, about 549 entries or fallback chunks, and preserves `B-xxxx/yyyy` references.
- Every search result includes source metadata and bounded output.
- Unsupported Swissreg mandataire filters report `mandataire_filter_applied: false` and explain that the delivered workbook lacks row-level attribution.
- `.mcp.json` exposes exactly four MCP servers, matching the developer documentation.
- Swissreg sector benchmarks and class-combination lookups are available from `swissreg-corpus`.
- TAF decisions can be looked up by TAF reference and searched by local structural/lexical similar-sign matching with extracted signs, structural tags, sign type, class overlap, and FTS hits.
- TAF PDF parsing runs through the reusable `swiss-trademark-langextract` utilities, and `source-manifest.json` records extraction confidence, field coverage, parser version, and low-confidence counts.
- Filing outputs can include intake gaps, official-language status, fee/timing snapshot, and clearance search plan.
- The plugin never presents Swissreg or EUIPO as a complete Swiss anteriority search and never promises registration.
- `scripts/run-mcp-server.mjs` starts each MCP server from a relocatable plugin root and installs production runtime dependencies on first use if needed.
- `scripts/package-plugin.mjs` creates a portable `.plugin` archive and can optionally include production `node_modules` for an offline platform-specific package.
- Documentation states actual capabilities, data counts, install paths, and non-capabilities.

## Later Iterations

- EUIPO Goods & Services and Trademark Search APIs, only with explicit credentials.
- Embeddings for structurally comparable signs.
- Re-scraping of the Swissreg `A reprendre` sheet.
- Public distribution after corpus redistribution rights are reviewed.
