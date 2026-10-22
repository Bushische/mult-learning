# T14 — Admin game studio: ranges, combination matrix, variants, economics, hints

- **Goal:** admins build practice configurations without touching internals.
- **Inputs:** docs/PROJECT.md (screen F.4), docs/API.md (games shape + validation).
- **Outputs:** `features/admin/games/`: game list (edit/duplicate/new) + studio form:
  name; Factor A range + Factor B range (1..20, min ≤ max, inline errors); a visual A×B
  checkbox matrix to optionally pin exact combinations (empty = "whole range"); variant
  count stepper 3–6; reward/penalty/cap number inputs; hints editor (factor picker + text,
  add/remove, saved as `hints_json`). Create/PATCH always through the shared zod schema —
  server errors map to inline field errors.
- **Test cases:**
  1. Creating "Hard Sevens" 7–7 × 2–9 with 4 variants + one hint lands in a child's assigned
     play screen (visible name/economics there).
  2. Setting rangeA.min > max or factor 0 shows inline errors and never submits.
  3. Pinning combinations [[3,4],[3,6]] saves; the play feature then rolls only those combos;
     clearing the matrix reverts to full-range.
  4. Editing an existing game updates reward/penalty for the child's next round (dashboard
     shows the new economics).
  5. Duplicate ("copy of Easy Twos") creates an independent game; deleting the duplicate
     leaves the original assigned and playable.
- **Definition of Done:** Test cases 1–5 pinned by `features/admin/games/*.test.tsx`;
  full gate `pnpm test && pnpm lint`.
- **Dependencies:** T13, T9
