---
description: Preparateur complet de depot de marque suisse
allowed-tools:
  - "mcp__plugin_swiss-trademark-deposit_nice-headings__get_nice_heading"
  - "mcp__plugin_swiss-trademark-deposit_nice-headings__list_nice_headings"
  - "mcp__plugin_swiss-trademark-deposit_nice-headings__filing_intake_check"
  - "mcp__plugin_swiss-trademark-deposit_nice-headings__filing_requirements_snapshot"
  - "mcp__plugin_swiss-trademark-deposit_nice-headings__corpus_stats"
  - "mcp__plugin_swiss-trademark-deposit_wdl__search_wdl"
  - "mcp__plugin_swiss-trademark-deposit_wdl__get_wdl_terms_by_class"
  - "mcp__plugin_swiss-trademark-deposit_wdl__validate_term"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__search_swissreg_terms"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__get_class_combinations"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__get_sector_benchmark"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__list_mandataires"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__swissreg_mark_detail"
  - "mcp__plugin_swiss-trademark-deposit_swissreg-corpus__clearance_search_plan"
  - "mcp__plugin_swiss-trademark-deposit_taf-decisions__sign_risk_screen"
  - "mcp__plugin_swiss-trademark-deposit_taf-decisions__search_taf_decisions"
  - "mcp__plugin_swiss-trademark-deposit_taf-decisions__get_taf_decision"
  - "mcp__plugin_swiss-trademark-deposit_taf-decisions__find_similar_signs"
---

Prepare un depot de marque suisse a partir des informations suivantes:

$ARGUMENTS

Suis le skill `swiss-trademark-deposit`. Si l'activite n'est pas claire, demande seulement les informations indispensables. Sinon, produis un memo de depot actionnable avec controle d'intake, signe, risques absolus, classes, libelles complets en langue officielle suisse, sources, strategie d'anteriorite, estimation indicative des couts IPI, dates de corpus et prochaines etapes.
