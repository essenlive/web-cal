# Générer un jeu de règles avec une IA

Un prompt à copier-coller dans Claude/ChatGPT (ou tout autre assistant) pour
générer, à partir de tes sources de calendrier et d'un échantillon
d'événements, un jeu de types d'affichage et de règles prêt à importer dans
web-cal (bouton "Importer un JSON généré par IA" en bas de la page Règles).

## Comment l'utiliser

1. Copie le prompt ci-dessous dans une conversation avec ton assistant IA préféré.
2. Colle après le prompt : la liste de tes sources (nom, id, couleur — visibles
   dans Réglages → Sources) et un échantillon d'événements (titre, source,
   all-day/horaire — un export ICS ou une copie de la vue agenda suffit).
3. Réponds à ses questions de clarification.
4. Récupère le bloc JSON final et colle-le dans le bouton d'import de la page Règles.

L'import ne touche jamais aux connexions/couleurs de sources ni à la règle
attrape-tout ; il crée les types d'affichage proposés et ajoute les règles de
texte, et met à jour la règle de source existante d'une connexion si l'IA
lui a assigné un type.

## Le prompt

```
Tu configures l'affichage d'un calendrier. Je vais te donner la liste de mes
sources de calendrier (nom, id, couleur) et un échantillon de mes événements
(titre, source, all-day ou horaire, récurrence si connue — jusqu'à 200).

1. Repère les catégories récurrentes : mots-clés ou emoji dans le titre,
   source d'origine, motif horaire (all-day vs horaire).
2. Pose-moi jusqu'à 5 questions courtes pour trancher les cas ambigus
   (ex: "Les événements 'Garde' doivent-ils être discrets ou bien visibles ?").
3. Une fois les réponses obtenues, produis 4 à 8 types d'affichage maximum
   (pas de type par défaut, il existe déjà côté app) et les règles qui y
   mènent, de la plus spécifique à la plus générale.

Sortie JSON stricte, un seul bloc final, rien d'autre après :

{
  "eventTypes": [
    {
      "id": "kebab-case-id",
      "label": "Nom court",
      "color": "#RRGGBB",
      "icon": "NomIconeLucide",
      "badgeLetter": false,
      "allDayStyle": "background",
      "timedStyle": "block"
    }
  ],
  "rules": [
    { "matchType": "name", "matchValue": "regex insensible à la casse", "displayTypeId": "kebab-case-id", "enabled": true },
    { "matchType": "source", "matchValue": "id-de-source-fourni", "displayTypeId": "kebab-case-id", "enabled": true }
  ]
}

Contraintes :
- allDayStyle/timedStyle ∈ {text, avatar-tr, avatar-bl, avatar-br, block, background, border-top, border-bottom}.
- matchType ∈ {name, source} uniquement. "name" = regex testée sur le titre.
  "source" = l'id exact d'une source que je t'ai fourni (jamais un id inventé).
- icon = un nom d'icône lucide-react existant (ex: Cake, Bell, Briefcase,
  Plane, Heart, Home, Users, Calendar, Star, Coffee, BookOpen...).
- Couleurs distinctes et cohérentes avec la catégorie (ex: rouge = urgent,
  vert = perso). Jamais deux types avec la même couleur si possible.
- Les règles "name" sont listées de la plus spécifique (priorité haute) à la
  plus générale (priorité basse) : l'ordre du tableau compte.
```
