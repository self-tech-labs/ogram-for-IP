# Changelog

All notable changes to the Swiss Trademark Deposit plugin are documented here.

## 0.2.0 - 2026-08-04

### Added

- Maintainer documentation for architecture, data provenance, host support, and release operations.
- A plugin-local MIT license, third-party data notice, and changelog so packaged artifacts carry their own notices.
- A dated data-source directory with SHA-256 verification for all five ingestion inputs.
- Repository contribution and security policies.
- Bounded shared MCP input schemas and read-only/idempotent annotations for all 29 tools.
- Database application/schema metadata, database-to-manifest source-set binding, startup compatibility checks, bounded manifest validation, and byte-for-byte ingestion reproducibility checks.
- Adversarial skill evaluation fixtures and real stdio MCP initialize/list/call integration tests for all four servers.
- Ogram logo metadata and a packaged 512×512 brand asset for the Codex plugin library.

### Changed

- Separated reproducible ingestion inputs from historical developer handoff material.
- Moved the developer document, handoff notes, and legacy skill source into a non-normative documentation archive.
- Replaced the incompatible Claude-root-variable configuration with a Codex-native `.mcp.json` and Claude-specific inline declarations.
- Reworked Swissreg class-combination queries to stay SQL-bounded instead of loading the full corpus into memory.
- Removed a duplicated source-file label from every Swissreg goods/services row, reducing the generated database by roughly 7 MB while preserving API provenance output; the enforced database budget is now 100 MB.
- Hardened first-run runtime setup with cross-process locking and exact lockfile-version checks.
- Replaced denylist packaging with a deterministic, cross-platform, allowlisted ZIP writer that validates paths, file types, secrets, sizes, entry counts, CRCs, and SHA-256 output; corpus checks scan logical SQLite text fields for credential-shaped material without raw-page false positives.
- Updated MCP/runtime dependencies and the lockfile; `better-sqlite3` now uses its N-API release, eliminating the deprecated prebuild installer and making one platform/architecture build usable across Node.js 22–25. Standalone archives retain only the applicable native binaries and discard native build sources.
- The audited production and development dependency trees now report zero known npm vulnerabilities.
- Updated the stored official-source verification date to 2026-08-04.

### Fixed

- Codex MCP startup no longer receives an unexpanded Claude-only plugin-root variable.
- Codex 0.136 catalog ingestion accepts the plugin manifest because `mcpServers` points to the supported plugin-local `.mcp.json`.
- Both host manifests now pass their canonical/installed validators and use the supported `Business & Operations` category.
- Exact TAF reference lookup rejects blanks and SQL wildcard inputs, and class/outcome filters apply to the same class row.
- Filing intake rejects empty goods/services term lists and unsupported language codes.
- Filing-language detection no longer mistakes the French/English cognate “services” for proof of French wording.
- Swissreg results expose the real mark identifier while retaining an explicit legacy goods/services identifier.
- Database ingestion builds and validates temporary artifacts, then installs the database and provenance manifest as one rollback-protected set.
- Runtime setup never evicts a lock whose owner process is still alive, and all runtime checks enforce the declared Node.js 22–25 range.

### Removed

- The redundant generated `swiss-trademark-deposit.skill` archive; the equivalent legacy `SKILL.md` source remains preserved.
- The duplicated combined MCP server, unused custom `manifest.json`, completed implementation plan, and empty data placeholder.

### Data integrity

- All five ingestion inputs were moved without content changes and retain the hashes recorded by the existing source manifest.
- Dataset and derived-database redistribution remain gated on confirmation of the applicable rights and notices.

## 0.1.0 - 2026-05-19

- Initial repository marketplace release.
