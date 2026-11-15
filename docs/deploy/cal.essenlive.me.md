# Déploiement sur cal.essenlive.me

1. Pointer l'enregistrement DNS `cal.essenlive.me` vers le serveur.
2. `cp .env.example .env` puis renseigner `ADMIN_TOKEN` (long, aléatoire) et, si keeper.sh est utilisé, `KEEPER_BASE_URL` / `KEEPER_API_TOKEN`.
3. `docker compose up -d --build` : l'app écoute sur `127.0.0.1:3000`, la base SQLite est dans le volume `overcal-data`.
4. Reverse proxy (exemple Caddy, TLS automatique) :

```
cal.essenlive.me {
    reverse_proxy 127.0.0.1:3000
}
```

5. Importer la config : `curl -X POST https://cal.essenlive.me/api/admin/import -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" --data @export.json` (renvoie les URL de flux `/api/feed/<token>`).

Les flux `.ics` sont publics mais protégés par leur jeton opaque ; seul l'import exige `ADMIN_TOKEN`.
