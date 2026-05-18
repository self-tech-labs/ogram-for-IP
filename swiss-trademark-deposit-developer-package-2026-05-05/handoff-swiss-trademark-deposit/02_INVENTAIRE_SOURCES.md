# Inventaire des sources

## Synthese

Les annexes actuelles couvrent les quatre corpus que le skill veut mobiliser via MCP :

| Corpus | Fichier | Usage MCP |
|---|---|---|
| Skill principal | `Skill/swiss-trademark-deposit.skill` | Instructions Claude, workflow, posture, exemples |
| WDL IPI | `Classification Nice/wdl_toutes_classes_FR.csv` | Recherche de termes pre-valides par classe |
| Chapeaux Nice | `Classification Nice/Intitulés généraux.docx` | Intitules generaux officiels des 45 classes |
| Swissreg professionnel | `Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx` | Exemples de libelles et combinaisons de classes |
| Listes-types | `Exemples marques/Liste classes.xlsx` | Exemples de listes par classe |
| Jurisprudence TAF | `Jurisprudence TAF/report_2026-05-05.pdf` | Precedents de refus/acceptation IPI/TAF |

## Skill

Fichier : `Skill/swiss-trademark-deposit.skill`

Etat observe :

- archive zip contenant `swiss-trademark-deposit/SKILL.md` ;
- 576 lignes ;
- un seul fichier dans l'archive ;
- le `SKILL.md` mentionne quatre fichiers `references/` qui ne sont pas inclus dans l'archive actuelle :
  - `references/motifs-absolus.md`
  - `references/classification-nice.md`
  - `references/procedure-depot.md`
  - `references/recherche-anteriorite.md`

Decision recommandee :

- soit recreer ces fichiers references a partir du contenu long du skill ;
- soit retirer les references absentes ;
- idealement, restructurer le skill pour garder le workflow dans `SKILL.md` et deplacer la doctrine longue dans `references/`.

## WDL IPI

Fichier : `Classification Nice/wdl_toutes_classes_FR.csv`

Etat observe :

- encodage UTF-8 ;
- separateur `;` ;
- 41 541 lignes de donnees ;
- 45 classes couvertes ;
- colonnes :
  - `classe`
  - `admissible`
  - `terme`
  - `commentaire`
  - `source`
  - `privilegie`
  - `page`
  - `ligne_page`

Usage MCP :

- recherche plein texte de termes par classe ;
- verification qu'un libelle propose existe dans la WDL ;
- suggestion de termes proches ;
- citation source avec classe, page et ligne si disponible.

Points d'attention :

- `privilegie` semble vide dans l'export actuel ;
- `admissible` et `commentaire` doivent etre conserves meme s'ils sont souvent vides ;
- l'index doit gerer les accents, le pluriel et les variantes simples.

## Intitules generaux Nice

Fichier : `Classification Nice/Intitulés généraux.docx`

Etat observe :

- document Word avec un tableau ;
- 45 lignes exploitables ;
- chaque ligne contient le numero de classe et le chapeau officiel ;
- exemple : classe 43 = "Services de restauration (alimentation); hebergement temporaire."

Usage MCP :

- recuperer le chapeau officiel en tete de chaque classe retenue ;
- lister les 45 classes ;
- fournir une base stable pour la redaction des libelles.

Point d'attention :

- le DOCX doit etre transforme en donnees structurees au build, par exemple table `nice_headings`.

## Swissreg mandataires / produits-services

Fichier : `Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx`

Etat observe :

- feuille `Produits-services` : 75 155 lignes valides, 11 colonnes ;
- environ 22 445 titres de marques uniques dans la feuille valide ;
- statut observe : `AKTIV` ;
- stages observes : surtout `EINGETRAGEN`, puis `GESUCH` ;
- feuille `A reprendre` : 30 093 lignes avec erreurs reseau ;
- feuille `Valeurs filtre` : 559 lignes de facettes mandataires ;
- feuille `Resume` : resume d'export du 2026-05-05.

Colonnes principales de `Produits-services` :

- `internal_id`
- `urn`
- `trademark_number`
- `application_number`
- `title`
- `status`
- `stage`
- `nice_class`
- `goods_services_part_1`
- `goods_services_part_2`
- `error`

Top classes par volume observe :

- 9, 35, 42, 41, 16, 5, 36, 25, 30, 3, 38, 28, 37, 39, 29.

Usage MCP :

- rechercher des libelles proches dans des depots professionnels ;
- identifier les combinaisons de classes recurrentes ;
- calibrer la granularite par secteur ;
- fournir des exemples avec marque, numero, classe et extrait.

Points d'attention :

- corpus partiel ;
- donnees multilingues, avec beaucoup d'allemand ;
- les lignes `A reprendre` ne doivent pas etre exposees comme corpus valide ;
- il faut conserver la date d'export dans les resultats.

## Liste classes

Fichier : `Exemples marques/Liste classes.xlsx`

Etat observe :

- une feuille `Feuil1` ;
- 1 346 cellules non vides ;
- les exemples contiennent generalement un numero de classe suivi d'une liste de produits/services ;
- les classes 35, 9, 42, 41 et 36 sont tres representees.

Usage MCP :

- corpus secondaire d'exemples par classe ;
- utile pour generer des listes-types ou detecter des formulations recurrentes.

Point d'attention :

- structure moins normalisee que le fichier Swissreg ;
- extraction par expression reguliere du numero de classe en debut de cellule.

## Jurisprudence TAF

Fichier : `Jurisprudence TAF/report_2026-05-05.pdf`

Etat observe :

- PDF de 78 pages ;
- liste de 549 resultats ;
- environ 355 000 caracteres extraits ;
- 549 occurrences "Classes concernees" ;
- environ 73 references TAF de type `B-xxxx/yyyy` ;
- articles les plus frequents :
  - art. 2 let. a LPM ;
  - art. 10 OPM ;
  - art. 2 let. d LPM ;
  - art. 2 let. b LPM ;
  - art. 2 let. c LPM.

Usage MCP :

- recherche de precedents par terme, article, type de marque, classe, issue ;
- recuperation d'un cas par reference ;
- fournir des extraits courts et cites ;
- calibrer les analyses de distinctivite.

Points d'attention :

- le PDF doit etre segmente en entrees individuelles ;
- chaque entree doit conserver page source, numero de demande/registre, type de marque, articles, classes, issue et reference TAF si presente ;
- les resultats MCP doivent rester courts pour ne pas saturer le contexte Claude.
