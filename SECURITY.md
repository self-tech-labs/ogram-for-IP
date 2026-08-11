# Security policy

## Supported versions

Security fixes are applied to the latest maintained release and the current default branch. Older snapshots and material under `docs/archive/` are not supported runtime versions.

## Reporting a vulnerability

Use GitHub's private **Report a vulnerability** feature for this repository when it is available. Include:

- the affected version and host;
- the smallest reproducible example;
- impact and realistic attack prerequisites;
- relevant logs with secrets and matter data removed; and
- any proposed mitigation.

If private vulnerability reporting is unavailable, open a minimal public issue asking the maintainers to establish a private contact channel. Do not publish exploit details, credentials, confidential trademark matters, personal data, or third-party licensed source material in that issue.

No response-time or bug-bounty commitment is currently published.

## Security model

The four MCP servers are intended to expose read-only searches over a local SQLite database. Important review areas include:

- MCP argument validation and response-size bounds;
- SQL injection and unsafe dynamic query construction;
- path traversal or unsafe use of environment-provided paths;
- archive packaging and plugin-root resolution;
- tampering with raw sources, generated databases, manifests, or checksums;
- npm dependency and native-module supply-chain risk; and
- accidental disclosure through fixtures, logs, error messages, or corpora.

The standard package can run `npm ci` on first use when dependencies are absent, which introduces network and package-registry trust at installation time. A standalone package reduces that first-run fetch but must still be built, scanned, and tested for each supported platform.

Legal accuracy, stale public data, incomplete searches, and dataset licensing questions are important product risks but are not automatically software security vulnerabilities. Use the normal issue process for those concerns unless they also create a concrete confidentiality, integrity, or execution risk.
