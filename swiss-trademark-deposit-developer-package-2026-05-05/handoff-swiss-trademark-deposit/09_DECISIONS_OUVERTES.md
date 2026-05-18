# Decisions ouvertes

## 1. Cible exacte du "plugin Claude"

Question : faut-il livrer prioritairement :

- un plugin Claude Code / Cowork ;
- un bundle Claude Desktop `.mcpb` ;
- les deux ?

Recommandation : commencer par Claude Code / Cowork, puis packager le serveur MCP en `.mcpb`.

## 2. Licence et redistribution des donnees

Question : les corpus WDL, Nice, Swissreg et TAF peuvent-ils etre redistribues dans un plugin/bundle ?

Points a verifier :

- conditions d'utilisation IPI ;
- conditions Swissreg ;
- conditions OMPI/WIPO pour Nice/WDL si applicable ;
- statut de la jurisprudence TAF ;
- usage prive vs distribution publique.

Recommandation : en usage prive, conserver les fichiers localement. Pour distribution publique, verifier les licences avant d'embarquer les donnees.

## 3. Corpus Swissreg partiel

Question : faut-il completer les 30 093 lignes `A reprendre` ?

Recommandation : oui avant une version publique ou professionnelle ; non bloquant pour un prototype si les limites sont affichees.

## 4. Langues

Question : le plugin doit-il rechercher efficacement en francais seulement, ou aussi en allemand/italien/anglais ?

Observation : le corpus Swissreg contient beaucoup de libelles allemands.

Recommandation v1 :

- interface et skill en francais ;
- recherche corpus multilingue par texte brut ;
- ajouter synonymes FR/DE/EN en v2.

## 5. Niveau de jurisprudence

Question : le PDF TAF suffit-il, ou faut-il connecter une source jurisprudentielle plus complete ?

Recommandation v1 :

- utiliser le PDF segmente ;
- signaler sa date et son perimetre ;
- prevoir une ingestion future de decisions individuelles si disponible.

## 6. Embeddings

Question : faut-il ajouter une recherche semantique ?

Recommandation v1 :

- non indispensable ;
- commencer par SQLite FTS ;
- ajouter embeddings v2 pour precedents TAF "structurellement comparables".

## 7. Mise a jour des tarifs IPI

Question : le serveur doit-il aller chercher les tarifs en ligne ?

Recommandation v1 :

- non, eviter le reseau ;
- stocker les tarifs observes dans le skill ;
- toujours demander verification a la source officielle au moment du depot.

## 8. Responsabilite juridique

Question : quel disclaimer exact utiliser ?

Proposition :

> Ce plugin fournit une aide a la preparation d'un depot de marque suisse sur la base des informations fournies et des corpus disponibles. Il ne garantit ni l'enregistrement par l'IPI, ni l'absence d'opposition, et ne remplace pas une consultation juridique pour les dossiers a enjeu.

## 9. Nommage des tools

Question : noms courts ou prefixe domaine ?

Recommandation :

- dans le serveur : `nice_get_headings`, `wdl_search_terms`, etc. ;
- le client Claude prefixera deja les noms MCP avec plugin/server ;
- eviter des noms trop longs.

## 10. Refactoring du skill

Question : faut-il livrer le skill actuel tel quel ?

Recommandation : non. Le contenu est excellent mais doit etre restructure :

- `SKILL.md` plus court ;
- references separees ;
- exemples conserves mais eventuellement deplaces ;
- liens MCP explicites ;
- suppression des references a fichiers absents ou creation de ces fichiers.

## 11. APIs EUIPO

Question : faut-il connecter les APIs EUIPO dans la v1 ?

APIs disponibles :

- Goods And Services : `https://dev.euipo.europa.eu/product/goods-and-services_110`
- Trademark search : `https://dev.euipo.europa.eu/product/trademark-search_100`

Recommandation :

- ne pas en faire une dependance v1, car le plugin doit fonctionner offline avec les corpus suisses ;
- prevoir une integration optionnelle v2 si une souscription/API key EUIPO est disponible ;
- utiliser Goods And Services pour validation/traduction TMClass et Trademark search pour signal complementaire d'anteriorite UE ;
- ne jamais presenter EUIPO comme substitut a Swissreg ou a une recherche suisse complete.
