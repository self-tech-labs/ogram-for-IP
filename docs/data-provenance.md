# Data provenance and redistribution status

The runtime database is generated from a dated five-file snapshot. This document records what is present in the repository; it does not infer permissions or licensing terms that are not documented by the source providers.

## Important rights notice

Redistribution rights for the five source files and for the database derived from them have **not been confirmed in this repository**. Their presence in the repository and the project's MIT license must not be treated as evidence that those materials may be redistributed under MIT.

Before publishing a repository, plugin archive, database, mirror, or release asset containing these materials, a maintainer must establish and record for each source:

- the authoritative origin and acquisition date;
- applicable copyright, database-right, contractual, and reuse terms;
- whether redistribution and transformation are permitted;
- required attribution, notices, or access restrictions; and
- whether personal or otherwise sensitive information requires additional handling.

If the required rights cannot be confirmed, exclude the affected source and derived material from public distribution and document a lawful local acquisition/build process. This is a release gate, not a completed legal assessment.

## Snapshot inventory

The descriptions and row counts below come from the existing ingestion manifest. A row count is the number of records accepted by the ingestion process, not an independent representation of the source file's completeness.

| Ingestion label | Snapshot file | SHA-256 | Ingested records |
| --- | --- | --- | ---: |
| WDL IPI | `Classification Nice/wdl_toutes_classes_FR.csv` | `9fbac651d0a36cf89a88c90aaf5df66d8429ae846ea8612f2c4cf57925f854eb` | 41,539 |
| Nice headings | `Classification Nice/Intitulés généraux.docx` | `01c31aca08814865c0e7cf7953e7891d0b6e4c28c84abe2b089b8ad9c5ab4e93` | 45 |
| Swissreg Produits-services | `Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx` | `38b4230883722a9339cfc04592a92488e76eb3097227f0f47b540d024fed4516` | 75,155 |
| Class examples | `Exemples marques/Liste classes.xlsx` | `0dee22cd1f2e7eabc12523926cac272ea7818730e370384e857d7d23f8a8836e` | 1,346 |
| TAF precedents | `Jurisprudence TAF/report_2026-05-05.pdf` | `1fc44c7fd36830cb4a9b13c75d2b2d34e48a2c847e23d0de23c729b74f855068` | 549 |

The snapshot date recorded by the ingestion pipeline is 2026-05-05. The raw files now live under `data-sources/2026-05-05/`, with a machine-verifiable copy of these hashes in `checksums.sha256`.

## Generated artifacts

`plugins/swiss-trademark-deposit/servers/swiss-trademark-mcp/data/trademark.sqlite` is derived from all five inputs. `source-manifest.json` records the input hashes, build timestamps, accepted record counts, and warnings.
The database also stores the manifest build timestamp and a deterministic digest
of the five source identities, paths, hashes, and accepted counts. Runtime and
package checks reject a database/manifest pair when that binding differs.

Known limitations recorded by that manifest include:

- two empty WDL terms were skipped;
- row-level representative mapping is unavailable in the Swissreg Produits-services sheet; and
- the TAF extraction reports 246 parser warnings. Although its recorded average confidence is 0.888, field coverage is uneven: `sign_type` is present for 100 of 549 entries and TAF references for 83 of 549 entries.

These figures describe parser output, not legal reliability. Searches must preserve source attribution and expose uncertainty where relevant.

## Integrity and updates

Verify the raw snapshot before ingestion:

```sh
cd data-sources/2026-05-05
shasum -a 256 -c checksums.sha256
```

Do not silently replace files inside a dated snapshot. Add a new dated snapshot, retain its acquisition notes and checksums, update the ingestion source date, regenerate the database and manifest, and review the resulting count/warning changes. The detailed workflow is in [Maintenance](maintenance.md).

Historical material under `docs/archive/` may help trace earlier design choices, but it is not proof of source ownership, authority, completeness, or permission to redistribute.
