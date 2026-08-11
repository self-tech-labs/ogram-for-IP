# Source snapshot: 2026-05-05

This directory contains the five inputs consumed by the Swiss trademark MCP ingestion pipeline for the snapshot dated 2026-05-05.

```text
Classification Nice/
  Intitulés généraux.docx
  wdl_toutes_classes_FR.csv
Exemples marques/
  Liste classes.xlsx
  swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx
Jurisprudence TAF/
  report_2026-05-05.pdf
```

There must be exactly five ingestion inputs in this snapshot. Their SHA-256 values are recorded in `checksums.sha256` and in the generated MCP `data/source-manifest.json`.

Verify them from this directory with:

```sh
shasum -a 256 -c checksums.sha256
```

The files were moved from the original dated developer-package directory without content changes. Do not edit or silently replace an input inside this snapshot. For a data update, create a new dated directory, record new checksums and provenance, and update the ingestion source date.

`SWISS_TRADEMARK_SOURCE_ROOT` can point the ingestion process at this directory or another complete snapshot with the same expected layout.

## Rights status

The snapshot does not include sufficient source-license or permission records to confirm public redistribution rights. File names and ingestion labels identify the material for engineering purposes; they do not establish ownership, authorization, completeness, or official status.

Do not publish these inputs or the database derived from them until the applicable reuse and redistribution terms have been confirmed and documented. See `docs/data-provenance.md` and the plugin's `THIRD_PARTY_NOTICES.md`.
