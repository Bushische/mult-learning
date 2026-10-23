# Update Deployment — publish a fresh version to the NAS

Scope: the app is already live per `docs/FIRST_DEPLOYMENT.md` (home + away over
the Cloudflare tunnel). This publishes a new build from the laptop — the tunnel
stays up throughout (only images are replaced).

---

## 1. Before you start (laptop)

```bash
git status --short        # must be clean — commit or stash first
git pull                  # if the repo moves between machines (solo: usually no-op)
```

Optional: verify the build is green before shipping it:

```bash
pnpm lint && pnpm test
```

## 2. Snapshot the live database (never upgrade without one)

On the NAS (WAL-safe — never copy `app.db` while the api runs):

```bash
ssh <your-ssh-user>@<nas-ip>
cd ~/mult-learning
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T api \
  sqlite3 /data/app.db ".backup '/data/app-$(date +%F).db'"
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T api \
  cat "/data/app-$(date +%F).db" | gzip > "/volume1/backups/app-$(date +%F).db.gz"
/usr/local/bin/docker compose -f docker-compose.prod.yml exec -T api \
  rm -f "/data/app-$(date +%F).db"
```

Full drill (including restore): `docs/DEPLOYMENT.md` §10.

## 3. Build + ship (laptop)

```bash
scripts/build-images.sh                                # linux/arm64 rebuild
scripts/deploy.sh --nas <nas-user>@<nas-ip> --tunnel  # save | ssh load → up -d (with tunnel)
```

Compose recreates the containers because the images changed; the `data` volume
(and the database) is untouched. New migrations apply automatically at api boot.
`--tunnel` is the default path (adds `--profile tunnel` to the remote `up -d`,
so the tunnel container comes back too) — omit it only for a LAN-only stack.

If you changed `docker-compose.prod.yml` itself, copy it over first:

```bash
scp docker-compose.prod.yml <nas-user>@<nas-ip>:~/mult-learning/
```

`.env` on the NAS is never touched by deploys (secrets stay put). If a release
needs a **new** variable, add it to `~/mult-learning/.env` before `up -d`.

## 4. Verify (on home Wi-Fi)

```bash
ssh <nas-user>@<nas-ip> "cd ~/mult-learning && /usr/local/bin/docker compose -f docker-compose.prod.yml --profile tunnel ps"
# api + web + tunnel healthy
```

Then as a user, not just curl:

- [ ] open the app URL → login works (admin + one child)
- [ ] play one round → bank/stats update (proves migrations + write path)
- [ ] reload twice → the new PWA shell is active (service worker precache —
      users see the new UI after one reload)

## 5. Rollback

Images are rebuilt as `latest`, so rollback = rebuild the previous source:

```bash
# laptop:
git log --oneline -5                    # pick the last good sha
git stash -u                            # only if the tree is dirty
git checkout <last-good-sha>
scripts/build-images.sh
scripts/deploy.sh --nas <nas-user>@<nas-ip> --tunnel
git checkout main
```

If the bad release already wrote data (migrations are one-way), restore the
§2 snapshot instead — full steps in `docs/DEPLOYMENT.md` §10 (stop api, delete
`-wal`/`-shm`, copy the snapshot back, start, verify).

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `up -d` didn't pick up the new code | compose recreates only on image change — confirm `deploy.sh` loaded the fresh tarball (`docker images` timestamps on the NAS) |
| UI looks old after deploy | service worker precache — hard reload twice |
| api boot-loops after upgrade | read `docker compose logs api` — usually a missing new `.env` variable; add it, `up -d` again |
| Children logged out after upgrade | expected only if `JWT_SECRET` was rotated — don't touch it during updates |
