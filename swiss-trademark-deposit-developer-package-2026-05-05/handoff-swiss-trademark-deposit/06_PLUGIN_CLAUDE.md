# Plugin Claude

## Deux formats a distinguer

### Plugin Claude Code / Cowork

Format recommande pour la premiere livraison.

Structure :

```text
swiss-trademark-deposit/
  .claude-plugin/
    plugin.json
  .mcp.json
  README.md
  skills/
  commands/
  servers/
```

Ce format permet :

- skills invoques automatiquement ;
- slash commands ;
- MCP servers declares dans `.mcp.json` ;
- installation via marketplace ou dossier local.

### Bundle Claude Desktop `.mcpb`

Format optionnel pour installation en un clic dans Claude Desktop.

Structure :

```text
swiss-trademark-deposit-mcpb/
  manifest.json
  server/
    index.js
    data/trademark.sqlite
```

Ce format sert surtout a distribuer un serveur MCP local. Il ne remplace pas toujours le plugin complet avec commandes et skill selon le client cible.

## Structure plugin recommandee

```text
swiss-trademark-deposit/
  .claude-plugin/
    plugin.json
  .mcp.json
  README.md
  skills/
    swiss-trademark-deposit/
      SKILL.md
      references/
        motifs-absolus.md
        classification-nice.md
        procedure-depot.md
        recherche-anteriorite.md
  commands/
    depot-marque.md
    analyse-signe.md
    rediger-libelles.md
    recherche-anteriorite.md
  servers/
    swiss-trademark-mcp/
      package.json
      src/
      data/
        trademark.sqlite
```

## Manifest `.claude-plugin/plugin.json`

Exemple de base :

```json
{
  "name": "swiss-trademark-deposit",
  "description": "Assistance au depot de marques suisses aupres de l'IPI, avec classification Nice, WDL, corpus Swissreg et jurisprudence TAF.",
  "version": "0.1.0",
  "author": {
    "name": "Timothee Barghouth"
  },
  "license": "UNLICENSED",
  "keywords": ["swiss", "trademark", "marques", "IPI", "Nice", "MCP"]
}
```

Notes :

- `name` devient le namespace du plugin ;
- garder le nom exactement `swiss-trademark-deposit` ;
- choisir une licence avant distribution externe ;
- si le plugin reste prive, `UNLICENSED` est coherent.

## Configuration `.mcp.json`

Exemple pour serveur local embarque :

```json
{
  "mcpServers": {
    "swiss-trademark": {
      "command": "node",
      "args": [
        "${CLAUDE_PLUGIN_ROOT}/servers/swiss-trademark-mcp/dist/index.js"
      ],
      "env": {
        "SWISS_TRADEMARK_DB": "${CLAUDE_PLUGIN_ROOT}/servers/swiss-trademark-mcp/data/trademark.sqlite"
      }
    }
  }
}
```

Notes :

- utiliser `${CLAUDE_PLUGIN_ROOT}` pour tous les chemins ;
- ne pas utiliser de chemins absolus ;
- le serveur doit demarrer sans reseau.

## Skill

Le fichier actuel `SKILL.md` est riche mais long. Pour un plugin maintenable :

1. conserver dans `SKILL.md` :
   - detection du registre grand public / praticien ;
   - workflow A-G ;
   - regles d'or ;
   - discipline d'usage MCP ;
   - format de restitution ;
2. deplacer les longs developpements dans `references/` :
   - motifs absolus ;
   - classification Nice ;
   - procedure de depot ;
   - recherche d'anteriorite ;
3. supprimer ou corriger toute reference a des fichiers absents.

## Commands

Les commandes doivent etre simples et orientees usage.

### `commands/depot-marque.md`

Usage : lancer un dossier complet.

Contenu attendu :

```markdown
---
description: Preparateur complet de depot de marque suisse
allowed-tools:
  - "mcp__plugin_swiss-trademark-deposit_swiss-trademark__nice_get_headings"
  - "mcp__plugin_swiss-trademark-deposit_swiss-trademark__wdl_search_terms"
  - "mcp__plugin_swiss-trademark-deposit_swiss-trademark__swissreg_search_examples"
  - "mcp__plugin_swiss-trademark-deposit_swiss-trademark__taf_search_precedents"
---

Prepare un depot de marque suisse a partir des informations suivantes :

$ARGUMENTS

Suis le skill swiss-trademark-deposit. Si l'activite n'est pas claire, demande uniquement les informations indispensables. Sinon, produis une synthese actionnable avec classes, libelles, risques et prochaines etapes.
```

### `commands/analyse-signe.md`

Usage : analyser distinctivite, tromperie, signes officiels, provenance.

### `commands/rediger-libelles.md`

Usage : produire uniquement classes et libelles, en s'appuyant obligatoirement sur Nice + WDL + Swissreg.

### `commands/recherche-anteriorite.md`

Usage : preparer une strategie de recherche Swissreg / BrandDB / TMview / Zefix / Madrid Monitor.

## Variante `.mcpb`

Exemple minimal de `manifest.json` :

```json
{
  "mcpb_version": "0.1",
  "name": "swiss-trademark-deposit",
  "display_name": "Swiss Trademark Deposit",
  "version": "0.1.0",
  "description": "MCP local pour preparer des depots de marques suisses avec WDL, Nice, Swissreg et jurisprudence TAF.",
  "author": {
    "name": "Timothee Barghouth"
  },
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js"],
      "env": {
        "SWISS_TRADEMARK_DB": "${__dirname}/server/data/trademark.sqlite"
      }
    }
  }
}
```

## Distribution

Pour usage prive :

- depot Git prive ;
- installation locale via Claude Code `--plugin-dir` pendant le developpement ;
- marketplace prive si partage avec plusieurs utilisateurs.

Pour Claude Desktop :

- packager en `.mcpb` ;
- tester sur une machine propre ;
- verifier que Node et les dependances embarquees suffisent ;
- conserver la base locale dans le bundle.

## Documentation utilisateur a fournir dans le plugin

Le `README.md` du plugin final doit contenir :

- ce que fait le plugin ;
- limites juridiques ;
- corpus inclus et dates ;
- exemples de commandes ;
- comment mettre a jour les donnees ;
- comment debugger le MCP ;
- politique de confidentialite locale.
