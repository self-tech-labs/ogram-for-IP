# Documentation de remise - swiss-trademark-deposit

Date de preparation : 2026-05-05

Ce dossier est le paquet de remise a transmettre au developpeur charge de transformer le skill `swiss-trademark-deposit` en MCP, puis en plugin Claude.

## Objectif

Construire une capacite Claude specialisee dans le depot de marques suisses, capable de :

- guider un entrepreneur ou un praticien dans le depot d'une marque suisse aupres de l'IPI ;
- selectionner les classes de Nice pertinentes ;
- rediger des libelles acceptables par l'IPI en s'appuyant sur la WDL et les intitulés generaux Nice ;
- rechercher des exemples professionnels dans un corpus Swissreg ;
- retrouver des precedents TAF pertinents pour qualifier les motifs absolus ;
- fonctionner comme plugin Claude Code / Cowork, et eventuellement comme bundle Claude Desktop `.mcpb`.

## Documents du dossier

- `01_BRIEF_FONCTIONNEL.md` - vision produit, utilisateurs, parcours cible.
- `02_INVENTAIRE_SOURCES.md` - etat exact des fichiers annexes et role de chacun.
- `03_ARCHITECTURE_CIBLE.md` - architecture recommandee MCP + plugin.
- `04_CONTRATS_MCP.md` - outils, ressources, schemas d'entree/sortie.
- `05_PIPELINE_DONNEES.md` - ingestion, normalisation, indexation, mises a jour.
- `06_PLUGIN_CLAUDE.md` - structure du plugin Claude et variante `.mcpb`.
- `07_PLAN_IMPLEMENTATION.md` - plan de travail par lots.
- `08_TESTS_RECETTE.md` - tests fonctionnels et criteres d'acceptation.
- `09_DECISIONS_OUVERTES.md` - points a trancher avant developpement final.

## Annexes sources a conserver

Les fichiers sources restent a la racine du dossier de travail :

- `Skill/swiss-trademark-deposit.skill`
- `Classification Nice/wdl_toutes_classes_FR.csv`
- `Classification Nice/Intitulés généraux.docx`
- `Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx`
- `Exemples marques/Liste classes.xlsx`
- `Jurisprudence TAF/report_2026-05-05.pdf`

## Decision importante

Le terme "plugin Claude" peut designer deux livrables differents :

1. Plugin Claude Code / Cowork : dossier versionne avec `.claude-plugin/plugin.json`, `skills/`, `commands/`, `.mcp.json`.
2. Extension Claude Desktop : bundle local `.mcpb` avec `manifest.json` et serveur MCP embarque.

La recommandation est de produire d'abord le plugin Claude Code / Cowork, puis de packager le meme serveur MCP en `.mcpb` si l'installation en un clic sur Claude Desktop est souhaitee.

## Sources techniques consultees

- Claude plugins overview : https://claude.com/docs/plugins/overview
- Claude Code plugins : https://code.claude.com/docs/en/plugins
- Claude Code plugins reference : https://code.claude.com/docs/en/plugins-reference
- MCP tools specification : https://modelcontextprotocol.io/specification/2025-03-26/server/tools
- MCP resources specification : https://modelcontextprotocol.io/specification/2025-03-26/server/resources
- MCP prompts specification : https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- Anthropic Desktop Extensions / MCPB : https://www.anthropic.com/engineering/desktop-extensions
- MCPB repository : https://github.com/modelcontextprotocol/mcpb

## APIs EUIPO a signaler au developpeur

Deux APIs officielles EUIPO peuvent aider dans une version connectee du MCP :

- Goods And Services : https://dev.euipo.europa.eu/product/goods-and-services_110
- Trademark search : https://dev.euipo.europa.eu/product/trademark-search_100

Elles ne remplacent pas les corpus suisses locaux en v1, mais peuvent completer :

- la redaction, validation et traduction des libelles de produits/services via TMClass ;
- la recherche d'anteriorites dans la base EUIPO, utile comme signal complementaire hors Suisse.

Point important : ces APIs passent par le portail developpeur EUIPO et demandent une connexion/souscription a un plan. Il faut donc les traiter comme integration optionnelle configurable, pas comme dependance obligatoire du plugin.
