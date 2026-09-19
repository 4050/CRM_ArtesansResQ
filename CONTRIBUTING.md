# Contributing / Git workflow

This project uses **trunk-based development**, borrowing from
[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow),
[Conventional Commits](https://www.conventionalcommits.org/) discipline (without
the mandatory `type:` prefix — see below), and the standard PR-review model
used by most open-source and corporate teams. It's written down here so the
convention survives beyond any one contributor's memory.

## Branches

- **`main`** — the rollback-safe baseline and the only integration point.
  Only ever updated via a reviewed PR. Never commit to it directly.
- **Feature/fix branches** — one branch per discrete, independently
  reviewable change. Branch off the *current tip* of `main`, do the work,
  open a PR back into `main`, then delete the branch once merged.

This project briefly used a staging integration branch (`team-stock-warehouse`)
to batch several related feature branches before merging them into `main`
together. That branch was merged and retired; every branch since has targeted
`main` directly, and there's no active integration branch today. If a future
piece of work is genuinely large enough to warrant staging again, introduce
a new integration branch deliberately and update this doc to name it - don't
assume one exists.

### Why one branch per change

A branch that mixes two unrelated changes (e.g. a UI fix and a new feature)
is harder to review, harder to revert in isolation, and harder to bisect
later. Keep each branch scoped to a single concern:

- Starting genuinely new work → branch from `main`'s tip.
- A small follow-up to a change still under review → keep committing to that
  same branch/PR rather than spawning a new one.
- Need code that only exists on another unmerged branch (e.g. fixing a bug
  introduced by a feature that hasn't landed yet) → branch from *that*
  feature branch instead, and PR into it, not into `main` - `main` doesn't
  have the code yet either.

### Naming

Flat `kebab-case`, describing *what* the change is, not a ticket number
(there's no external tracker): `decouple-bags-vehicles`,
`mobile-responsive-fixes`, `warehouse-source-categories`.

## Commits

Follow the spirit of [Conventional Commits](https://www.conventionalcommits.org/)
and Chris Beams' [seven rules](https://cbea.ms/git-commit/) without the
`feat:`/`fix:` prefix noise, to match this repo's existing history:

- Subject line in the **imperative mood** ("Add", "Fix", "Allow" — not
  "Added" or "Adds"), capitalized, no trailing period, ideally ≤ 72 chars.
- One logical change per commit — don't bundle an unrelated refactor into a
  feature commit.
- Body (when needed) explains **why**, not just what — the diff already
  shows what changed.
- Never commit secrets (`.env.local` is gitignored — keep it that way) or
  generated output (`.next/`, `node_modules/`, `coverage/`).

## Code comments

Write new comments in **English**, including in SQL (`supabase/schema.sql`,
migrations) and pgTAP tests — the older parts of the schema still carry
comments in Russian from the project's early history, and that split has
kept drifting rather than resolving on its own as new migrations landed in
either language depending on who wrote them. Don't go translate existing
Russian comments as a drive-by change (it adds diff noise to unrelated
PRs and risks losing nuance in the translation); just write anything you
add or touch going forward in English, so the split shrinks over time
instead of growing.

## Pull requests

- Every change lands via PR — no direct pushes to `main`.
- Keep PRs small and single-purpose (a natural consequence of one branch per
  change).
- PR description covers **Summary** (what/why) and **Test plan** (what was
  run/checked).
- Merge with a regular merge commit (`Merge <branch> into <target>`), not a
  squash — this repo's history preserves individual commits inside each
  merge so `git bisect`/`git blame` stay meaningful.
- CI (`.github/workflows/ci.yml`) must pass before merging: lint, type
  check, unit tests, build, and `check:schema`; the separate `pgtap` job
  covers the SQL RPC layer.

## Before opening a PR

Run locally:

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
npm run check:schema   # after any change under supabase/
```

## Rebasing & force-push

Avoid rewriting history on branches others may have pulled, and never
force-push to `main`. Rebasing your own not-yet-reviewed feature branch on
top of `main` to pick up recent changes is fine.
