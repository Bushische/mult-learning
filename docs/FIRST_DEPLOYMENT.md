# First Deployment — Synology DS223j, home + away

Goal: the app runs on your NAS and is reachable from phones/tablets both on home
Wi-Fi and away from home, through your Synology DNS name. **No tunnel, no public
domain purchase.** Companion to `docs/DEPLOYMENT.md` (topology, backups, restore
drill) and `docs/UPDATE_DEPLOYMENT.md` (publishing new versions later).

Two ways to open the app from the home network — pick one:

| | A — HTTPS via Synology DNS (recommended) | B — plain HTTP (simplest) |
|---|---|---|
| URL | `https://mult.<you>.synology.me:18443` | `http://<nas-ip>:18081` |
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
# laptop (scp -O = legacy protocol: DSM 7's sftp subsystem rejects non-admin
# users, same workaround as the grocery-list project; scp won't create dirs):
ssh <your-ssh-user>@<nas-ip> 'mkdir -p ~/mult-learning'
scp -O docker-compose.prod.yml <your-ssh-user>@<nas-ip>:~/mult-learning/docker-compose.prod.yml
```

```bash
# on the NAS:
cd ~/mult-learning
cat > .env << 'EOF'
NODE_ENV=production     # or development for option B (plain HTTP)
WEB_PORT=18081          # host port for the web container (default 8080 — we use 18081)
LOG_LEVEL=info
JWT_SECRET=<paste: openssl rand -hex 32>
DATABASE_PATH=/data/app.db
CORS_ORIGIN=
EOF
chmod 600 .env
```

`JWT_SECRET` signs the tokens — changing it later logs everybody out.

## 5. Synology DNS + HTTPS for the LAN (option A; skip for option B)

Everything happens in DSM — no router changes, no open ports. (This stays useful
even with the tunnel below: it gives you warning-free HTTPS on home Wi-Fi.)

1. **DDNS name**: DSM → Control Panel → External Access → DDNS → Add →
   hostname `mult-<you>`, provider `Synology` → you get
   `https://mult-<you>.synology.me`. (Status must show "Normal".)
2. **Free certificate**: DSM → Control Panel → Security → Certificate → Add →
   "Get a certificate from Let's Encrypt" → domain `mult-<you>.synology.me`.
   DSM issues it without any port forwarding (Synology validates the DDNS name
   itself). Set it as default or assign it to the proxy in step 3.
3. **Reverse proxy**: DSM → Control Panel → Login Portal → Advanced →
   Reverse Proxy → Create → Customise:
   - Source: protocol **HTTPS**, hostname `mult-<you>.synology.me`, port **18443**
     (DSM reserves 443 for system use, so pick a custom port — any HTTPS port keeps
     the secure context + Secure cookie working), enable HSTS, assign the step-2 certificate.
   - Destination: protocol **HTTP**, hostname `localhost`, port **18081**
     (must match `WEB_PORT` in `~/mult-learning/.env`).
4. **Make the name resolve inside your LAN.** `synology.me` points at your public
   IP, which LAN devices can't always reach (no hairpin NAT on many routers).
   Pick one:
   - Easiest if supported: enable **hairpin/NAT loopback** on the router, or add
     a static DNS entry `mult-<you>.synology.me → <nas-lan-ip>` on the router.
   - Or install the **DNS Server** package on the NAS, create a master zone
     `synology.me` with an A record for your hostname → NAS LAN IP, and point
     the tablets (or the router's DHCP DNS) at the NAS.
   - Test from a laptop first: `https://mult-<you>.synology.me:18443/api/health` must
     return `{"status":"ok"}` — on Wi-Fi **and** with no router tricks it fails,
     which tells you step 4 isn't done yet.
5. **DSM firewall** (if enabled): allow TCP 18443 from the LAN (and TCP 18081 too
   if you use the plain-HTTP option B URL directly). Full walkthrough: §5c.

## 5c. DSM 7 firewall — detailed setup (optional hardening)

With the tunnel there are no inbound ports to protect, so the firewall is
optional — but it costs nothing. DSM's firewall is default-deny — a rule list
with no "allow" blocks everything — so **create the allow rules first, then
switch it on**. Do this from a computer on the home LAN (not over the DDNS name).

1. DSM → Control Panel → Security → **Firewall** tab → select the default
   profile → **Edit Rules**.
2. **Rule 1 — keep the LAN working** (this is what prevents locking yourself out):
   Create → Ports: **All** → Source IP: **Specific IP** → Subnet:
   `192.168.1.0`, subnet mask `255.255.255.0` (adjust to your LAN — check the
   router if unsure) → Action: **Allow**. Move it to the **top** of the list.
2. **Rule 2 — the app from anywhere**: only needed for the old port-forward
   setup — with the §5b tunnel there are no public ports, skip it. (If you ever
   go back to port forwarding: Create → Ports: **Custom** → Destination port,
   protocol **TCP**, ports `18443` → Source IP: **All** → Action: **Allow**.)
3. Leave everything else denied (the implicit last rule). No rules for DSM ports
   (5000/5001), SSH (22), or 18081 from the internet — those stay LAN-only via Rule 1.
4. Back on the Firewall tab → check **Enable firewall** → Apply.
5. Verify immediately, in this order:
   - LAN still works: open DSM (`http://<nas-ip>:5000`) and the app
     (`http://<nas-ip>:18081` or the §5 HTTPS name) from a home device.
   - Internet works: on mobile data (Wi-Fi off) open
     `https://mult.<your-domain>/api/health` → `{"status":"ok"}`.
   - If anything fails: DSM → Log Center → Logs → filter "Firewall" shows exactly
     which rule dropped the packet — fix the rule, don't switch the firewall off.
6. Keep enabled permanently. Re-check after every DSM major update (rarely, custom
   rules survive, but verify).

## 5b. Remote access via Cloudflare tunnel (away from home)

No port forwarding, no DDNS quirks: `cloudflared` dials out from the NAS and
Cloudflare serves your public hostname (same pattern as the grocery-list app).
The Synology reverse proxy from §5 stays for warning-free LAN access; the tunnel
is purely for the outside.

1. **Cloudflare account** (free): https://dash.cloudflare.com/sign-up.
2. **A domain on Cloudflare's free plan** (pick one):
   - **US.KG** — free `yourname.us.kg`, instant, works with Cloudflare.
   - **eu.org** — free `yourname.eu.org`, approval can take days/weeks.
   - **Cheapest real domain** (~$1–2/yr, e.g. `.xyz` on Cloudflare Registrar) —
     the zero-friction option.
   Add the domain in dash.cloudflare.com (plan **Free**), change its nameservers
   to Cloudflare's, wait for the "Active" email.
3. **Create the tunnel** (get the token): Cloudflare dashboard → **Zero Trust**
   (left sidebar) → **Networks → Tunnels** → **Create a tunnel** → connector type
   **Cloudflared** → name it `mult-learning`. Copy the install **token**
   (the long `eyJ…` string). On the tunnel's **Public Hostname** tab → Add:
   subdomain `mult`, domain your domain from step 2, service **HTTP** →
   `web:80`. (This creates the DNS for `mult.<your-domain>` automatically.)
4. **NAS secrets** — add to `~/mult-learning/.env` on the NAS:
   ```bash
   TUNNEL_TOKEN=<eyJ… token from step 3>
   CORS_ORIGIN=https://mult.<your-domain>
   ```
5. **Deploy with the tunnel**:
   ```bash
   # laptop:
   scripts/deploy.sh --nas <your-ssh-user>@<nas-ip> --tunnel
   ```
   On the NAS: `docker compose -f docker-compose.prod.yml --profile tunnel ps` →
   api + web + tunnel all healthy. (`restart: unless-stopped` covers NAS reboots;
   the tunnel restart-loops until the token is valid — a wrong token shows there.)
6. Test on **mobile data** (Wi-Fi off): `https://mult.<your-domain>/api/health`
   → `{"status":"ok"}`, then log in and play a round.

> Dropped alternative: port-forwarding TCP (used before the DDNS issues). The
> tunnel replaces it entirely — no router changes, and it also works behind ISP
> CGNAT (no public IPv4), where port forwarding never can.

## 6. Deploy

```bash
# laptop (add --tunnel for remote access via §5b; omit for LAN-only):
scripts/deploy.sh --nas <your-ssh-user>@<nas-ip> --tunnel
```

What it does: pipes both images straight through SSH (`docker save | ssh docker load`,
no `scp` — DSM 7 rejects it) and runs `up -d` in `~/mult-learning` (with
`--profile tunnel` when `--tunnel` is passed). Then on the NAS:

```bash
cd ~/mult-learning
/usr/local/bin/docker compose -f docker-compose.prod.yml --profile tunnel ps
# api + web + tunnel all healthy (web waits for api)
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
- [ ] away from home (mobile data, Wi-Fi off): open `https://mult.<your-domain>`,
  log in, play a round

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
| `https://mult-…synology.me:18443` unreachable on LAN | local DNS (§5 step 4) not done (remote tunnel access is unaffected) |
| `https://mult.<your-domain>` unreachable anywhere | tunnel misconfigured: `tunnel` container restart-looping → wrong/expired `TUNNEL_TOKEN`; check `docker compose logs tunnel` |
| Tunnel URL shows Cloudflare error 1033/530 | public hostname points at the wrong service — must be HTTP `web:80` |
| `CORS_ORIGIN` boot error / API rejects browser origin | `CORS_ORIGIN` must be exactly `https://mult.<your-domain>` |
| `web` shows 502 on `/api` | api unhealthy → `docker compose logs api` |
| `JWT_SECRET` boot error | `.env` missing/empty (§4) |
| Empty data after a restore | stale `-wal` replayed → see `docs/DEPLOYMENT.md` §10 |
