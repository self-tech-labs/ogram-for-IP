# Tests et recette

## Tests d'ingestion

### WDL

- le CSV charge 41 541 lignes ;
- les classes 1 a 45 sont presentes ;
- `wdl_search_terms("vins", [33])` retourne des termes en classe 33 ou des resultats proches ;
- `wdl_validate_terms` distingue `exact`, `derived_or_close`, `not_found`.

### Chapeaux Nice

- 45 chapeaux charges ;
- classe 35 contient publicite / gestion / administration / travaux de bureau ;
- classe 43 contient restauration / hebergement temporaire.

### Swissreg

- la feuille valide charge 75 155 lignes ;
- les libelles ne sont pas vides ;
- les marques sont dedupliquees par `urn` ;
- la feuille `A reprendre` est exclue de la recherche ;
- `swissreg_search_examples("Halbleiter", [9])` retourne des resultats du corpus.

### TAF

- 78 pages extraites ;
- environ 549 entrees segmentees ;
- `taf_search_precedents("capsule médicament", ["Art. 2 let. a LPM"], [5])` retourne un precedent proche ;
- les references `B-xxxx/yyyy` sont conservees.

## Tests MCP

Pour chaque tool :

- entree valide ;
- entree vide ou minimale ;
- mauvais numero de classe ;
- limite de pagination ;
- sortie courte ;
- source presente ;
- erreur lisible.

Tests specifiques :

- `nice_get_headings([999])` doit refuser proprement ;
- `wdl_search_terms` sans resultat doit proposer un message neutre, pas inventer ;
- `swissreg_class_combinations` doit compter par marque, pas par ligne ;
- `taf_get_entry` doit refuser un `entry_id` inexistant.

## Tests Claude - grand public

### Cas 1 : entrepreneur restauration

Prompt :

```text
Je veux deposer la marque Mosaic Cuisine pour un projet de traiteur et ateliers culinaires en Suisse.
```

Attendu :

- Claude demande l'activite seulement si elle manque ;
- distingue classe 43 restauration/traiteur et classe 41 ateliers ;
- ne propose pas 29/30 sauf gamme conditionnee separee ;
- formule les questions en activites, pas en numeros de classes.

### Cas 2 : e-commerce vinicole

Prompt :

```text
Je vends du vin en ligne sous la marque Alfavin, avec des degustations et contenus editoriaux.
```

Attendu :

- classes 33, 35, 41 ;
- chapeau Nice en tete ;
- classe 35 couvre vente en ligne ;
- classe 41 couvre degustations / formation / contenu.

### Cas 3 : verbal faible

Prompt :

```text
Je veux deposer Fresh Bakery pour une boulangerie.
```

Attendu :

- risque de refus distinctivite signale ;
- proposition de marque combinee ou signe plus distinctif ;
- pas de promesse que le verbal passera.

## Tests Claude - praticien

### Cas 4 : analyse motifs absolus

Prompt :

```text
Analyse art. 2 let. a LPM pour une marque tridimensionnelle consistant en la forme usuelle d'un dispositif medical en classe 10.
```

Attendu :

- registre praticien ;
- consultation TAF ;
- references aux motifs absolus ;
- distinction forme usuelle / necessite technique / couleur ;
- conclusion nuancee.

### Cas 5 : libelles Nice

Prompt :

```text
Redige les libelles pour un cabinet d'avocats suisse actif en droit des affaires, droit du travail, PI, mediation et formation.
```

Attendu :

- classes 35, 41, 45 ;
- chapeau ou libelles larges pertinents ;
- granularite suffisante ;
- limitation finale si necessaire ;
- verification WDL/Swissreg.

## Tests de non-hallucination

Le plugin echoue si :

- Claude invente des libelles sans consultation WDL/Swissreg ;
- Claude cite un precedent TAF sans source MCP ;
- Claude presente Swissreg comme une recherche d'anteriorite complete alors que le corpus est partiel ;
- Claude oublie que l'IPI ne verifie pas les motifs relatifs ;
- Claude recommande une classe 39 pour simple livraison e-commerce sans activite logistique tierce ;
- Claude pose a un entrepreneur des questions sous forme de numeros de classes.

## Tests distribution

### Plugin Claude Code / Cowork

- `plugin.json` JSON valide ;
- `.mcp.json` utilise `${CLAUDE_PLUGIN_ROOT}` ;
- pas de chemins absolus ;
- skill charge ;
- commandes visibles ;
- serveur MCP demarre.

### `.mcpb`

- `manifest.json` valide ;
- base SQLite incluse ;
- dependances incluses ;
- installation sur machine propre ;
- demarrage sans reseau ;
- desinstallation propre.

## Tests EUIPO optionnels

Ces tests ne s'appliquent que si les credentials EUIPO sont configures.

### Goods And Services

- `euipo_goods_services_search("vente au detail de vins", [35])` retourne des resultats ou une erreur API documentee ;
- le tool indique clairement la source EUIPO/TMClass ;
- Claude ne remplace pas automatiquement la WDL suisse par EUIPO.

### Trademark search

- `euipo_trademark_search("ALFAVIN", [33, 35, 41])` retourne des resultats ou une absence de resultats documentee ;
- les resultats EUIPO sont presentes comme recherche complementaire ;
- Claude continue a recommander Swissreg, Madrid Monitor, TMview et Zefix pour une recherche d'anteriorite suisse.

### Mode sans credentials

- le plugin doit fonctionner sans reseau et sans credentials EUIPO ;
- les tools EUIPO doivent retourner une erreur lisible de type "integration non configuree" ;
- aucun workflow principal ne doit bloquer a cause de l'absence d'EUIPO.

## Critere d'acceptation final

Le developpement est accepte si un utilisateur peut partir d'une description d'activite et obtenir, dans Claude, une proposition de depot suisse avec :

- classes recommandees ;
- libelles complets ;
- sources Nice/WDL/Swissreg ;
- precedents TAF si pertinents ;
- strategie d'anteriorite ;
- cout estime ;
- prochaines etapes.
