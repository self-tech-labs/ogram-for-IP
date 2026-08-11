# Contributing

Thank you for helping improve the Swiss trademark deposit plugin. Contributions should preserve its core properties: source-grounded outputs, local read-only retrieval, reproducible data builds, portable plugin paths, and explicit uncertainty.

## Before starting

- Read `docs/architecture.md`, `docs/host-support.md`, and `docs/maintenance.md`.
- Open an issue before a large architecture, data-source, or legal-workflow change so scope and evidence can be agreed.
- Report security vulnerabilities through the private process in `SECURITY.md`, not a public issue.

## Development setup

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

Use the Node.js and npm ranges declared in the MCP package. Keep changes focused and do not include unrelated generated files, editor state, dependency directories, or release archives.

## Contribution standards

### Runtime code

- Keep MCP operations read-only, bounded, and source-attributed.
- Validate all externally supplied tool arguments.
- Do not introduce developer-specific absolute paths.
- Add or update tests for success, empty-result, invalid-input, and failure cases.
- Rebuild `dist/` when tracked TypeScript entry points change, and verify generated output is current.

### Skills and legal workflow

- Cite current primary or official sources for legal and procedural propositions.
- Clearly separate source-backed facts, implementation policy, inference, and practitioner judgment.
- Do not state that a search is exhaustive, that registration is guaranteed, or that the plugin replaces professional review.
- Add evaluation fixtures for material workflow changes, including adversarial requests that would otherwise encourage invented labels or unsupported conclusions.

### Data

- Never overwrite a dated source snapshot in place.
- Record origin, acquisition date, checksums, applicable terms, transformations, accepted counts, and warnings for every new source.
- Confirm redistribution rights before committing or packaging third-party material.
- Regenerate both `trademark.sqlite` and `source-manifest.json`, then review differences rather than accepting them mechanically.
- Do not include confidential client data or credentials in examples, fixtures, logs, or corpora.

### Documentation and metadata

- Keep the root README focused on the repository and quick start, and plugin documentation focused on end-user behavior.
- Update `docs/host-support.md` when an artifact or tested host changes.
- Keep versions aligned across manifests, marketplace entries, package metadata, lockfiles, and the changelog.
- Ensure packaged artifacts carry the plugin-local license and third-party notices.

## Pull request checklist

- [ ] The change has a clear purpose and no unrelated edits.
- [ ] Build, tests, smoke checks, and relevant host validators pass.
- [ ] New behavior and failure modes are tested.
- [ ] Generated files are current and reproducible.
- [ ] Documentation and changelog entries are updated where needed.
- [ ] Data hashes, provenance, warnings, and rights status are documented.
- [ ] No secrets, client information, dependency directories, or release archives are committed.
- [ ] Host compatibility claims reflect an installation test from the actual deliverable.

Only submit material you are authorized to share. Dataset or third-party-material contributions require separate, documented permission suitable for the repository's intended use and distribution.
