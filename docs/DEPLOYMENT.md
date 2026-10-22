# Deployment & Backup Runbook

<!-- TEMPLATE: write the full runbook when the deployment task lands.
     The canonical structure (from the reference project) is:

 1. Topology (what runs where)          7. Public HTTPS exposure
 2. Prerequisites                       8. Create the first admin user
 3. Build the images (laptop)           9. Volume layout (what to back up)
 4. Transfer to the target             10. Backups + restore drill (tested)
 5. Configure `.env` (secrets)         11. Upgrades
 6. First boot                         12. Troubleshooting

 Each step: exact commands + expected observable output. Keep the proven
 patterns: consistent SQLite `.backup` snapshots under WAL (delete stale
 -wal/-shm before restore, never replay a snapshot under a newer WAL),
 retention windows, upgrade = snapshot-first-then-rebuild. -->
