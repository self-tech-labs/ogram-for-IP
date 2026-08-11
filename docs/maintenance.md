# Maintenance

This guide covers a clean data, build, test, and release cycle. Run commands from the repository root unless a section changes directory explicitly.

## Prerequisites

- Node.js 22 through 25
- npm 10 or newer
- the complete five-file source snapshot when regenerating data

The MCP package uses a native SQLite dependency. Build and installation checks should therefore include every platform distributed to users.

## Verify the source snapshot

```sh
cd data-sources/2026-05-05
shasum -a 256 -c checksums.sha256
cd ../..
```

All five files must report `OK`. A mismatch is a stop condition: determine whether the file is corrupt, accidentally changed, or intentionally replaced. Intentional replacements belong in a new dated snapshot with new provenance and checksums.

## Install development dependencies

```sh
cd plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp
npm ci
```

`npm ci` is the reproducible installation path and requires the committed lockfile.

## Regenerate the database

From the MCP package directory:

```sh
npm run ingest
```

The default source root is `data-sources/2026-05-05`. To test another complete snapshot without changing the default:

```sh
SWISS_TRADEMARK_SOURCE_ROOT=/absolute/path/to/source-snapshot npm run ingest
```

Ingestion replaces `data/trademark.sqlite` and `data/source-manifest.json`. Review both artifacts rather than accepting a successful exit alone:

- every expected source hash must match;
- accepted record counts and warnings must be explained;
- the source date must identify the actual snapshot;
- TAF extraction coverage and warnings must be reviewed; and
- the database must remain within repository and package size budgets.

## Build and test

From the MCP package directory:

```sh
npm run build
npm run typecheck:test
npm test
npm run smoke
npm run plugin:smoke
npm run ingest:check
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

After a clean build, verify that committed generated artifacts are current:

```sh
git diff --exit-code -- dist data/source-manifest.json
```

Also run the current Codex and Claude plugin validators during release preparation. The repository smoke script supplements host validation; it does not replace it.

## Package

```sh
npm run plugin:package
```

For a package that includes production npm dependencies:

```sh
node ../../scripts/package-plugin.mjs --with-node-modules
```

Inspect the generated archive and adjacent `.sha256` checksum as an end user would receive them. It must contain the platform manifests and their MCP declarations, skill, applicable Claude commands, built MCP entry points, database, source manifest, `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `CHANGELOG.md`. It must not depend on files elsewhere in the repository. Standalone archive names must identify their operating system, CPU architecture, and N-API runtime.

## Versioning

For each release:

1. Choose one semantic version for the plugin and MCP package.
2. Update every platform manifest, marketplace entry, package manifest, and lockfile that embeds it.
3. Add a dated changelog entry.
4. Run a parity check so no stale version remains.
5. Test updating an existing installation as well as installing from scratch.

Explicitly versioned Claude plugins require a version bump for clients to discover a new release.

## Data and legal release gate

Do not publish raw sources, the generated database, or an archive containing them until redistribution rights and required notices have been confirmed and recorded. See [Data provenance](data-provenance.md) and the plugin's `THIRD_PARTY_NOTICES.md`.

This gate applies even when code tests pass. If redistribution is not permitted or remains uncertain, publish only material that can lawfully be distributed and provide a documented local build path for the rest.

## Release checklist

- [ ] Working tree contains no unexplained changes.
- [ ] Source checksums pass and there are exactly five expected inputs.
- [ ] Ingestion counts, warnings, and extraction coverage were reviewed.
- [ ] Build, unit tests, smoke tests, and host validators pass.
- [ ] Generated `dist/`, database, and source manifest are current.
- [ ] Database and archive sizes are below enforced budgets.
- [ ] Versions agree everywhere and the changelog is current.
- [ ] Package contents were inspected and installed in a clean environment.
- [ ] License and third-party notices are present in the package.
- [ ] Dataset redistribution rights were confirmed or restricted material was excluded.
- [ ] Host claims match the artifacts actually tested.
