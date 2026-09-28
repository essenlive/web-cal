# Générer un jeu de règles avec une IA

web-cal peut préparer un prompt, à coller dans n'importe quel assistant IA
(Claude, ChatGPT…), qui propose des types d'affichage et des règles adaptés à
tes calendriers. Tout se passe dans l'onglet **Règles IA** de la page **Mes données** (`/data`).

## Utilisation

1. **Exporter pour l'IA** : génère un texte contenant le prompt et tes données
   (sources, jusqu'à 20 titres d'événements distincts par source, types et
   règles actuels). Copie-le ou télécharge-le.
2. Colle-le dans ton assistant IA, réponds à ses questions (5 maximum).
3. **Importer le JSON de l'IA** : colle le bloc JSON final qu'il renvoie. Il est
   vérifié contre [`ai-rules-schema.json`](ai-rules-schema.json), puis fusionné
   avec tes réglages : les nouveaux types sont créés, les règles de texte
   ajoutées, et une règle de source met à jour la règle déjà existante de cette
   source. Rien n'est supprimé ni écrasé ; un type ou une règle identique à un
   existant est ignoré.

## Ce qui est exporté (et ce qui ne l'est pas)

Exporté : id, nom et couleur de chaque source ; titres d'événements avec le
moment (jour de la semaine et heure, ou "journée entière") ; types et règles
actuels.

Jamais exporté : les URL des calendriers (les liens ICS contiennent leurs propres
clés d'accès), identifiants et mots de passe CalDAV, lieux et notes des
événements.

## Format de sortie

Le JSON reprend l'enveloppe de l'export de réglages web-cal
(`src/lib/settings-export.ts`), limitée aux deux clés concernées :

```json
{
  "version": 1,
  "exportedAt": "2026-09-28T21:00:00.000Z",
  "data": {
    "overcal:event-types": { "version": 0, "state": { "types": [ … ] } },
    "overcal:rules": { "version": 0, "state": { "rules": [ … ] } }
  }
}
```

Le schéma complet (champs requis, styles autorisés, format des couleurs et des
ids) est dans [`ai-rules-schema.json`](ai-rules-schema.json). Le texte du prompt
lui-même vit dans `src/lib/ai-prompt.ts` (`AI_RULES_PROMPT`), c'est lui que le
bouton d'export utilise.
