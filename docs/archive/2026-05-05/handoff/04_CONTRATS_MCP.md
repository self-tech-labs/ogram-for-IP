# Contrats MCP

Ce document decrit les outils et ressources a exposer. Les noms peuvent etre ajustes par le developpeur, mais les contrats fonctionnels doivent rester stables.

## Conventions globales

### Pagination

Tous les outils de recherche acceptent :

```json
{
  "limit": 10,
  "offset": 0
}
```

Valeurs recommandees :

- `limit` par defaut : 10 ;
- `limit` maximum : 50 ;
- les resultats contiennent `has_more`.

### Citations

Chaque resultat doit exposer une source :

```json
{
  "source_file": "Classification Nice/wdl_toutes_classes_FR.csv",
  "source_date": "2026-05-05",
  "source_ref": "classe=35;page=123;ligne=12"
}
```

### Normalisation

Tous les outils doivent accepter les accents, la casse et les espaces multiples. Les sorties doivent conserver les accents et la ponctuation source.

## Tool : `nice_get_headings`

Recupere les intitules generaux Nice.

Entree :

```json
{
  "classes": [35, 41, 45]
}
```

Sortie :

```json
{
  "headings": [
    {
      "class_number": 35,
      "heading": "Publicite; gestion, organisation et administration des affaires commerciales; travaux de bureau.",
      "source_file": "Classification Nice/Intitulés généraux.docx"
    }
  ]
}
```

Regles :

- si `classes` est absent, retourner les 45 classes ;
- refuser les numeros hors 1-45.

## Tool : `wdl_search_terms`

Recherche des termes WDL par texte et/ou classe.

Entree :

```json
{
  "query": "vente au detail vins",
  "classes": [35],
  "source": null,
  "limit": 10,
  "offset": 0
}
```

Sortie :

```json
{
  "results": [
    {
      "term_id": "wdl:35:12345",
      "class_number": 35,
      "term": "services de vente au detail de vins",
      "admissible": "",
      "comment": "",
      "source": "OMPI",
      "score": 12.4,
      "source_ref": "page=12;ligne=48"
    }
  ],
  "has_more": false
}
```

Regles :

- recherche FTS avec fallback `LIKE` ;
- si la requete est vide et classe fournie, retourner les termes les plus frequents ou premiers termes par classe ;
- ne jamais reformuler silencieusement un terme dans la sortie.

## Tool : `wdl_validate_terms`

Verifie si des libelles proposes existent dans la WDL ou sont proches.

Entree :

```json
{
  "items": [
    {
      "class_number": 43,
      "term": "services de traiteurs pour entreprises"
    }
  ],
  "fuzzy": true
}
```

Sortie :

```json
{
  "items": [
    {
      "class_number": 43,
      "term": "services de traiteurs pour entreprises",
      "status": "derived_or_close",
      "exact_match": null,
      "closest_matches": [
        {
          "term": "services de traiteurs",
          "class_number": 43,
          "score": 0.86
        }
      ],
      "comment": "Le libelle semble etre une limitation sectorielle d'un terme WDL."
    }
  ]
}
```

Statuts autorises :

- `exact`
- `derived_or_close`
- `not_found`
- `wrong_class`

## Tool : `swissreg_search_examples`

Recherche des libelles professionnels dans le corpus Swissreg.

Entree :

```json
{
  "query": "software gestion donnees",
  "classes": [9, 42],
  "limit": 10,
  "offset": 0
}
```

Sortie :

```json
{
  "results": [
    {
      "mark_id": "229141993",
      "urn": "urn:ige:schutztitel:chmarke:229141993",
      "title": "APPLIED MATERIALS",
      "trademark_number": "420918",
      "application_number": "12914/1993",
      "status": "AKTIV",
      "stage": "EINGETRAGEN",
      "class_number": 9,
      "goods_services": "Extrait court du libelle...",
      "language_hint": "de",
      "score": 9.8,
      "source_date": "2026-05-05"
    }
  ],
  "has_more": true
}
```

Regles :

- concatener `goods_services_part_1` et `goods_services_part_2` ;
- tronquer les extraits longs, avec possibilite de recuperer le detail via `swissreg_mark_detail` ;
- exclure la feuille `A reprendre` des resultats valides.
- ne pas accepter `mandataire_groups` comme filtre de resultats : la source ne contient pas de mapping mandataire ligne par ligne. Utiliser `swissreg_mandataire_metadata` pour exposer les facettes disponibles.

## Tool : `swissreg_mandataire_metadata`

Expose les facettes mandataires disponibles dans la feuille `Valeurs filtre`, sans pretendre filtrer les libelles ligne par ligne.

## Tool : `swissreg_class_combinations`

Identifie les combinaisons de classes frequentes pour des marques proches ou un secteur.

Entree :

```json
{
  "query": "vin degustation e-commerce",
  "classes_hint": [33, 35, 41],
  "limit": 10
}
```

Sortie :

```json
{
  "combinations": [
    {
      "classes": [33, 35, 41],
      "mark_count": 18,
      "example_titles": ["EXEMPLE 1", "EXEMPLE 2"],
      "representative_terms": {
        "33": ["vins", "boissons alcoolisees"],
        "35": ["vente au detail de vins"],
        "41": ["organisation de degustations"]
      }
    }
  ]
}
```

Regles :

- regrouper par marque et non par ligne ;
- permettre une recherche par termes de libelles ;
- indiquer que le corpus est partiel.

## Tool : `swissreg_mark_detail`

Recupere tous les libelles disponibles pour une marque.

Entree :

```json
{
  "urn": "urn:ige:schutztitel:chmarke:229141993"
}
```

Sortie :

```json
{
  "mark": {
    "urn": "urn:ige:schutztitel:chmarke:229141993",
    "title": "APPLIED MATERIALS",
    "trademark_number": "420918",
    "application_number": "12914/1993",
    "status": "AKTIV",
    "stage": "EINGETRAGEN",
    "classes": [
      {
        "class_number": 7,
        "goods_services": "..."
      }
    ]
  }
}
```

## Tool : `taf_search_precedents`

Recherche des precedents TAF dans le PDF segmente.

Entree :

```json
{
  "query": "capsule medicament forme usuelle couleur",
  "articles": ["Art. 2 let. a LPM"],
  "classes": [5],
  "outcomes": ["ref", "mix"],
  "limit": 5,
  "offset": 0
}
```

Sortie :

```json
{
  "results": [
    {
      "entry_id": "taf:report_2026-05-05:0001",
      "title": "N° de demande CH 57945/2013 / marque figurative",
      "sign_type": "marque figurative",
      "articles": ["Art. 2 let. a LPM"],
      "classes": [
        {
          "class_number": 5,
          "outcome": "ref"
        }
      ],
      "taf_refs": ["TAF B-3601/2014"],
      "summary": "Le signe consiste en la representation d'une capsule de medicament d'une forme usuelle...",
      "page_start": 1,
      "score": 15.2
    }
  ],
  "has_more": false
}
```

Regles :

- les extraits doivent rester courts ;
- conserver les references TAF exactes ;
- permettre filtrage par article et issue ;
- si aucune entree structuree n'est disponible, retourner des chunks avec avertissement.

## Tool : `taf_get_entry`

Recupere une entree TAF complete ou semi-complete.

Entree :

```json
{
  "entry_id": "taf:report_2026-05-05:0001"
}
```

Sortie :

```json
{
  "entry": {
    "entry_id": "taf:report_2026-05-05:0001",
    "title": "N° de demande CH 57945/2013 / marque figurative",
    "text": "Texte nettoye de l'entree...",
    "articles": ["Art. 2 let. a LPM"],
    "classes": [{"class_number": 5, "outcome": "ref"}],
    "taf_refs": ["TAF B-3601/2014"],
    "page_start": 1,
    "page_end": 1,
    "source_file": "Jurisprudence TAF/report_2026-05-05.pdf"
  }
}
```

## Tool : `corpus_stats`

Expose les statistiques utiles pour debug et audit.

Entree :

```json
{}
```

Sortie :

```json
{
  "generated_at": "2026-05-05",
  "sources": [
    {
      "name": "WDL",
      "rows": 41539,
      "classes": 45
    },
    {
      "name": "Swissreg Produits-services",
      "rows": 75155,
      "unique_titles": 22445
    }
  ]
}
```

## Tools optionnels EUIPO

Ces tools ne sont pas requis pour la v1 offline. Ils sont a envisager si le developpeur ajoute une integration authentifiee au portail EUIPO.

### Tool optionnel : `euipo_goods_services_search`

Usage : rechercher des termes TMClass via l'API EUIPO Goods And Services.

API source : `https://dev.euipo.europa.eu/product/goods-and-services_110`

Entree :

```json
{
  "query": "vente au detail de vins",
  "language": "fr",
  "classes": [35],
  "include_term_variants": true,
  "limit": 10
}
```

Sortie :

```json
{
  "results": [
    {
      "class_number": 35,
      "term": "services de vente au detail de vins",
      "language": "fr",
      "source": "EUIPO Goods And Services / TMClass",
      "source_url": "https://dev.euipo.europa.eu/product/goods-and-services_110"
    }
  ],
  "api_status": "online"
}
```

Regles :

- l'outil doit etre desactive si aucune souscription/API key EUIPO n'est configuree ;
- les resultats EUIPO ne remplacent pas la WDL suisse : ils servent de complement ou de validation croisee ;
- toujours indiquer la source EUIPO et la date de consultation.

### Tool optionnel : `euipo_trademark_search`

Usage : rechercher des marques dans la base EUIPO comme signal complementaire d'anteriorite.

API source : `https://dev.euipo.europa.eu/product/trademark-search_100`

Entree :

```json
{
  "query": "ALFAVIN",
  "classes": [33, 35, 41],
  "include_media": false,
  "limit": 10
}
```

Sortie :

```json
{
  "results": [
    {
      "application_number": "018000000",
      "title": "ALFAVIN",
      "status": "registered",
      "classes": [33, 35],
      "source": "EUIPO Trademark search",
      "source_url": "https://dev.euipo.europa.eu/product/trademark-search_100"
    }
  ],
  "api_status": "online",
  "warning": "Recherche EUIPO complementaire uniquement; ne remplace pas Swissreg, Madrid Monitor, TMview ou une recherche suisse complete."
}
```

Regles :

- ne pas activer par defaut en mode offline ;
- ne pas presenter comme recherche d'anteriorite suisse exhaustive ;
- utile pour detecter des marques UE proches, recuperer details/media via application number, et enrichir une analyse de risque commerciale.

## Resources

### `nice://headings`

Retourne les 45 chapeaux Nice.

### `nice://heading/{class_number}`

Retourne le chapeau d'une classe.

### `corpus://stats`

Retourne les statistiques et dates des corpus.

### `source://manifest`

Retourne le manifeste des sources : nom, fichier, hash, date d'ingestion, lignes extraites.

## Prompts MCP optionnels

Les prompts MCP sont utiles si le developpeur veut exposer des slash commands via MCP, mais le plugin Claude peut aussi porter ces commandes directement.

Prompts recommandes :

- `prepare_trademark_deposit(activity, sign, audience)`
- `analyze_absolute_grounds(sign, goods_services_context)`
- `draft_nice_goods_services(activity, classes)`
- `prepare_manual_prior_rights_search(sign, classes, sign_type)`
