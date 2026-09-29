# Générer ses réglages avec une IA

web-cal peut préparer un prompt, à coller dans n'importe quel assistant IA
(Claude, ChatGPT…), qui propose des types d'affichage, des règles, des presets
et des thèmes adaptés à tes calendriers. Tout se passe dans l'onglet
**Réglages IA** de la page **Mes données** (`/data`).

## Utilisation

1. **Exporter pour l'IA** : génère un texte contenant le prompt et tes données
   (sources, jusqu'à 20 titres d'événements distincts par source, types,
   règles, presets et thèmes actuels). Copie-le ou télécharge-le.
2. Colle-le dans ton assistant IA, réponds à ses questions (5 maximum).
3. **Importer le JSON de l'IA** : colle le bloc JSON final qu'il renvoie. Il est
   vérifié contre [`ai-rules-schema.json`](ai-rules-schema.json), puis appliqué
   selon le mode choisi :
   - **Ajouter aux miens** : les nouveaux types, thèmes et presets sont créés
     (un preset dont le nom existe déjà est ignoré), les règles de texte
     ajoutées en tête, et une règle de source met à jour la règle déjà
     existante de cette source. Rien n'est supprimé.
   - **Tout remplacer** : pour chaque section présente dans le JSON, la version
     de l'IA remplace la tienne. Seul ce qui ne peut pas être recréé est
     conservé : le type par défaut, la règle « Tous les événements », une règle
     de source par connexion (remise sur le type par défaut sauf si l'IA la
     cible), les thèmes Clair et Sombre, et tout type ou thème existant que
     l'IA réutilise. Une section absente du JSON n'est pas touchée. Le premier
     thème proposé devient le thème actif.

## Ce qui est exporté (et ce qui ne l'est pas)

Exporté : id, nom et couleur de chaque source ; titres d'événements avec le
moment (jour de la semaine et heure, ou "journée entière") ; types, règles,
presets et thèmes actuels.

Jamais exporté : les URL des calendriers (les liens ICS contiennent leurs propres
clés d'accès), identifiants et mots de passe CalDAV, lieux et notes des
événements.

## Format de sortie

Le JSON reprend l'enveloppe de l'export de réglages web-cal
(`src/lib/settings-export.ts`), limitée aux quatre clés concernées :

```json
{
  "version": 1,
  "exportedAt": "2026-09-28T21:00:00.000Z",
  "data": {
    "overcal:event-types": { "version": 0, "state": { "types": [ … ] } },
    "overcal:rules": { "version": 0, "state": { "rules": [ … ] } },
    "overcal:presets": { "version": 0, "state": { "presets": [ … ] } },
    "overcal:themes": { "version": 0, "state": { "customThemes": [ … ] } }
  }
}
```

Le schéma complet (champs requis, styles autorisés, format des couleurs et des
ids) est dans [`ai-rules-schema.json`](ai-rules-schema.json). Le texte du prompt
lui-même vit dans `src/lib/ai-prompt.ts` (`AI_RULES_PROMPT`), c'est lui que le
bouton d'export utilise.
