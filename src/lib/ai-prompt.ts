/**
 * The "prompt autonome" plus the data export that goes with it: the user copies
 * the result of buildAiExport() into any AI assistant, answers its questions,
 * and pastes the JSON it returns into AiRulesImport (validated by lib/ai-import.ts
 * against docs/ai-rules-schema.json).
 *
 * The export deliberately carries only what rule-drafting needs — source id/name/
 * color, event titles and timing, the current types/rules — never a connection's
 * URL, username or password (ICS subscription URLs embed their own access keys),
 * nor an event's location or notes.
 */
import type { CalendarEvent, Connection, EventType, Rule } from "../types";

/** Distinct titles kept per source — enough to show its categories without flooding the prompt. */
export const SAMPLE_EVENTS_PER_SOURCE = 20;

export const AI_RULES_PROMPT = `Tu es un assistant qui configure l'affichage d'un calendrier web (web-cal).
Je te fournis plus bas, en JSON : mes sources de calendrier, un échantillon
d'événements par source, et mes types d'affichage et règles actuels.

## Comment web-cal affiche les événements
- Un "type d'affichage" définit une couleur, une icône et un style, séparément
  pour les événements journée entière (allDayStyle) et horaires (timedStyle).
- Une "règle" associe des événements à un type. Les règles s'appliquent dans
  l'ordre du tableau : la première qui correspond gagne. Deux sortes :
  - "name" : regex insensible à la casse testée sur le titre (ex: "call|rdv|réunion").
  - "source" : toute une source, via son id exact (une seule par source).
- Si aucune règle ne correspond, le type par défaut s'applique (il existe déjà,
  ne le recrée pas).

## Styles disponibles et quand les utiliser
- block : chip pleine largeur avec le titre. Pour ce qu'on doit voir (réunions, calls, RDV).
- avatar-tr / avatar-bl / avatar-br : petit badge rond dans un coin de la case.
  Pour les repères récurrents qui ne doivent pas prendre de place (anniversaires,
  sport, soirées). Donne des coins différents aux catégories qui tombent souvent
  le même jour. badgeLetter: true affiche la 1re lettre du titre au lieu de
  l'icône (utile quand elle est parlante, ex: B pour badminton).
- background : teinte toute la case. Pour les périodes qui donnent le contexte
  du jour (vacances, déplacements, cours intensifs, jours privatisés).
- border-top / border-bottom : fine ligne colorée. Pour le peu important ou
  l'incertain (à confirmer, événements d'un calendrier partagé).
- text : nom affiché à côté du numéro du jour, sans fond.
- Attention : text, background, border-top et border-bottom sont exclusifs par
  case (un seul événement par jour peut les utiliser, le premier gagne) —
  réserve-les à des catégories qui se chevauchent rarement.

## Ce qui fonctionne bien (exemple réel)
- Préfixes de sources (P- perso, W- travail, E- externe...) : une règle "source"
  pour les sources homogènes (anniversaires → badge Cake, vacances → background).
- Règles "name" pour les catégories transverses aux sources, construites à partir
  des mots vraiment présents dans les titres, abréviations comprises :
  sport "badminton|bad|squash|escalade|grimpe|run|piscine|vélo",
  sorties "soirée|concert|diner|resto", réunions "call|réunion|rdv|dej|point".
- Marqueurs en tête de liste : incertitude "\\\\?|TBC" → type discret en
  border-bottom ; code client ou projet en préfixe (ex: "LT-") → type dédié.
- Règles les plus spécifiques d'abord, les plus larges ensuite.
- Une couleur distincte par type ; gris/ardoise pour le secondaire.

## Ta démarche
1. Analyse les sources et les titres : repère les catégories récurrentes, les
   mots-clés, abréviations, préfixes et emoji.
2. Pose-moi jusqu'à 5 questions courtes pour trancher ce qui est ambigu
   (ce qui doit sauter aux yeux, ce qui peut rester discret, les catégories à
   séparer ou fusionner). Attends mes réponses.
3. Propose le résultat : 3 à 8 nouveaux types maximum, et les règles. Réutilise
   un type existant (par son id) quand il convient, plutôt que d'en créer un
   doublon — ne le relis pas dans "types", référence-le juste dans une règle.
4. Termine par UN seul bloc JSON, strictement au format ci-dessous, rien après.

## Format de sortie (validé par un schéma JSON, tout écart est rejeté)
{
  "version": 1,
  "exportedAt": "<date ISO 8601>",
  "data": {
    "overcal:event-types": {
      "version": 0,
      "state": {
        "types": [
          {
            "id": "sport",
            "label": "Sport",
            "color": "#14b8a6",
            "icon": "Dumbbell",
            "badgeLetter": true,
            "allDayStyle": "avatar-bl",
            "timedStyle": "avatar-bl"
          }
        ]
      }
    },
    "overcal:rules": {
      "version": 0,
      "state": {
        "rules": [
          { "matchType": "name", "matchValue": "badminton|bad|squash", "displayTypeId": "sport", "enabled": true },
          { "matchType": "source", "matchValue": "<id exact d'une de mes sources>", "displayTypeId": "<id d'un type>", "enabled": true }
        ]
      }
    }
  }
}

Contraintes du schéma :
- types[].id : kebab-case (a-z, 0-9, tirets), unique. label : 40 caractères max.
- color : hexadécimal "#RRGGBB".
- icon : nom PascalCase d'une icône lucide-react existante (ex: Cake, Phone,
  Dumbbell, Bike, PartyPopper, GraduationCap, Plane, TreePalm, Briefcase,
  MessageCircleQuestion, Users, Calendar, Utensils, Music, Handshake, Luggage).
- allDayStyle / timedStyle : text, avatar-tr, avatar-bl, avatar-br, block,
  background, border-top ou border-bottom.
- rules[].matchType : "name" ou "source" uniquement (pas de "all" ni "event").
  Pour "name", matchValue doit être une regex JavaScript valide ; pour "source",
  l'id exact d'une source fournie ci-dessous, jamais un id inventé.
- rules[].displayTypeId : l'id d'un type de "types" ou d'un type existant.
- Aucune autre clé que celles montrées.`;

function describeTiming(e: CalendarEvent): string {
  if (e.allDay) return "journée entière";
  const start = new Date(e.start);
  const days = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  return `${days[start.getDay()]} ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
}

/** Prompt + the user's (non-sensitive) calendar data, as one text to paste into an AI chat. */
export function buildAiExport(
  connections: Connection[],
  events: CalendarEvent[],
  types: EventType[],
  rules: Rule[],
): string {
  const sources = connections.map((c) => {
    const own = events
      .filter((e) => e.calendarId === c.id)
      .sort((a, b) => a.start.localeCompare(b.start));
    const seenTitles = new Set<string>();
    const sample: { title: string; quand: string }[] = [];
    for (const e of own) {
      const key = e.title.trim().toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      sample.push({ title: e.title, quand: describeTiming(e) });
      if (sample.length >= SAMPLE_EVENTS_PER_SOURCE) break;
    }
    return { id: c.id, name: c.name, color: c.color, nbEvenements: own.length, echantillon: sample };
  });

  const data = {
    sources,
    typesExistants: types.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.color,
      icon: t.icon,
      allDayStyle: t.allDayStyle,
      timedStyle: t.timedStyle,
      ...(t.isDefault ? { parDefaut: true } : {}),
    })),
    reglesExistantes: rules
      .filter((r) => r.matchType === "name" || r.matchType === "source")
      .map((r) => ({ matchType: r.matchType, matchValue: r.matchValue, displayTypeId: r.displayTypeId, enabled: r.enabled })),
  };

  return `${AI_RULES_PROMPT}\n\n## Mes données\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
}
