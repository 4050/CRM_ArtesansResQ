# МедСклад

CRM для учёта медицинских расходников: вызовы, списания, складские остатки и отчёты.

## Стек

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Supabase Auth и PostgreSQL с RLS

## Локальный запуск

Требуется поддерживаемая LTS-версия Node.js (20.19+, 22.13+ или 24+) и проект Supabase.

```bash
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`.

## Переменные окружения

Создайте `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## База данных

Для нового проекта выполните [`supabase/schema.sql`](supabase/schema.sql) в Supabase SQL Editor. Схема создаёт таблицы, RLS-политики и транзакционные RPC для операций с вызовами — справочники (машины, сумки, расходники) после этого нужно завести самостоятельно.

### Роли

Три уровня доступа: `master_admin`, `admin`, `medic`.

- **master_admin** — всё, что может admin, плюс управление ролями остальных участников организации на странице `/{lang}/users`.
- **admin** — управляет основным складом (`/inventory`), машинами/сумками (`/vehicles`), журналом движений (`/movements`), отчётами (`/reports`) и может редактировать любые вызовы.
- **medic** — видит только дашборд, вызовы, списания (`/writeoffs`) и склад команды (`/team-stock`); может создавать и редактировать собственные вызовы.

Первый пользователь создаётся с ролью `medic`. Самый первый master_admin в организации назначается вручную через SQL Editor:

```sql
update public.users set role = 'master_admin' where id = '<user-id>';
```

Все последующие изменения ролей (между `admin` и `medic`) master_admin делает прямо в приложении на странице `/{lang}/users` — SQL Editor для этого больше не нужен. Назначить второго `master_admin` можно только через SQL Editor тем же способом, что и первого — из приложения это не предусмотрено намеренно (один master_admin на организацию).

### Мультитенантность

Все данные (машины, сумки, склад, вызовы, списания, журнал движений) принадлежат организации (`organizations`) и изолированы между организациями через RLS. `schema.sql` при первом запуске сразу создаёт одну организацию с фиксированным id `11111111-1111-1111-1111-111111111111` и засевает тестовые данные в неё.

**Создание пользователя теперь обязательно требует `organization_id`** в `raw_user_meta_data` — без него `handle_new_user()` откатит транзакцию. При приглашении через Supabase Dashboard (Authentication → Add user) заполните поле "User Metadata":

```json
{ "organization_id": "11111111-1111-1111-1111-111111111111", "name": "Иван Иванов" }
```

Или через Admin API:

```ts
await supabase.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: '11111111-1111-1111-1111-111111111111', name: 'Иван Иванов' },
})
```

**Онбординг новой организации** — вручную через SQL Editor:

```sql
insert into public.organizations (name) values ('Название подстанции') returning id;
-- дальше используйте полученный id для vehicles/bags/consumables и приглашения пользователей
```

Затем засейте её `vehicles`/`bags`/`consumables` с этим `organization_id` и пригласите пользователей с ним же в метаданных.

## Проверки

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run check:schema
```

`npm run check:schema` (`scripts/check-schema-sync.mjs`) сверяет `supabase/schema.sql` с последней версией каждой функции/политики/триггера/колонки из `supabase/migrations/*.sql` — оба файла поддерживаются вручную параллельно, и эта проверка ловит момент, когда они расходятся. Запускайте её после любого изменения в `supabase/`, в том числе после каждой новой миграции.

Интерфейс доступен на английском (`/en/...`) и украинском (`/uk/...`) — язык определяется автоматически (`Accept-Language`) или выбирается переключателем в сайдбаре и запоминается в cookie. Русской локализации нет.

Основные маршруты: `/{lang}/dashboard`, `/{lang}/calls`, `/{lang}/writeoffs`, `/{lang}/team-stock`, `/{lang}/inventory`, `/{lang}/vehicles`, `/{lang}/movements`, `/{lang}/reports`, `/{lang}/users`.

Экран `/{lang}/movements` показывает автоматически формируемый журнал всех изменений складских остатков. Для существующей базы последовательно примените SQL-файлы из `supabase/migrations`.
