# MedStock

A CRM for tracking medical consumables: calls, write-offs, stock levels, and reports.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Supabase Auth and PostgreSQL with RLS

## Running locally

Requires a supported Node.js LTS version (20.19+, 22.13+, or 24+) and a Supabase project.

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database

For a new project, run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. The schema creates the tables, RLS policies, and transactional RPCs for call operations — reference data (vehicles, bags, consumables) needs to be seeded separately afterward.

### Roles

Three access tiers: `master_admin`, `admin`, `medic`.

- **master_admin** — everything an admin can do, plus managing the roles of other organization members on the `/{lang}/users` page.
- **admin** — manages the main warehouse (`/inventory`), vehicles/bags (`/vehicles`), the movement log (`/movements`), reports (`/reports`), and can edit any call.
- **medic** — sees only the dashboard, calls, write-offs (`/writeoffs`), and team stock (`/team-stock`); can create and edit their own calls.

The first user is created with the `medic` role. The very first `master_admin` in an organization is assigned by hand via the SQL Editor:

```sql
update public.users set role = 'master_admin' where id = '<user-id>';
```

Every subsequent role change (between `admin` and `medic`) is done by a master_admin directly in the app, on the `/{lang}/users` page — the SQL Editor is no longer needed for that. A second `master_admin` can only be assigned the same way as the first, via the SQL Editor — this is intentionally not exposed in the app (one master_admin per organization).

### Multi-tenancy

All data (vehicles, bags, stock, calls, write-offs, movement log) belongs to an organization (`organizations`) and is isolated between organizations via RLS. On first run, `schema.sql` creates one organization with a fixed id of `11111111-1111-1111-1111-111111111111` and seeds test data into it.

**Creating a user now requires `organization_id`** in `raw_user_meta_data` — without it, `handle_new_user()` will roll back the transaction. When inviting via the Supabase Dashboard (Authentication → Add user), fill in the "User Metadata" field:

```json
{ "organization_id": "11111111-1111-1111-1111-111111111111", "name": "Jane Doe" }
```

Or via the Admin API:

```ts
await supabase.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: '11111111-1111-1111-1111-111111111111', name: 'Jane Doe' },
})
```

**Onboarding a new organization** — manually, via the SQL Editor:

```sql
insert into public.organizations (name) values ('Station name') returning id;
-- use the returned id for vehicles/bags/consumables and for inviting users
```

Then seed its `vehicles`/`bags`/`consumables` with that `organization_id` and invite users with the same id in their metadata.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run check:schema
```

`npm run check:schema` (`scripts/check-schema-sync.mjs`) diffs `supabase/schema.sql` against the latest state of every function/policy/trigger/column across `supabase/migrations/*.sql` — both files are maintained by hand in parallel, and this check catches the moment they drift apart. Run it after any change under `supabase/`, including after every new migration.

The UI is available in English (`/en/...`) and Ukrainian (`/uk/...`) — the language is detected automatically (`Accept-Language`) or chosen via the switcher in the sidebar and remembered in a cookie. There is no Russian localization.

Main routes: `/{lang}/dashboard`, `/{lang}/calls`, `/{lang}/writeoffs`, `/{lang}/team-stock`, `/{lang}/inventory`, `/{lang}/vehicles`, `/{lang}/movements`, `/{lang}/reports`, `/{lang}/users`.

The `/{lang}/movements` screen shows an automatically generated log of all stock changes. For an existing database, apply the SQL files under `supabase/migrations` in sequence.
