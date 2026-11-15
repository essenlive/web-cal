# Déploiement sur cal.essenlive.me

Le déploiement réel est décrit dans le dépôt `homelab` (stack `vps-ovh-deb-vm-01/overcal`, Komodo + Traefik, avec Radicale comme serveur CalDAV interne). Pour un déploiement autonome :

1. Pointer l'enregistrement DNS `cal.essenlive.me` vers le serveur.
2. `cp .env.example .env` puis renseigner `ADMIN_TOKEN` (long, aléatoire, `openssl rand -hex 32`) et `SECRET_KEY` (`openssl rand -base64 32`, à ne plus changer : il chiffre les mots de passe des endpoints CalDAV stockés).
3. `docker compose up -d --build` : l'app écoute sur `127.0.0.1:3000`, la base SQLite est dans le volume `overcal-data`.
4. Reverse proxy (exemple Caddy, TLS automatique) :

```
cal.essenlive.me {
    reverse_proxy 127.0.0.1:3000
}
```

5. Importer la config : `curl -X POST https://cal.essenlive.me/api/admin/import -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" --data @export.json` (renvoie les URL de flux `/api/feed/<token>`).

Pour écrire dans un calendrier CalDAV, ajouter au JSON d'import un tableau `endpoints` :

```json
{ "connectionId": "<id>", "kind": "caldav", "url": "http://radicale:5232/", "username": "overcal", "password": "…", "calendar": "perso" }
```

Créer un événement : `POST /api/events` avec `{ "connectionId", "event": { "title", "start", "end", "allDay" } }` et le même jeton.

Les flux `.ics` sont publics mais protégés par leur jeton opaque ; l'import et l'écriture exigent `ADMIN_TOKEN` (routes désactivées si la variable est absente).
