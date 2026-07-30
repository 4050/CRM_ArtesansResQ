# Contributing / Git workflow

This project uses **trunk-based development with a staging integration
branch**, borrowing from [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow),
[Conventional Commits](https://www.conventionalcommits.org/) discipline (without
the mandatory `type:` prefix — see below), and the standard PR-review model
used by most open-source and corporate teams. It's written down here so the
convention survives beyond any one contributor's memory.

## Branches

- **`main`** — the rollback-safe baseline. Only ever updated via a reviewed
  PR from the current integration branch. Never commit to it directly.
- **Integration branch** (currently `team-stock-warehouse`) — the active
  branch with its own PR open into `main`. Short-lived feature branches
  target this branch, not `main`, while it's active.
- **Feature/fix branches** — one branch per discrete, independently
  reviewable change. Branch off the *current tip* of the integration branch,
  do the work, open a PR back into it, then delete the branch once merged.

### Why one branch per change

A branch that mixes two unrelated changes (e.g. a UI fix and a new feature)
is harder to review, harder to revert in isolation, and harder to bisect
later. Keep each branch scoped to a single concern:

- Starting genuinely new work → branch from the integration branch's tip.
- A small follow-up to a change still under review → keep committing to that
  same branch/PR rather than spawning a new one.
- Need code that only exists on another unmerged branch (e.g. fixing a bug
  introduced by a feature that hasn't landed yet) → branch from *that*
  feature branch instead, and PR into it — not into the integration branch,
  since the integration branch doesn't have the code yet either.

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

## Pull requests

- Every change lands via PR — no direct pushes to `main` or the integration
  branch.
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
force-push to `main` or the integration branch. Rebasing your own
not-yet-reviewed feature branch on top of the integration branch to pick up
recent changes is fine.
