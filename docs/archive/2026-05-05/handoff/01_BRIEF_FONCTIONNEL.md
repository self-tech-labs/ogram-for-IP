# Brief fonctionnel

## Produit

`swiss-trademark-deposit` est un assistant expert pour le depot de marques suisses aupres de l'IPI. Il doit combiner une posture de conseil accessible pour les entrepreneurs avec une profondeur juridique exploitable par des avocats, mandataires et juristes.

Le skill actuel contient deja la doctrine de workflow : qualification du public, analyse du signe, motifs absolus, recherche d'anteriorite, choix des classes, redaction des libelles et synthese finale.

Le developpement MCP doit transformer les annexes documentaires en bases interrogeables, pour que Claude ne depende plus uniquement du texte du skill.

## Utilisateurs cibles

### Entrepreneur / createur / PME

Objectif : obtenir rapidement une recommandation exploitable pour deposer une marque.

Attentes :

- peu de jargon ;
- questions limitees aux arbitrages business ;
- classes et libelles prepares en arriere-plan ;
- cout estime ;
- prochaines etapes claires.

### Praticien PI / avocat / mandataire

Objectif : obtenir une analyse juridiquement argumentee et sourcée.

Attentes :

- references LPM, OPM, directives IPI, jurisprudence TAF/TF ;
- exemples de pratique professionnelle Swissreg ;
- libelles granulaires, justifies et defensables ;
- reconnaissance explicite des incertitudes.

## Workflow cible

1. Comprendre l'activite du deposant.
2. Identifier le signe : verbal, figuratif, combine.
3. Evaluer les motifs absolus.
4. Consulter les precedents TAF si le signe est ambigu.
5. Evaluer la recherche d'anteriorite ou preparer la strategie manuelle.
6. Identifier les classes de Nice.
7. Consulter les combinaisons de classes observees dans le corpus Swissreg.
8. Rediger les libelles :
   - chapeau Nice officiel ;
   - declinaison WDL ;
   - calibration par exemples Swissreg ;
   - limitation finale si necessaire.
9. Livrer une synthese actionnable.

## Resultat attendu dans Claude

Claude doit pouvoir produire une sortie de ce type :

- signe recommande ;
- type de depot ;
- risques de refus IPI ;
- classes retenues avec explication ;
- libelles complets classe par classe ;
- precedents TAF pertinents si applicables ;
- strategie de recherche d'anteriorite ;
- cout et lien e-trademark ;
- liste des prochaines actions.

## Contraintes metier

- Perimetre Suisse uniquement.
- Pas d'extension Madrid dans la premiere version.
- Ne jamais inventer un libelle : utiliser WDL, chapeaux Nice ou exemples professionnels.
- Toujours distinguer motifs absolus et motifs relatifs.
- L'IPI ne verifie pas les motifs relatifs au depot : le risque d'opposition reste a signaler.
- Toujours indiquer la date des corpus utilises.
- Pour les tarifs IPI, Claude doit recommander une verification a la source officielle au moment du depot.

## Posture juridique

Le plugin doit etre formule comme une aide a la preparation et a l'analyse. Il ne doit pas promettre l'enregistrement, l'absence d'opposition, ni remplacer une consultation juridique lorsqu'un enjeu important existe.

Formule recommandee dans les livrables : "Analyse preparatoire sur la base des corpus disponibles ; a verifier au moment du depot et, en cas d'enjeu commercial significatif, avec un conseil specialise."
