# First Deployment — Synology DS223j, home + away

Goal: the app runs on your NAS and is reachable from phones/tablets both on home
Wi-Fi and away from home, through your Synology DNS name. **No tunnel, no public
domain purchase.** Companion to `docs/DEPLOYMENT.md` (topology, backups, restore
drill) and `docs/UPDATE_DEPLOYMENT.md` (publishing new versions later).

Two ways to open the app from the home network — pick one:

| | A — HTTPS via Synology DNS (recommended) | B — plain HTTP (simplest) |
|---|---|---|
| URL | `https://mult.<you>.synology.me` | `http://<nas-ip>:8080` |
| Setup | DDNS + free certificate + reverse proxy (§5) | none |
| `NODE_ENV` | `production` | `development` (see box below) |
| Login persistence | full (Secure cookie works over HTTPS) | full |
| PWA install | yes (HTTPS is a secure context) | Android yes; iOS "Add to Home Screen" works but no push (no push used anyway) |

> Why `NODE_ENV` matters: the login cookie is `Secure` **only** in production, and
> browsers drop `Secure` cookies over plain HTTP — the child would be logged out on
> every reload. So plain HTTP **requires** `NODE_ENV=development`. Nothing else
> changes (same code, same limits).

---

## 1. Prerequisites

1. Laptop with this repo, Docker (Desktop / OrbStack) with `docker buildx`.
2. NAS: **Container Manager** installed (DSM → Package Center), SSH enabled
   (DSM → Control Panel → Terminal & SNMP → Enable SSH).
3. Decide the NAS address: `ssh <your-ssh-user>@<nas-ip>` (the built-in `admin`
   is disabled on DSM 7 — use your own SSH-enabled user).

## 2. Build the images (laptop)

```bash
scripts/build-images.sh      # linux/arm64 — what the DS223j needs
docker images | grep mult-learning
# mult-learning-api   latest   …
# mult-learning-web   latest   …
```

## 3. Prepare the NAS (one time)

```bash
ssh <your-ssh-user>@<nas-ip>

sudo -i                                # become root for the setup steps
ls /volume1                            # confirm the volume path (usually /volume1)
synogroup --add docker <your-ssh-user> # allow docker over SSH without root
chown root:docker /var/run/docker.sock
exit                                   # back to your user; RE-LOGIN for the group to apply
```

After re-login, verify: `docker ps` works without sudo. (If `sudo` rejects you:
DSM → Control Panel → Users → your user → Edit → check "administrators".)

> DSM PATH quirk: the docker CLI lives at `/usr/local/bin/docker` and is NOT on
> the PATH of non-interactive SSH commands. On the NAS always use the full path
> (`/usr/local/bin/docker …`) or `cd` + plain `docker compose` in an interactive shell.

## 4. Project folder + secrets on the NAS

`scripts/deploy.sh --nas` ships the images and runs `up -d` in `~/mult-learning`,
but it does **not** copy the compose file or secrets — do that once now:

```bash
# laptop:
scp docker-compose.prod.yml <your-ssh-user>@<nas-ip>:~/mult-learning/docker-compose.prod.yml
```

```bash
# on the NAS:
cd ~/mult-learning
cat > .env << 'EOF'
NODE_ENV=production     # or development for option B (plain HTTP)
WEB_PORT=8080
LOG_LEVEL=info
JWT_SECRET=<paste: openssl rand -hex 32>
DATABASE_PATH=/data/app.db
CORS_ORIGIN=
EOF
chmod 600 .env
```

`JWT_SECRET` signs the tokens — changing it later logs everybody out.

## 5. Synology DNS + HTTPS (option A; skip for option B)

Everything happens in DSM — no router changes, no open ports.

1. **DDNS name**: DSM → Control Panel → External Access → DDNS → Add →
   hostname `mult-<you>`, provider `Synology` → you get
   `https://mult-<you>.synology.me`. (Status must show "Normal".)
2. **Free certificate**: DSM → Control Panel → Security → Certificate → Add →
   "Get a certificate from Let's Encrypt" → domain `mult-<you>.synology.me`.
   DSM issues it without any port forwarding (Synology validates the DDNS name
   itself). Set it as default or assign it to the proxy in step 3.
3. **Reverse proxy**: DSM → Control Panel → Login Portal → Advanced →
   Reverse Proxy → Create → Customise:
   - Source: protocol **HTTPS**, hostname `mult-<you>.synology.me`, port **443**,
     enable HSTS, assign the step-2 certificate.
   - Destination: protocol **HTTP**, hostname `localhost`, port **8080**.
4. **Make the name resolve inside your LAN.** `synology.me` points at your public
   IP, which LAN devices can't always reach (no hairpin NAT on many routers).
   Pick one:
   - Easiest if supported: enable **hairpin/NAT loopback** on the router, or add
     a static DNS entry `mult-<you>.synology.me → <nas-lan-ip>` on the router.
   - Or install the **DNS Server** package on the NAS, create a master zone
     `synology.me` with an A record for your hostname → NAS LAN IP, and point
     the tablets (or the router's DHCP DNS) at the NAS.
   - Test from a laptop first: `https://mult-<you>.synology.me/api/health` must
     return `{"status":"ok"}` — on Wi-Fi **and** with no router tricks it fails,
     which tells you step 4 isn't done yet.
5. **DSM firewall** (if enabled): allow TCP 443 from the LAN.

## 5b. Remote access (away from home)

Same Synology DNS name, one router change:

1. **Port forwarding** on the router: external TCP **443** → `<nas-lan-ip>:443`.
   No other ports (never expose DSM's 5000/5001 or SSH directly).
2. **Lock down DSM**: Control Panel → Security → enable **Auto Block** (e.g. 5
   failed logins), turn on **2-factor authentication** for your DSM admin user,
   keep DSM + Container Manager updated.
3. **DSM firewall** (if enabled): allow TCP 443 from all (the reverse proxy only
   serves the app hostname; DSM itself stays behind its own login).
4. Test on **mobile data** (Wi-Fi off): `https://mult-<you>.synology.me/api/health`
   → `{"status":"ok"}`, then log in and play a round.

> Alternative without port forwarding: a Cloudflare tunnel (the grocery-list
> setup). It needs a domain on Cloudflare's free plan because `synology.me`
> cannot hold the tunnel's CNAME record. Prefer the port-forward above unless
> your ISP uses CGNAT (no public IPv4) — then the tunnel is the way.

## 6. Deploy

```bash
# laptop:
scripts/deploy.sh --nas <your-ssh-user>@<nas-ip>
```

What it does: `docker save` both images → `scp` → `docker load` on the NAS →
`up -d` in `~/mult-learning`. Then on the NAS:

```bash
cd ~/mult-learning
/usr/local/bin/docker compose -f docker-compose.prod.yml ps
# api + web both healthy (web waits for api)
```

## 7. First boot + first users

1. Migrations run automatically at api boot (idempotent).
2. Seed the demo data:
   ```bash
   /usr/local/bin/docker compose -f docker-compose.prod.yml exec api node dist/scripts/seed.js
   # seeded /data/app.db: +2 users, +2 games, +2 assignments
   ```
3. Open the app (option A or B URL) → log in as `admin` / `1289` →
   **change the admin PIN immediately** (Admin → Users → Edit).
4. Create each child (Admin → Users → New user, 4-digit PIN), assign games
   (checkboxes → Save games). Log in as the child once to confirm the PIN works.

## 8. Tablet/phone checklist (on home Wi-Fi)

- [ ] `/api/health` → `{"status":"ok"}`
- [ ] login as a child → dashboard with bank, heatmap, games
- [ ] play one round → bank grows, stats update, feedback shows the framed seconds
- [ ] reload keeps the session (no re-login — proves the cookie setup)
- [ ] install the PWA: iOS Safari → Share → Add to Home Screen; Android Chrome → Install
- [ ] reboot the NAS once → stack comes back on its own (`restart: unless-stopped`)
- [ ] away from home (mobile data, Wi-Fi off): open the URL, log in, play a round

## 9. Backups

Schedule the §10 procedure from `docs/DEPLOYMENT.md` (WAL-safe `.backup` via DSM
Task Scheduler). Do this **before** the children start playing — the DB is the
only thing you can't rebuild.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `docker: command not found` over SSH | use `/usr/local/bin/docker` (PATH quirk, §3) |
| `permission denied … /var/run/docker.sock` | user not in `docker` group → §3, then re-login |
| Login works, session lost on reload (plain HTTP) | `NODE_ENV` is `production` → set `development` in `.env`, `up -d` again |
| `https://mult-…synology.me` unreachable on LAN | local DNS (§5 step 4) not done; from mobile data it should work once §5b is set |
| `https://mult-…synology.me` unreachable away from home | port forward 443 missing (§5b step 1), or ISP CGNAT (no public IPv4) → use a Cloudflare tunnel instead |
| `web` shows 502 on `/api` | api unhealthy → `docker compose logs api` |
| `JWT_SECRET` boot error | `.env` missing/empty (§4) |
| Empty data after a restore | stale `-wal` replayed → see `docs/DEPLOYMENT.md` §10 |
