# Deployment & Backup Runbook

Synology DS223j (ARM64, 1 GB RAM) — self-hosted, no cloud services, no CI/CD.
Everything is built on the laptop and copied to the NAS.

- **First time?** Start with `docs/FIRST_DEPLOYMENT.md` (local-network setup with
  Synology DNS + HTTPS, first boot, first users).
- **Shipping a new version?** See `docs/UPDATE_DEPLOYMENT.md` (snapshot, rebuild,
  verify, rollback).

---

## 1. Topology (what runs where)

```
                 ┌──────────────────────── Synology DS223j ────────────────────────┐
 browser ──HTTP──▶  web container (nginx, 32 MB)  ──/api──▶  api container (128 MB)
 (tablet/phone)      serves the PWA + proxies /api        Fastify + SQLite (WAL)
                                                              │
                                                        /data/app.db  (volume)
```

* `web` — nginx: static PWA (`index.html`, service worker) + reverse proxy `/api → api:3000`.
* `api` — Fastify + Drizzle + better-sqlite3. **No database server** — SQLite runs inside
  the api process (WAL mode), the file lives on the `data` volume.
* The browser only ever talks to the `web` container (host port `WEB_PORT`,
  18081 in our setup), so the
  refresh cookie stays first-party (`SameSite=Strict`, `Path=/api/auth`).

## 2. Prerequisites

* Laptop: Docker Desktop / OrbStack with `docker buildx` (`docker buildx version`).
* NAS: Container Manager (Docker CLI + compose v2), SSH access, ~1 GB free RAM.
* A `.env` with a long random `JWT_SECRET` (see §5).

## 3. Build the images (laptop)

```bash
scripts/build-images.sh              # linux/arm64 (what the DS223j needs)
scripts/build-images.sh --local      # host architecture — faster, for local testing
```

Expected output: two images in the list.

```
mult-learning-api   latest   …
mult-learning-web   latest   …
```

## 4. Transfer to the target

```bash
scripts/deploy.sh --nas <nas-user>@<nas-ip>
```

The script saves both images (`docker save | gzip`), copies the tarball with `scp`, loads
it on the NAS (`docker load`) and starts the stack with
`docker compose -f docker-compose.prod.yml up -d`.

Check on the NAS:

```bash
ssh <nas-user>@<nas-ip> "docker images | grep mult-learning"
ssh <nas-user>@<nas-ip> "docker compose -f docker-compose.prod.yml ps"
```

## 5. Configure `.env` (secrets)

Create `/volume1/docker/mult-learning/.env` on the NAS (keep it out of git):

```bash
NODE_ENV=production
WEB_PORT=18081
LOG_LEVEL=info
JWT_SECRET=<openssl rand -hex 32>
DATABASE_PATH=/data/app.db
CORS_ORIGIN=
```

`JWT_SECRET` signs the access tokens — changing it logs everybody out.

## 6. First boot

```bash
cd ~/mult-learning
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api
```

The api applies the migrations at boot (idempotent) — the log shows
`Server listening at http://0.0.0.0:3000`.

The volume is created automatically (`data` → `/data` in the api container).

## 7. Public HTTPS exposure

* Port mapping: `WEB_PORT` (18081 in our setup, `8080` if unset) → the web container's port 80.
* For HTTPS, put the NAS behind a reverse proxy (nginx on the NAS, Synology Reverse
  Proxy, or a Cloudflare tunnel) and forward `/` + `/api` to the web container.
* The refresh cookie is `Secure` **only** when `NODE_ENV=production` — behind plain HTTP
  on the LAN the browser would drop it, so use HTTPS (or set `NODE_ENV=development` for a
  plain-HTTP test run).

## 8. Create the first admin user

The seed script creates the admin (`admin` / PIN `1289`), the demo child (`child1` / `2468`)
and the two base games:

```bash
docker compose -f docker-compose.prod.yml exec api node dist/scripts/seed.js
```

Output: `seeded /data/app.db: +2 users, +2 games, +2 assignments` (running it twice adds
nothing). **Change the admin PIN in the admin panel right afterwards** (Users → Edit).

## 9. Volume layout (what to back up)

| Path (NAS) | Content |
|---|---|
| `/volume1/docker/mult-learning/` | the repo + `.env` + `docker-compose.prod.yml` |
| docker volume `mult-learning_data` | `/data/app.db` (+ `-wal`, `-shm`) |

The database lives **inside the docker volume**, not in the project folder. Back it up with
`sqlite3 .backup` (never copy the file while the api is running — WAL!).

## 10. Backups + restore drill (tested)

### Daily backup (NAS scheduler)

The api image ships the `sqlite3` CLI, so the snapshot is taken from inside the container
(`.backup` is WAL-safe — never copy `app.db` while the api is running!).

```bash
cd ~/mult-learning
COMPOSE="docker compose -f docker-compose.prod.yml"

# 1. WAL-safe snapshot into the data volume
$COMPOSE exec -T api sqlite3 /data/app.db ".backup '/data/app-$(date +%F).db'"

# 2. copy the snapshot out of the volume (keep 14 days)
$COMPOSE exec -T api cat "/data/app-$(date +%F).db" | gzip > "/volume1/backups/app-$(date +%F).db.gz"

# 3. remove the snapshot from the volume
$COMPOSE exec -T api rm -f "/data/app-$(date +%F).db"

# retention
find /volume1/backups -name 'app-*.db.gz' -mtime +14 -delete
```

`scripts/backup.sh` does the same thing for a container that has `sqlite3` on the PATH.

### Restore drill (run it once — it is a rehearsal, not a theory)

```bash
cd ~/mult-learning
COMPOSE="docker compose -f docker-compose.prod.yml"

# 1. snapshot the live database (into the volume, so every container can see it)
$COMPOSE exec -T api sqlite3 /data/app.db ".backup '/data/restore-test.db'"

# 2. stop the api (a running api would keep writing to the -wal file)
$COMPOSE stop api

# 3. delete the stale -wal / -shm files — otherwise SQLite replays them over the snapshot
#    and the restored data looks corrupted
$COMPOSE run --rm --entrypoint sh api -c "rm -f /data/app.db-wal /data/app.db-shm"

# 4. put the snapshot back (cp, never `cat >` — a failed cat would truncate the file!)
$COMPOSE run --rm --entrypoint sh api -c "cp /data/restore-test.db /data/app.db"

# 5. start again and verify the data
$COMPOSE start api
$COMPOSE exec -T api sqlite3 /data/app.db "select username, role from users;"
WEB_PORT=18081 scripts/smoke.sh        # login + answer + stats
```

Verified on the laptop (2026-10-22): after the restore the `users` table still contained
`admin|admin` and `child1|user`, and `scripts/smoke.sh` passed
(`SMOKE: ok — health, login, answer and stats all work`).

## 11. Upgrades

```bash
# 1. snapshot first (never upgrade without a snapshot)
scripts/backup.sh /volume1/backups

# 2. rebuild + transfer + restart
scripts/build-images.sh
scripts/deploy.sh --nas <nas-user>@<nas-ip>
```

The api applies new migrations at boot (idempotent); the web container is replaced with the
new PWA build. The refresh tokens survive (the database is untouched).

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `web` shows 502 on `/api` | the api container is unhealthy: `docker compose logs api` |
| login works, but the child is logged out after a restart | the refresh cookie was dropped → use HTTPS (§7) or set `NODE_ENV=development` |
| `403 Admin role required` | the token was signed with the old `JWT_SECRET` → restart the api after changing it |
| `SQLITE_BUSY` in the logs | a second writer — only the api may write; check that no dev container uses the same volume |
| the data is empty after a restore | a stale `-wal` file was replayed over the snapshot → delete `-wal`/`-shm` before restoring (§10) |
| `docker compose up` fails with `JWT_SECRET` | `.env` is missing or the variable is empty (§5) |
