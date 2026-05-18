# Plan d'implementation

## Lot 0 - Decisions avant code

Objectif : eviter les mauvaises bifurcations.

A trancher :

- cible prioritaire : Claude Code/Cowork, Claude Desktop `.mcpb`, ou les deux ;
- licence et droit de redistribuer les corpus ;
- nom exact de l'auteur/organisation ;
- frequence de mise a jour des donnees ;
- niveau de support attendu pour le francais, allemand, italien et anglais.

Livrable :

- decisions consignees dans `09_DECISIONS_OUVERTES.md`.

## Lot 1 - Ingestion donnees

Objectif : produire `trademark.sqlite`.

Taches :

- parser WDL CSV ;
- parser DOCX chapeaux Nice ;
- parser Swissreg XLSX ;
- parser Liste classes XLSX ;
- extraire et segmenter TAF PDF ;
- generer `source-manifest.json` ;
- ajouter tests d'ingestion.

Critere de fin :

- `corpus_stats` peut reproduire les volumes attendus ;
- les recherches de base retournent des resultats.

## Lot 2 - Serveur MCP

Objectif : exposer les outils read-only.

Taches :

- creer serveur MCP TypeScript ;
- connecter SQLite ;
- implementer les tools du document `04_CONTRATS_MCP.md` ;
- implementer resources ;
- limiter taille des sorties ;
- gerer erreurs propres ;
- ajouter tests unitaires.

Critere de fin :

- un client MCP peut lister les tools ;
- chaque tool a au moins un test positif et un test d'erreur.

## Lot 3 - Plugin Claude Code / Cowork

Objectif : livrer un plugin exploitable par Claude.

Taches :

- creer `.claude-plugin/plugin.json` ;
- ajouter `.mcp.json` ;
- integrer le skill ;
- restructurer `references/` ;
- ajouter commandes ;
- ajouter README ;
- tester avec Claude Code via `--plugin-dir`.

Critere de fin :

- le plugin se charge sans erreur ;
- les commandes apparaissent ;
- Claude invoque les tools MCP dans les workflows attendus.

## Lot 4 - Recette metier

Objectif : verifier que l'assistant travaille comme un praticien.

Cas de test :

- cabinet d'avocats lausannois ;
- plateforme e-commerce vinicole ;
- acteur veterinaire integre ;
- programme traiteur / insertion ;
- signe verbal descriptif limite ;
- logo figuratif avec risque de croix suisse/croix rouge.

Critere de fin :

- les classes proposees sont defendables ;
- les libelles utilisent Nice + WDL + Swissreg ;
- les precedents TAF sont cites quand ils sont pertinents ;
- Claude ne pose pas de questions techniques inutiles a l'utilisateur non-juriste.

## Lot 5 - Bundle `.mcpb` optionnel

Objectif : installation en un clic Claude Desktop.

Taches :

- preparer `manifest.json` ;
- packager serveur et base ;
- inclure dependances Node ;
- tester sur machine propre ;
- verifier installation/desinstallation ;
- documenter limites par rapport au plugin Claude Code/Cowork.

Critere de fin :

- le bundle s'installe dans Claude Desktop ;
- le serveur demarre localement ;
- les tools MCP sont visibles et utilisables.

## Lot 6 - Mise a jour et maintenance

Objectif : rendre le projet durable.

Taches :

- script de regeneration des donnees ;
- changelog des corpus ;
- tests de non-regression ;
- documentation de debug ;
- checklist release.

Critere de fin :

- un nouveau CSV/XLSX/PDF peut etre remplace et re-ingere sans modifier le code.

## Lot 7 - Integrations EUIPO optionnelles

Objectif : completer le MCP local avec les APIs officielles EUIPO si une souscription developpeur est disponible.

APIs a evaluer :

- Goods And Services : `https://dev.euipo.europa.eu/product/goods-and-services_110`
- Trademark search : `https://dev.euipo.europa.eu/product/trademark-search_100`

Taches :

- verifier les conditions d'utilisation et d'authentification du portail EUIPO ;
- ajouter une configuration optionnelle des credentials ;
- implementer `euipo_goods_services_search` pour recherche/validation/traduction TMClass ;
- implementer `euipo_trademark_search` pour recherche complementaire EUIPO ;
- ajouter un mode degrade clair quand l'API n'est pas configuree ;
- documenter que ces outils completent les sources suisses mais ne les remplacent pas.

Critere de fin :

- le plugin fonctionne integralement sans credentials EUIPO ;
- si les credentials sont presents, Claude peut utiliser les APIs EUIPO comme sources supplementaires citees.
