# Pipeline donnees

## Objectif

Transformer les annexes heterogenes en une base locale interrogeable par le serveur MCP, avec des resultats courts, cites et reproductibles.

## Sortie attendue du pipeline

```text
servers/swiss-trademark-mcp/data/
  trademark.sqlite
  source-manifest.json
```

`source-manifest.json` doit contenir :

- chemin source ;
- date d'export source si connue ;
- date d'ingestion ;
- hash SHA-256 ;
- nombre de lignes / entrees extraites ;
- avertissements.

## Etape 1 - Ingestion WDL CSV

Source : `Classification Nice/wdl_toutes_classes_FR.csv`

Traitement :

1. Lire en UTF-8 avec separateur `;`.
2. Valider que les colonnes attendues existent.
3. Normaliser `classe` en entier 1-45.
4. Conserver le texte original du `terme`.
5. Ajouter une colonne normalisee pour recherche : minuscules, accents retires, espaces compresses.
6. Creer index FTS.

Schema cible :

```sql
CREATE TABLE wdl_terms (
  id TEXT PRIMARY KEY,
  class_number INTEGER NOT NULL,
  term TEXT NOT NULL,
  admissible TEXT,
  comment TEXT,
  source TEXT,
  privileged TEXT,
  page INTEGER,
  line_page INTEGER,
  normalized_term TEXT NOT NULL
);
```

Controle qualite :

- total attendu : 41 541 lignes ;
- 45 classes ;
- aucune classe hors 1-45.

## Etape 2 - Ingestion chapeaux Nice

Source : `Classification Nice/Intitulés généraux.docx`

Traitement :

1. Lire le tableau DOCX.
2. Extraire numero de classe et intitule.
3. Nettoyer les espaces inseccables et retours ligne.
4. Stocker dans `nice_headings`.

Schema cible :

```sql
CREATE TABLE nice_headings (
  class_number INTEGER PRIMARY KEY,
  heading TEXT NOT NULL,
  source_file TEXT NOT NULL
);
```

Controle qualite :

- exactement 45 lignes ;
- classes 1 a 45 presentes une seule fois.

## Etape 3 - Ingestion Swissreg

Source : `Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx`

Traitement :

1. Lire la feuille `Produits-services`.
2. Concatener `goods_services_part_1` et `goods_services_part_2`.
3. Creer une table `swissreg_marks` dedupliquee par `urn`.
4. Creer une table `swissreg_goods_services` par ligne classe/libelle.
5. Indexer le champ `goods_services`.
6. Lire `Valeurs filtre` comme table de metadata mandataires.
7. Lire `Resume` pour conserver la date d'export.
8. Lire `A reprendre` uniquement pour statistiques d'erreur, pas pour la recherche.

Schemas cibles :

```sql
CREATE TABLE swissreg_marks (
  urn TEXT PRIMARY KEY,
  internal_id TEXT,
  trademark_number TEXT,
  application_number TEXT,
  title TEXT,
  status TEXT,
  stage TEXT
);

CREATE TABLE swissreg_goods_services (
  id TEXT PRIMARY KEY,
  urn TEXT NOT NULL,
  class_number INTEGER NOT NULL,
  goods_services TEXT NOT NULL,
  language_hint TEXT,
  source_date TEXT,
  FOREIGN KEY (urn) REFERENCES swissreg_marks(urn)
);

CREATE TABLE swissreg_filter_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mandataire_group TEXT,
  query TEXT,
  facet_value TEXT,
  result_count INTEGER
);
```

Controle qualite :

- lignes valides attendues : 75 155 ;
- feuille `A reprendre` attendue : 30 093 erreurs reseau ;
- `goods_services` jamais vide dans la table valide ;
- date d'export : 2026-05-05.

## Etape 4 - Ingestion Liste classes

Source : `Exemples marques/Liste classes.xlsx`

Traitement :

1. Lire toutes les cellules non vides.
2. Extraire un numero de classe en debut de cellule.
3. Stocker le texte integral comme exemple.
4. Indexer par classe et FTS.

Schema cible :

```sql
CREATE TABLE class_examples (
  id TEXT PRIMARY KEY,
  class_number INTEGER NOT NULL,
  example_text TEXT NOT NULL,
  source_cell TEXT,
  source_file TEXT NOT NULL
);
```

Controle qualite :

- environ 1 346 exemples non vides ;
- toutes les classes 1-45 devraient etre representees ;
- les cellules sans numero detecte doivent aller dans un rapport d'avertissement.

## Etape 5 - Ingestion TAF PDF

Source : `Jurisprudence TAF/report_2026-05-05.pdf`

Traitement recommande :

1. Extraire le texte page par page.
2. Segmenter les entrees a partir des motifs :
   - `N° de demande`
   - `N° de registre`
   - `N° d'enregistrement`
3. Pour chaque entree, extraire :
   - titre ;
   - type de marque ;
   - articles mentionnes ;
   - classes concernees ;
   - issue par classe : `acc`, `ref`, `mix` ;
   - references TAF ;
   - page de debut et page de fin ;
   - texte complet nettoye.
4. Indexer le texte en FTS.

Schema cible :

```sql
CREATE TABLE taf_entries (
  entry_id TEXT PRIMARY KEY,
  title TEXT,
  sign_type TEXT,
  text TEXT NOT NULL,
  articles_json TEXT,
  classes_json TEXT,
  taf_refs_json TEXT,
  page_start INTEGER,
  page_end INTEGER,
  source_file TEXT NOT NULL,
  source_date TEXT
);
```

Controle qualite :

- pages attendues : 78 ;
- entrees attendues : environ 549 ;
- au moins les articles principaux doivent etre detectes ;
- les references TAF `B-xxxx/yyyy` doivent etre conservees telles quelles.

## Etape 6 - Indexation

Creer des index FTS separes :

- `wdl_terms_fts(term, normalized_term)`
- `swissreg_goods_fts(goods_services)`
- `class_examples_fts(example_text)`
- `taf_entries_fts(title, text)`

Ajouter une recherche normalisee cote application :

- requete brute ;
- requete sans accents ;
- tokenisation simple ;
- fallback sur termes individuels si la phrase ne retourne rien.

## Etape 7 - Tests d'ingestion

Tests minimaux :

- `nice_get_headings([43])` retourne la classe restauration/hebergement.
- `wdl_search_terms("traiteurs", [43])` retourne au moins un resultat proche.
- `swissreg_search_examples("Halbleiter", [9])` retourne des exemples du corpus.
- `taf_search_precedents("capsule médicament", ["Art. 2 let. a LPM"], [5])` retourne l'entree CH 57945/2013 ou proche.
- `corpus_stats` retourne les volumes attendus.

## Mise a jour des donnees

V1 :

- mise a jour manuelle par remplacement des fichiers annexes ;
- script `npm run ingest` ;
- generation d'un nouveau `trademark.sqlite`.

V2 :

- connecteurs de collecte semi-automatiques ;
- reprise des 30 093 erreurs Swissreg ;
- detection de nouveaux exports WDL / Nice ;
- journal des differences entre corpus.
