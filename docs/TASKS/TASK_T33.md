# T33 — Remote access via Cloudflare tunnel (Synology DDNS didn't fit)

- **Goal:** the app is reachable from outside the home through a Cloudflare tunnel, with no port forwarding and no reliance on Synology DDNS behavior.
- **Inputs:** `docker-compose.prod.yml` (prod api+web), `docs/FIRST_DEPLOYMENT.md` (§5/§5b Synology DNS + reverse proxy), `docs/UPDATE_DEPLOYMENT.md`, the grocery-list tunnel setup (compose `tunnel` profile, `TUNNEL_TOKEN`, public-hostname → `web:80`, `CORS_ORIGIN` = public origin).
- **Outputs:** `tunnel` service in `docker-compose.prod.yml` (profile `tunnel`, `cloudflare/cloudflared`, token from `TUNNEL_TOKEN`, memory-capped, waits for healthy `web`); `.env.example` documents `TUNNEL_TOKEN` + tunnel `CORS_ORIGIN`; docs rewritten for remote-via-tunnel (account + free domain on Cloudflare, tunnel creation + public hostname, `--profile tunnel up -d`, boot persistence, quick-tunnel alternative for smoke tests).
- **Test cases:**
  1. Setup: `TUNNEL_TOKEN` unset. Action: render the prod compose config. Expected: config renders; the tunnel service carries an empty token and never starts without `--profile tunnel`.
  2. Setup: docs updated. Action: read the first-deployment remote section. Expected: it lists account/domain/tunnel-creation steps ending in one public HTTPS origin, with no port-forward or DDNS steps.
  3. Setup: tunnel running against the NAS (human, one time). Action: open `https://<host>/api/health` on mobile data. Expected: `{"status":"ok"}`.
  4. Setup: same as 3. Action: log in as a child, play one round, reload. Expected: bank/stats update and the session survives the reload.
  5. Setup: reboot the NAS (human, one time). Action: wait, reopen the public URL. Expected: the app answers without touching anything.
- **Definition of Done:** test cases 1–2 pinned by repo checks (compose config + docs); cases 3–5 verified once by a human and recorded in the task log; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T16
