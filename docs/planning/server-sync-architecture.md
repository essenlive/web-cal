# Vers une architecture serveur — agrégation & synchronisation de calendriers

> Statut : **document de planification**, pas encore de spec ni de code. Objectif : poser le périmètre, les options d'architecture et les questions à trancher avant de lancer un `speckit.specify`.

## 1. Pourquoi ce chantier

Aujourd'hui, overcal (le nom de code `web-cal`) est une app 100% client : aucune base de données, aucun compte, tout l'état (connexions, types, règles, presets, thèmes) vit dans `localStorage`, et chaque appareil doit re-saisir ses sources ICS/WebCal. Voir [docs/ARCHITECTURE.md](../ARCHITECTURE.md) et [PRODUCT.md](../../PRODUCT.md) pour l'état actuel détaillé.

L'idée du chantier (telle que formulée) :

- **Côté serveur** : stocker et agréger les différentes sources de calendrier, les synchroniser, stocker aussi les règles/styles/thèmes/presets (donc faire de ces réglages un état partagé entre appareils plutôt que du `localStorage` par appareil), *fetch*/rafraîchir/précalculer les événements, et pouvoir exposer des flux `.ics` générés à partir des presets.
- **Côté client** : garder le fonctionnement actuel, mais pouvoir **créer de nouveaux événements dans les calendriers sources** (donc dépasser la contrainte lecture-seule actuelle), avec une authentification simple — une passphrase, transmise par QR code, sans notion de compte.
- Déployable en **self-hosted** (un utilisateur/foyer qui fait tourner son propre serveur).

C'est noté depuis un moment dans [TODO.md](../../TODO.md) :

> **Move to a server-side architecture** — Global rework to have a modular server side component that store sources and events and sync settings between settings. This architecture should not require an account, only a passphrase passed by a QR code.

Ce document reprend cette intention, l'articule avec ce qui existe déjà côté client, et regarde ce qu'un outil existant (keeper.sh) fait déjà pour ne pas réinventer ce qui est déjà résolu.

## 2. Ce qui existe déjà côté client (à ne pas casser)

Le cœur de la valeur du produit n'est pas la synchro réseau, c'est le **moteur de règles/affichage** : types d'événements, règles ordonnées, presets, thèmes, quick-hide. Tout ça reste pertinent avec un serveur — ça devient juste de l'état *partagé* au lieu d'être local à un appareil. Points à préserver dans toute nouvelle architecture :

- Résolution de style par règles (jamais par la source), cf. [Display rules engine](../ARCHITECTURE.md#display-rules-engine).
- Cache applicatif par plage de dates avec *stale-while-revalidate* et retry/backoff par connexion ([Event caching & sync feedback](../ARCHITECTURE.md#event-caching--sync-feedback)) — logique qui migre naturellement côté serveur (un seul worker de sync au lieu d'un cache par navigateur).
- Démarrage à vide avec données de démo, lecture seule sur les sources synchronisées (sauf la source de démo).
- Export/import JSON des réglages (`/data`) — reste utile même avec un serveur, comme sauvegarde/portabilité.

## 3. Ce qui existe déjà ailleurs : keeper.sh

[keeper.sh](https://github.com/ridafkih/keeper) est un outil open-source (AGPL-3.0) qui fait une partie de ce que viserait notre brique serveur :

- Agrège des flux iCal/ICS (Google, Outlook/Office 365, iCloud, CalDAV via leur export ICS) et les repousse vers un ou plusieurs calendriers.
- Le matching entre occurrences se fait par UID + métadonnées propres à chaque provider.
- Expose en retour un flux iCal partagé, synchronisé, qui peut être réduit à du "libre/occupé" sans détail.
- Self-hostable : Bun ≥ 1.3.11, Docker/Docker Compose, PostgreSQL, Redis, reverse-proxy Caddy — ou une image "tout-en-un" qui bundle UI web + API + cron + worker + Redis + Caddy derrière un seul port.
- Fournit aussi un serveur MCP pour un accès agent aux calendriers.

Ce que keeper.sh **ne couvre pas** et que notre produit garde comme valeur propre : le moteur de règles d'affichage, les types/styles/thèmes, les presets de visibilité, l'UI calendrier elle-même. keeper.sh est une brique de *sync*, pas un calendrier affiché.

Deux options à trancher (section 6) :
1. **Réutiliser keeper.sh** comme moteur de sync/agrégation sous-jacent (en conteneur à côté), et ne construire que la couche réglages + génération de flux presets + API consommée par le client overcal.
2. **Écrire notre propre worker de sync**, plus petit, en réutilisant la logique déjà écrite côté client (`lib/multi-source-provider.ts`, `lib/event-cache.ts`, retry/backoff) mais déplacée côté serveur.

L'option 1 va plus vite sur la partie "lecture multi-sources" mais ajoute une dépendance AGPL-3.0, du Postgres+Redis, et ne résout pas l'écriture de nouveaux événements ni le modèle d'auth par passphrase/QR voulu ici. L'option 2 est plus de travail mais garde un empilement minimal et cohérent avec l'existant (TypeScript partout, pas de nouveau langage/runtime).

## 4. Proposition d'architecture

### 4.1 Composants serveur

| Composant | Rôle |
| --- | --- |
| **API** | Sert les réglages (connexions, types, règles, presets, thèmes) et les événements résolus au client. Remplace `localStorage` comme source de vérité ; le client garde un cache local pour l'usage hors-ligne/offline-first. |
| **Worker de sync** | Déplace côté serveur ce que fait aujourd'hui `DataProviderContext` : fetch périodique par connexion, cache par plage de dates, retry/backoff. Tourne en tâche de fond (cron ou boucle), pas à la demande d'un onglet ouvert. |
| **Store** | Persiste connexions, types, règles, presets, thèmes, et le cache d'événements précalculés. SQLite en self-host simple (un seul fichier, pas de service annexe) ou Postgres si on veut la robustesse multi-process de keeper.sh. |
| **Génération de flux `.ics`** | Pour un preset donné, produit un flux `.ics` public (ou protégé par un token) consommable par un calendrier tiers (Google Calendar en "ajouter par URL", etc.). |
| **Auth** | Passphrase simple, sans email/compte. Une session d'appareil se crée en scannant un QR code qui encode la passphrase (ou un token dérivé) — pensé pour "ajouter un nouvel appareil à mon instance", pas pour du multi-utilisateur avec droits différenciés. |

### 4.2 Écriture d'événements côté client

C'est le point le plus structurant : aujourd'hui `DataProvider` n'a **aucune** méthode d'écriture (`createEvent`/`updateEvent`/`deleteEvent` lèvent une erreur sur toute source synchronisée, cf. [PRODUCT.md](../../PRODUCT.md) "Capabilities and Constraints"). Un flux `.ics`/WebCal est par nature **lecture seule** — il n'y a pas de protocole standard pour écrire dans un flux ICS distant.

Pour permettre la création d'événements dans les sources, il faut nécessairement un accès **API natif** au fournisseur (Google Calendar API, Microsoft Graph, ou CalDAV en écriture pour iCloud/Fastmail/Nextcloud — CalDAV a été retiré du client récemment mais son usage en écriture resterait pertinent côté serveur). Ça veut dire :

- Garder les sources ICS/WebCal en lecture seule comme aujourd'hui (le gros des sources "partagées publiquement" : abonnements, calendriers d'équipe, etc.).
- Ajouter un nouveau type de connexion "compte" (OAuth Google/Microsoft, ou identifiants CalDAV) pour les sources où l'utilisateur veut pouvoir écrire. Le serveur détient les jetons OAuth/identifiants (jamais le client, pour ne pas les dupliquer par appareil) et expose une opération d'écriture générique que le client appelle.

C'est un sous-chantier à part entière (OAuth, stockage sécurisé des jetons, rafraîchissement) — à ne pas sous-estimer dans le séquencement.

### 4.3 Client

Le client change de rôle : au lieu d'être la seule source de vérité (`localStorage`), il devient un client léger qui :
- s'authentifie une fois par passphrase/QR, garde un token de session ;
- lit réglages + événements précalculés depuis l'API serveur, avec un cache local pour l'affichage instantané et le mode dégradé hors-ligne ;
- peut toujours fonctionner **sans serveur** (mode actuel 100% local) — à garder comme mode de repli, cf. section 6.

## 5. Phasage proposé

1. **Choix techniques** (stockage, langage/framework du serveur, auth) — section 6, à valider avant tout code.
2. **API lecture seule côté serveur**, qui reproduit l'agrégation actuelle (fetch + cache + resolution de règles) et expose des flux `.ics` par preset. Le client existant n'est pas encore branché dessus — on valide le serveur seul (via le flux `.ics` généré, importable dans n'importe quel calendrier).
3. **Sync des réglages** : le client bascule son stockage de `localStorage` vers l'API (avec cache local en repli), toujours en lecture seule pour les événements.
4. **Auth passphrase + QR code** : appairage d'un nouvel appareil à une instance existante.
5. **Écriture d'événements** : connexions "compte" (OAuth/CalDAV en écriture) + opérations de création/édition/suppression exposées au client.
6. **Packaging self-hosted** : image Docker (ou docker-compose), doc d'installation, variables d'environnement, sauvegarde du store.

Chaque phase est livrable et testable indépendamment ; rien n'empêche de s'arrêter à la phase 3 si l'écriture d'événements s'avère trop coûteuse pour l'instant.

## 6. Questions à trancher avant de spécifier

- **Stockage** : SQLite (simple, un seul fichier, suffisant pour un usage mono-foyer) vs Postgres (plus robuste, mais une dépendance de plus à faire tourner en self-host). *Proposition : commencer en SQLite, garder la porte ouverte à Postgres si le multi-process du worker l'exige.*
- **Réutiliser keeper.sh ou écrire notre propre worker de sync ?** (section 3). *Proposition : écrire notre propre worker — la logique existe déjà côté client (`multi-source-provider.ts`, `event-cache.ts`), c'est surtout un déplacement, et ça évite une dépendance AGPL + Postgres/Redis/Bun supplémentaire pour un besoin qu'on maîtrise déjà.*
- **Mode sans serveur** : le client doit-il continuer à fonctionner 100% local si aucun serveur n'est configuré (comme aujourd'hui), ou le serveur devient-il obligatoire ? *Impacte directement [PRODUCT.md](../../PRODUCT.md), qui affirme aujourd'hui "no backend, no account, no server-side data store" comme contrainte produit — ce document devra être mis à jour une fois la direction choisie.*
- **Multi-appareils / multi-personnes** : une passphrase = une instance partagée par tous les appareils qui la connaissent (pas de notion d'utilisateur séparé), ou faut-il prévoir plusieurs "espaces" par serveur ? *Proposition initiale : une instance = un espace, une passphrase — correspond à l'usage "foyer" décrit, pas de gestion de droits à construire.*
- **Écriture d'événements** : quels fournisseurs couvrir en priorité (Google, Microsoft, CalDAV générique) ? Un seul suffit pour une première version.
- **Déploiement** : conteneur unique (API + worker + store embarqué) pour rester simple à self-hoster, ou séparer API/worker pour pouvoir scaler indépendamment ? *Proposition : conteneur unique au départ, vu l'usage mono-foyer visé.*

## 7. Prochaines étapes

1. Valider ce document et les propositions de la section 6 (ou les amender).
2. Une fois les choix faits, lancer `/speckit.specify` pour une première spec ciblée sur la phase 2 de la section 5 (API lecture seule + flux `.ics` par preset), qui est la brique qui apporte déjà de la valeur (agrégation centralisée, flux partageable) sans toucher à l'auth ni à l'écriture.
3. Traiter l'auth (passphrase/QR) et l'écriture d'événements comme des specs séparées, une fois la fondation serveur en place.
