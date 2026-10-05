# Family Accounts PWA — Build Plan

Oct 5, 2026

> **In this repo:** run each roadmap step with its Antigravity workflow (`/a0-scaffold` … `/b6-handover` in `.agents/workflows/`) instead of pasting the prompts below. Progress lives in `docs/PROGRESS.md`; the design spec in `docs/DESIGN.md`.

## Overview and key decisions

The app is a bilingual (Arabic/English) household money tracker. It runs as an installable iPhone web app. It is built on Next.js 16, Supabase and Vercel, all on free tiers. It logs expenses, income and transfers offline. It syncs when the phone reconnects.

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Expenses, income and transfers across "wallets" (cash, bank, card) | All-round accounting without debits and credits jargon |
| Categories | Category → Subcategory → Item, editable in-app, separate trees for expense and income | Strict 3-tier hierarchy, enforced in the database |
| Language | Arabic (RTL, default) and English, switchable per user | next-intl with `/ar` and `/en` routes |
| Auth | Supabase email + password, public sign-up disabled, sessions never expire | They log in once on each phone, then never again |
| Sharing | One "household"; both in-laws see and edit the same books | Row Level Security scopes every row to the household |
| Editing | Full edit; deletes are soft and restorable for 30 days | Mistakes are always recoverable |
| Offline | Local IndexedDB copy + outbox queue, synced on reconnect | iOS Safari has no Background Sync API, so the app syncs on open/focus |
| PWA | Serwist service worker + iOS-specific install guide screen | `next-pwa` is unmaintained and needs webpack |
| Uptime | Daily GitHub Action + daily Vercel cron calling the database | Free Supabase projects pause after 7 days of low activity |
| Cost | $0/month | Supabase Free, Vercel Hobby, GitHub Free |

The main trade-off is that offline support makes data entry "local-first". The Add, Edit and History screens read and write the phone's local copy first, then sync. The Dashboard uses database views when online and shows the last synced numbers when offline.

## Before you start (manual, about 30 minutes)

Create every account under one dedicated email that the family owns. You are added as a collaborator, so the handover is just you leaving.

- [ ] Create a dedicated Gmail, for example `family.accounts.app@gmail.com`. Store its password with your in-laws or in a shared family password manager.
- [ ] Create a **GitHub** account with that email and a **private** repo, `family-accounts`. Add your own GitHub account as a collaborator.
- [ ] Create a **Supabase** account with that email (sign in with GitHub). Create one Free project in the region nearest Egypt, for example `eu-central-1` (Frankfurt). Save the database password.
- [ ] Create a **Vercel** Hobby account by signing in with the dedicated GitHub account.
- [ ] In Supabase, open **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up" and turn **off** "Confirm email". You will create the two users by hand.
- [ ] In Antigravity, connect the MCP servers: **Supabase** (scoped to this one project, with read-write access) and **GitHub**. Optionally add **Vercel**. Use a personal access token from the dedicated accounts, not your own.
- [ ] Install Node.js 20.9 or newer locally. Next.js 16 requires it.

The Supabase MCP has `apply_migration`, `execute_sql`, `generate_typescript_types` and `get_advisors`. The roadmap prompts use all four.

## Architecture

The phone writes to its own local database first, and a sync engine pushes changes to Supabase whenever there is a connection. Row Level Security in Postgres is the only gatekeeper, so the app needs no custom API server.

```text
┌──────────── iPhone (installed app) ────────────┐        ┌──────── Supabase (Free) ────────┐
│  Screens: Home · History · Reports · Settings   │        │  Auth + Row Level Security      │
│                    │                            │  sync  │               │                 │
│  lib/data repository (mock or live)             │ ─────► │  Postgres tables + views        │
│                    │                            │        └───────────────▲─────────────────┘
│  Local copy + outbox (IndexedDB / Dexie)        │                        │ daily keep-alive
└─────────────────────────────────────────────────┘          Vercel cron · GitHub Action
```

The screens only ever talk to the repository. Swapping sample data for Supabase in Phase B changes nothing above it.

**Rules the agent must follow (these go into `AGENTS.md`):**

1. **Data writes go through the browser Supabase client.** Do not use Server Actions for writes, because those cannot queue offline. RLS protects every table.
2. **Server Components are used only for the login redirect and the Dashboard's first render.** Everything else is a Client Component reading from IndexedDB.
3. **IDs are UUIDs generated on the phone** (`crypto.randomUUID()`). A queued insert can then be retried safely as an `upsert` without making duplicates.
4. **Money is stored as `numeric(14,2)`**, never float. It is formatted with `Intl.NumberFormat` in EGP.
5. **Arabic is the default locale.** Layout uses Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`), never `ml-`/`mr-`/`left`/`right`, so RTL works for free.
6. **The amount input accepts Arabic-Indic digits** (٠١٢٣٤٥٦٧٨٩) and the Arabic decimal separator (٫), normalising them to Western digits before saving. The iPhone Arabic keyboard types these.
7. **Tap targets are at least 48 px tall** and body text is at least 18 px. One primary action per screen, with no hover-only UI.

**Screens (bottom tab bar, 4 tabs):** Home (this month at a glance + big "Add" button) · History (entries grouped by day, tap to edit) · Reports (dashboard + simple pivot "Breakdown" tables) · Settings (categories, wallets, language, export, sign out).

**UI-first rule.** All screens talk to a `lib/data` repository interface, never to Supabase directly. Phase A implements it with sample data stored on the phone. Phase B swaps in Supabase and offline sync behind the same interface. Then the approved UI does not change when the database arrives.

## Design direction (make-or-break)

The app should feel like a calm, premium banking app, not a form. The bar is "looks like it came from the App Store". Nothing moves to Phase B until both in-laws have used the sample-data version on their own iPhones and like it.

**Look and feel**

- **One typeface for both scripts:** IBM Plex Sans Arabic via `next/font/google`. It has matching Arabic and Latin letterforms, so mixed text looks deliberate. Use tabular numerals for all amounts.
- **Palette:** warm off-white surfaces (`#FAF8F5`), near-black ink (`#1C1917`), one deep accent (emerald `#0F766E`) for primary actions and income, and a muted terracotta (`#C2410C`) for expenses. Expenses are not alarm red, because spending is normal. Full dark mode is driven by iOS settings.
- **Category identity:** each category gets a colour and a Lucide icon, shown in a soft tinted circle. People recognise "the green house icon" faster than text.
- **Hierarchy:** one hero number per screen (this month's spending, 48–56 px), cards with 20–24 px radius, generous spacing, and no tables or grid lines anywhere.
- **Motion:** short, purposeful transitions (150–250 ms) such as sheets sliding up, a checkmark on save, and numbers counting up on the dashboard. Respect "Reduce Motion".

**Signature interactions**

1. **Add entry = one bottom sheet, three taps.** Big on-screen number pad (like Apple Cash, no iOS keyboard) → tap a category tile → tap subcategory → tap item → Save. Date defaults to today, with "Today / Yesterday / Pick" chips. Wallet defaults to the last used one.
2. **Recents first:** the 6 most-used items appear as one-tap tiles above the category grid, so most entries take 2 taps after the amount.
3. **Undo, not "Are you sure?":** every save, edit and delete shows a toast with a large Undo button for 6 seconds.
4. **Sync status is quiet:** a small cloud dot reads "Saved on phone" or "Synced". Never show an error dialog for being offline.

**Component stack:** Tailwind CSS v4 · shadcn/ui (Radix primitives, restyled to the palette above) · Vaul (iOS-style drawers) · Motion (`motion/react`) · Lucide icons · Recharts (dashboard) · Sonner (toasts).

**Design review loop (every UI prompt):** the agent opens the page in Antigravity's browser at iPhone size (390×844) in both Arabic and English, takes screenshots, critiques them against this section, and fixes issues before reporting done. You then check the Vercel preview on a real iPhone.

**Optional head start:** before prompt A2, mock the 4 key screens visually (Home, Add sheet, History, Reports). Then give the screenshots to the agent as the target.

## Reports and simple pivots

Reports has two tabs: **Overview** (the dashboard) and **Breakdown** (simple pivot tables). Every pivot is built from two plain-language choices, never drag-and-drop fields.

**How a Breakdown works**

1. **Show:** Spending · Income · Both (net).
2. **Split by** (rows): Category · Subcategory · Item · Wallet · Person who entered it.
3. **Across** (columns): Months · Weeks · Wallets · Nothing (a single total column).
4. **Period:** This month · Last 3 months · Last 6 months · This year · Custom.

Each choice is a row of large chips at the top of the screen, with no menus. The table below updates instantly.

**Ready-made pivots** (one tap, shown as cards above the chips):

| Preset | Split by | Across | Period |
| --- | --- | --- | --- |
| Where did our money go? | Category | Nothing | This month |
| Month by month | Category | Months | Last 6 months |
| Bills tracker | Item (Utilities only) | Months | This year |
| Which wallet? | Wallet | Months | Last 3 months |
| Who spent what | Person | Category | This month |

**How the table looks** (not a spreadsheet):

- The first column stays fixed and shows the category icon + name. Other columns scroll sideways with momentum.
- There is a **Total** row at the bottom and a **Total** column at the end, both bold.
- Cells get a soft heat tint (darker = bigger amount), so the big numbers stand out without reading every cell.
- Amounts are rounded to whole pounds in the grid. Zero shows as a faint dash.
- Tapping a row drills in one level (Category → Subcategory → Item) with a breadcrumb back. Tapping a cell opens a sheet listing the entries behind that number.
- On a phone, at most 4 columns are visible. More scroll sideways, with the newest month nearest the row labels (the start side in RTL).
- A "Share" button exports the current pivot as CSV or as an image for WhatsApp.

**Where it runs:** pivots are computed on the phone from the local Dexie mirror (`lib/reports/pivot.ts`), not on the server. They work offline and respond instantly. A household's few thousand rows a year take milliseconds.

## Database schema

The schema is one migration with 8 tables and 4 views. The 3-tier hierarchy and the household boundary are both enforced by composite foreign keys, so a transaction can never point at another household's item. It is applied in Phase B (prompt B1) through the Supabase MCP `apply_migration`, saved as `supabase/migrations/0001_schema.sql`.

Key rules baked in:

- A transaction stores only the **leaf** (`item_id`). Its subcategory and category are derived, so they can never disagree.
- Expense/income entries must have an item. Transfers must have a destination wallet and no item. A trigger checks that the item's category kind matches the entry type.
- There is **no delete permission** for app users. Entries are soft-deleted (`deleted_at`) and purged after 30 days. Categories and wallets are archived (`is_archived`).
- Names are stored as `name_ar` + `name_en`. User-added names fill the current language's column, and the UI falls back to the other.
- All views use `security_invoker = true`, so RLS still applies through them.

```sql
-- =========================================================
-- 0001_schema.sql  ·  Family Accounts
-- =========================================================

-- ---------- Types ----------
create type public.category_kind as enum ('expense', 'income');
create type public.txn_type      as enum ('expense', 'income', 'transfer');
create type public.account_type  as enum ('cash', 'bank', 'card', 'wallet');

-- ---------- Households & members ----------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  currency   char(3) not null default 'EGP',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  locale       text not null default 'ar' check (locale in ('ar', 'en')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- RLS helper: is the signed-in user a member of this household?
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- ---------- Wallets (accounts) ----------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  name_ar         text,
  name_en         text,
  type            public.account_type not null default 'cash',
  opening_balance numeric(14,2) not null default 0,
  icon            text,
  color           text,
  sort_order      int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id)
);

-- ---------- 3-tier categories ----------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind         public.category_kind not null,
  name_ar      text,
  name_en      text,
  icon         text,
  color        text,
  sort_order   int not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id)
);

create table public.subcategories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  category_id  uuid not null,
  name_ar      text,
  name_en      text,
  sort_order   int not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id),
  foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete restrict
);
create index subcategories_category_idx on public.subcategories (category_id);

create table public.items (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null,
  subcategory_id uuid not null,
  name_ar        text,
  name_en        text,
  sort_order     int not null default 0,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id),
  foreign key (household_id, subcategory_id)
    references public.subcategories (household_id, id) on delete restrict
);
create index items_subcategory_idx on public.items (subcategory_id);

-- ---------- Transactions ----------
create table public.transactions (
  id            uuid primary key default gen_random_uuid(), -- normally generated on the phone
  household_id  uuid not null references public.households(id) on delete cascade,
  type          public.txn_type not null,
  amount        numeric(14,2) not null check (amount > 0),
  occurred_on   date not null default current_date,
  account_id    uuid not null,
  to_account_id uuid,
  item_id       uuid,
  note          text check (char_length(note) <= 500),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  foreign key (household_id, account_id)    references public.accounts (household_id, id),
  foreign key (household_id, to_account_id) references public.accounts (household_id, id),
  foreign key (household_id, item_id)       references public.items    (household_id, id),
  constraint txn_shape check (
    (type in ('expense', 'income') and item_id is not null and to_account_id is null)
    or
    (type = 'transfer' and item_id is null and to_account_id is not null
                       and to_account_id <> account_id)
  )
);
create index transactions_list_idx on public.transactions (household_id, occurred_on desc)
  where deleted_at is null;
create index transactions_sync_idx on public.transactions (household_id, updated_at);

-- ---------- Triggers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.set_txn_audit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger accounts_touch      before update on public.accounts      for each row execute function public.set_updated_at();
create trigger categories_touch    before update on public.categories    for each row execute function public.set_updated_at();
create trigger subcategories_touch before update on public.subcategories for each row execute function public.set_updated_at();
create trigger items_touch         before update on public.items         for each row execute function public.set_updated_at();
create trigger transactions_audit  before insert or update on public.transactions for each row execute function public.set_txn_audit();

-- Item's category kind must match the entry type
create or replace function public.check_txn_kind()
returns trigger language plpgsql set search_path = ''
as $$
declare k public.category_kind;
begin
  if new.type = 'transfer' then return new; end if;
  select c.kind into k
  from public.items i
  join public.subcategories s on s.id = i.subcategory_id
  join public.categories   c on c.id = s.category_id
  where i.id = new.item_id;
  if k is null or k::text <> new.type::text then
    raise exception 'Item category kind (%) does not match entry type (%)', k, new.type
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger transactions_kind before insert or update on public.transactions
  for each row execute function public.check_txn_kind();

-- ---------- Row Level Security ----------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;

create policy "members read household" on public.households
  for select to authenticated using (public.is_member(id));
create policy "members rename household" on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "members see co-members" on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy "edit own profile" on public.household_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Same three policies on every data table. No DELETE policy = no hard deletes.
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','subcategories','items','transactions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "household select" on public.%I for select to authenticated using (public.is_member(household_id))', t);
    execute format('create policy "household insert" on public.%I for insert to authenticated with check (public.is_member(household_id))', t);
    execute format('create policy "household update" on public.%I for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- ---------- Views (RLS-aware) ----------
create view public.v_transactions with (security_invoker = true) as
select
  t.id, t.household_id, t.type, t.amount, t.occurred_on, t.note,
  t.account_id, a.name_ar as account_name_ar, a.name_en as account_name_en,
  t.to_account_id,
  t.item_id,        i.name_ar as item_name_ar,        i.name_en as item_name_en,
  s.id as subcategory_id, s.name_ar as subcategory_name_ar, s.name_en as subcategory_name_en,
  c.id as category_id,    c.name_ar as category_name_ar,    c.name_en as category_name_en,
  c.icon as category_icon, c.color as category_color,
  t.created_by, t.created_at, t.updated_at
from public.transactions t
join public.accounts a        on a.household_id = t.household_id and a.id = t.account_id
left join public.items i         on i.id = t.item_id
left join public.subcategories s on s.id = i.subcategory_id
left join public.categories c    on c.id = s.category_id
where t.deleted_at is null;

create view public.v_monthly_category_totals with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  type,
  category_id, category_name_ar, category_name_en, category_icon, category_color,
  sum(amount)::numeric(14,2) as total,
  count(*)                   as entries
from public.v_transactions
where type in ('expense', 'income')
group by 1, 2, 3, 4, 5, 6, 7, 8;

create view public.v_monthly_summary with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(sum(amount) filter (where type = 'income'),  0)::numeric(14,2) as income,
  coalesce(sum(amount) filter (where type = 'expense'), 0)::numeric(14,2) as expense,
  (coalesce(sum(amount) filter (where type = 'income'),  0)
   - coalesce(sum(amount) filter (where type = 'expense'), 0))::numeric(14,2) as net
from public.transactions
where deleted_at is null and type <> 'transfer'
group by 1, 2;

create view public.v_account_balances with (security_invoker = true) as
select
  a.id as account_id, a.household_id, a.name_ar, a.name_en, a.type, a.icon, a.color, a.is_archived,
  (a.opening_balance + coalesce(sum(
     case
       when t.type = 'income'   and t.account_id    = a.id then  t.amount
       when t.type = 'expense'  and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.to_account_id = a.id then  t.amount
     end), 0))::numeric(14,2) as balance
from public.accounts a
left join public.transactions t
  on t.household_id = a.household_id
 and t.deleted_at is null
 and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;

-- ---------- Default categories (bilingual) ----------
create or replace function public.seed_defaults(hid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  tree jsonb := $json$[
    {"kind":"expense","en":"Household","ar":"المنزل","icon":"house","color":"#0F766E","subs":[
      {"en":"Utilities","ar":"المرافق","items":[["Electricity","كهرباء"],["Water","مياه"],["Gas","غاز"],["Internet","إنترنت"],["Mobile","موبايل"]]},
      {"en":"Rent & upkeep","ar":"إيجار وصيانة","items":[["Rent","إيجار"],["Repairs","تصليحات"],["Building fees","مصاريف العمارة"]]}]},
    {"kind":"expense","en":"Food","ar":"الطعام","icon":"shopping-basket","color":"#B45309","subs":[
      {"en":"Groceries","ar":"البقالة","items":[["Supermarket","سوبرماركت"],["Vegetables & fruit","خضار وفاكهة"],["Meat & poultry","لحوم ودواجن"],["Bread","عيش"]]},
      {"en":"Eating out","ar":"أكل برّه","items":[["Restaurants","مطاعم"],["Delivery","دليفري"]]}]},
    {"kind":"expense","en":"Transport","ar":"المواصلات","icon":"car","color":"#1D4ED8","subs":[
      {"en":"Car","ar":"العربية","items":[["Fuel","بنزين"],["Maintenance","صيانة"],["Parking","ركنة"]]},
      {"en":"Rides","ar":"مشاوير","items":[["Taxi & ride apps","تاكسي وتطبيقات"]]}]},
    {"kind":"expense","en":"Health","ar":"الصحة","icon":"heart-pulse","color":"#BE123C","subs":[
      {"en":"Medical","ar":"طبي","items":[["Pharmacy","صيدلية"],["Doctor","دكتور"],["Lab tests","تحاليل"]]}]},
    {"kind":"expense","en":"Family","ar":"العائلة","icon":"users","color":"#7C3AED","subs":[
      {"en":"Gifts & occasions","ar":"هدايا ومناسبات","items":[["Gifts","هدايا"],["Charity","صدقات"]]}]},
    {"kind":"income","en":"Income","ar":"الدخل","icon":"wallet","color":"#15803D","subs":[
      {"en":"Regular","ar":"دخل ثابت","items":[["Pension","معاش"],["Salary","مرتب"],["Rent received","إيجار"]]},
      {"en":"Other","ar":"أخرى","items":[["Gifts received","هدايا"],["Other","أخرى"]]}]}
  ]$json$;
  c jsonb; s jsonb; i jsonb;
  cid uuid; sid uuid;
  ci int := 0; si int; ii int;
begin
  for c in select value from jsonb_array_elements(tree) loop
    insert into public.categories (household_id, kind, name_en, name_ar, icon, color, sort_order)
    values (hid, (c->>'kind')::public.category_kind, c->>'en', c->>'ar', c->>'icon', c->>'color', ci)
    returning id into cid;
    ci := ci + 1; si := 0;
    for s in select value from jsonb_array_elements(c->'subs') loop
      insert into public.subcategories (household_id, category_id, name_en, name_ar, sort_order)
      values (hid, cid, s->>'en', s->>'ar', si)
      returning id into sid;
      si := si + 1; ii := 0;
      for i in select value from jsonb_array_elements(s->'items') loop
        insert into public.items (household_id, subcategory_id, name_en, name_ar, sort_order)
        values (hid, sid, i->>0, i->>1, ii);
        ii := ii + 1;
      end loop;
    end loop;
  end loop;
end $$;

-- ---------- Onboarding RPCs ----------
create or replace function public.create_household(
  p_name text, p_display_name text, p_locale text default 'ar')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Already in a household';
  end if;
  insert into public.households (name) values (p_name) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, role, locale)
  values (hid, auth.uid(), p_display_name, 'owner', p_locale);
  insert into public.accounts (household_id, name_en, name_ar, type, icon)
  values (hid, 'Cash', 'كاش', 'cash', 'banknote');
  perform public.seed_defaults(hid);
  return hid;
end $$;

create or replace function public.add_member(p_email text, p_display_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid; uid uuid;
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the owner can add members'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No user with that email exists yet'; end if;
  insert into public.household_members (household_id, user_id, display_name)
  values (hid, uid, p_display_name) on conflict do nothing;
end $$;

-- ---------- Keep-alive heartbeat (called by GitHub Action + Vercel cron) ----------
create table public.heartbeat (
  id        int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);
alter table public.heartbeat enable row level security; -- no policies: only the function writes

create or replace function public.keepalive()
returns timestamptz language sql volatile security definer set search_path = ''
as $$
  insert into public.heartbeat (id, pinged_at) values (1, now())
  on conflict (id) do update set pinged_at = now()
  returning pinged_at;
$$;

-- ---------- Grants ----------
-- Supabase grants ALL on new tables by default; start from zero, then grant exactly what's needed.
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.accounts, public.categories, public.subcategories,
  public.items, public.transactions to authenticated;
grant select on public.households, public.household_members to authenticated;
grant update (name) on public.households to authenticated;
grant update (display_name, locale) on public.household_members to authenticated;
grant select on public.v_transactions, public.v_monthly_category_totals,
  public.v_monthly_summary, public.v_account_balances to authenticated;

revoke execute on function public.seed_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.create_household(text, text, text) from public, anon;
revoke execute on function public.add_member(text, text) from public, anon;
grant  execute on function public.is_member(uuid), public.create_household(text, text, text),
  public.add_member(text, text) to authenticated;
revoke execute on function public.keepalive() from public;
grant  execute on function public.keepalive() to anon, authenticated;
```

**Optional, recommended: automatic purge of old deleted entries** (`0002_purge.sql`). Enable the Cron integration in the Supabase dashboard first if the `create extension` line fails.

```sql
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-deleted-transactions', '0 3 * * *',
  $$ delete from public.transactions where deleted_at < now() - interval '30 days' $$
);
```

**One-time user setup.** In Supabase, go to Authentication → Users → "Add user", tick auto-confirm, and do this for both in-laws. On first login the app's welcome screen calls `create_household`. The owner then adds the second person from Settings → Family, which calls `add_member`.

## Project structure

The app lives in `src/` with locale-prefixed routes, a repository layer that hides where data comes from, and an offline engine kept apart from the UI.

```text
family-accounts/
├── AGENTS.md                      # Rules Antigravity reads before every task
├── docs/PLAN.md                   # This plan (exported from this doc)
├── proxy.ts                       # Next 16 proxy: locale routing + Supabase session refresh
├── next.config.ts                 # next-intl + Serwist wrappers
├── messages/
│   ├── ar.json                    # All UI strings, Arabic (default)
│   └── en.json
├── public/
│   ├── icons/                     # 192, 512, maskable 512, apple-touch-icon 180
│   └── splash/                    # iOS startup images (generated)
├── supabase/
│   └── migrations/0001_schema.sql, 0002_purge.sql
├── .github/workflows/
│   ├── keepalive.yml              # Daily DB ping
│   └── backup.yml                 # Weekly pg_dump artifact
├── vercel.json                    # Daily cron → /api/keepalive
└── src/
    ├── app/
    │   ├── manifest.ts            # Web app manifest
    │   ├── sw.ts                  # Serwist service worker source
    │   ├── api/keepalive/route.ts # Cron target, calls keepalive()
    │   ├── ~offline/page.tsx      # Fallback when a page isn't cached
    │   └── [locale]/
    │       ├── layout.tsx         # <html lang dir>, fonts, providers, iOS meta
    │       ├── login/page.tsx
    │       ├── welcome/page.tsx   # First-run: name household (create_household)
    │       ├── install/page.tsx   # iPhone "Add to Home Screen" guide
    │       └── (app)/
    │           ├── layout.tsx     # Bottom tab bar, sync dot, auth guard
    │           ├── page.tsx       # Home
    │           ├── history/page.tsx
    │           ├── reports/page.tsx
    │           └── settings/
    │               ├── page.tsx
    │               ├── categories/page.tsx          # Tier 1
    │               ├── categories/[id]/page.tsx     # Tiers 2–3
    │               ├── wallets/page.tsx
    │               └── family/page.tsx              # add_member
    ├── components/
    │   ├── ui/                    # shadcn/ui primitives, restyled
    │   ├── layout/                # TabBar, ScreenHeader, SyncDot, SafeArea
    │   ├── entry/                 # EntrySheet, AmountPad, TypeToggle,
    │   │                          # CategoryPicker (3-step), DateChips, WalletPicker
    │   ├── history/               # DayGroup, EntryRow, UndoToast
    │   ├── reports/               # MonthSwitcher, HeroTotal, CategoryDonut, CategoryBars
    │   └── settings/              # TreeEditor, ColorIconPicker
    ├── lib/
    │   ├── data/
    │   │   ├── types.ts           # Domain types (Entry, Category, Wallet…)
    │   │   ├── repository.ts      # Interface every screen uses
    │   │   ├── mock-repository.ts # Phase A: sample data in IndexedDB
    │   │   └── live-repository.ts # Phase B: Dexie + outbox + Supabase
    │   ├── offline/
    │   │   ├── db.ts              # Dexie schema (mirror tables + outbox)
    │   │   ├── outbox.ts          # Queue writes
    │   │   └── sync.ts            # Push outbox, pull changes since cursor
    │   ├── supabase/
    │   │   ├── client.ts          # createBrowserClient (@supabase/ssr)
    │   │   ├── server.ts          # createServerClient for RSC
    │   │   └── database.types.ts  # Generated by Supabase MCP
    │   ├── format/                # money(), date(), normalizeDigits()
    │   └── validation/            # zod schemas for entry/category forms
    └── i18n/
        ├── routing.ts             # locales ['ar','en'], default 'ar'
        └── request.ts
```

**Packages:** `next@16 react@19 tailwindcss@4 next-intl @supabase/supabase-js @supabase/ssr dexie dexie-react-hooks zod vaul motion lucide-react recharts sonner @serwist/turbopack serwist esbuild` plus `shadcn` (CLI).

**Environment variables** (Vercel + `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy anon key also works), `NEXT_PUBLIC_DATA_MODE=mock|live`, `CRON_SECRET`.

## Offline strategy

Every save lands in the phone's IndexedDB instantly and is pushed to Supabase later. The user never waits on the network and never sees an offline error.

1. **Local mirror (Dexie).** Tables `categories`, `subcategories`, `items`, `accounts`, `transactions` mirror the server rows, plus `outbox` and `meta` (sync cursor). A household's data is small: a few thousand rows a year fits easily.
2. **Writes.** Every add, edit or delete writes the local row and appends an outbox entry `{id, table, op: 'upsert', row, attempts}` in one Dexie transaction. Deletes are upserts that set `deleted_at`. Archives set `is_archived`.
3. **Push.** `sync()` sends outbox rows in order with `supabase.from(table).upsert(row)`. Client-made UUIDs make retries safe. On success the entry is removed. On error, attempts increase with backoff. A row rejected by the database (for example a check constraint) is kept and flagged in Settings → "Needs attention" instead of being dropped.
4. **Pull.** It fetches rows with `updated_at > cursor − 5 minutes` from each table and bulk-puts them into Dexie. The 5-minute overlap covers clock skew and in-flight writes.
5. **When it runs.** Sync runs on app open, on `visibilitychange` to visible, on the `online` event, and after every local write when online. iOS Safari does not support the Background Sync API, so syncing happens only while the app is open. That is fine because they open it to log an entry.
6. **Conflicts.** The last write to reach the server wins. With two people editing the same entry rarely, this is acceptable and much simpler than merging.
7. **Order matters.** If a category is created offline and used right away, its outbox entry is queued first, so the foreign keys are satisfied when pushed in order.
8. **Auth offline.** The Supabase session is kept in storage. An expired access token simply refreshes on the next online sync, and queued writes wait. The proxy only redirects to login when online and the session is truly gone.
9. **Dashboard offline.** The Overview tab reads the server views when online and cache the result in Dexie `meta`. Offline, they show the cached numbers with a subtle "as of \<time>" label.

Home-screen web apps on iOS are not subject to Safari's 7-day storage eviction for websites, so the local data persists. The data always lives on the server too.

## PWA setup for iPhone

Use **Serwist**, not `next-pwa`. `next-pwa` is unmaintained and needs webpack, while Next.js 16 builds with Turbopack by default ([source](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)). Serwist has a Turbopack package, `@serwist/turbopack`, that serves the worker from a route handler ([Serwist Turbopack guide](https://serwist.pages.dev/docs/next/turbo)).

**1. Install:** `npm i -D @serwist/turbopack esbuild serwist`. If the Turbopack package gives trouble, the fallback is `@serwist/next` with `next build --webpack` ([webpack guide](https://serwist.pages.dev/docs/next/getting-started)). The agent should read the current guide before writing code.

**2. Service worker (`src/app/sw.ts`):** precache the app shell. Use NetworkFirst for page navigations with the cache as fallback, so cached screens open offline. Use CacheFirst for fonts and icons. Never cache `*.supabase.co` responses, because Dexie handles data. Set the fallback document to `/~offline`.

**3. Manifest (`src/app/manifest.ts`):**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'حساباتنا · Family Accounts',
    short_name: 'حساباتنا',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F5',
    theme_color: '#FAF8F5',
    dir: 'rtl',
    lang: 'ar',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

**4. iOS metadata (`src/app/[locale]/layout.tsx`):**

```ts
export const metadata: Metadata = {
  applicationName: 'حساباتنا',
  appleWebApp: { capable: true, title: 'حساباتنا', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/icons/apple-touch-icon.png' }, // 180×180, no transparency
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,          // stops iOS zooming into inputs
  viewportFit: 'cover',     // draw under the notch; pad with env(safe-area-inset-*)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F5' },
    { media: '(prefers-color-scheme: dark)',  color: '#1C1917' },
  ],
};
```

**5. iPhone-specific polish:**

- Pad the tab bar and sheets with `env(safe-area-inset-bottom)` so they clear the home indicator.
- Set every input's font size to at least 16 px. Smaller sizes make iOS zoom in on focus.
- Generate iOS splash screens and icons with `npx pwa-asset-generator logo.svg public/splash --splash-only --background "#FAF8F5"`. Without them, a white flash appears on launch.
- Use `overscroll-behavior: none` on the body and no `100vh`; use `100dvh` instead.

**6. Install guide screen (`/install`):** iPhones never show an automatic install prompt. Detect iOS that is not in standalone mode (`navigator.standalone !== true`). Then show a friendly 3-step illustrated guide in Arabic: tap Share → "Add to Home Screen" → Add. Link it from the login page.

**Important for handover:** the installed app has its own storage, separate from Safari. **Install first, then log in inside the installed app.** Logging in through Safari does not carry over.

## Keep-alive and backups

Two independent daily pings keep the free Supabase project awake, and a weekly dump plus in-app CSV export protect the data. Supabase pauses Free projects that show low activity over 7 days, and a few database requests a day are typically enough to prevent it ([Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Each ping calls `keepalive()`, which writes a real row, so it counts as database activity.

**Ping 1: GitHub Action** (`.github/workflows/keepalive.yml`). Add repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

```yaml
name: Keep Supabase awake
on:
  schedule:
    - cron: '17 6 * * *'   # daily, 09:17 Cairo
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call keepalive()
        run: |
          code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/keepalive" \
            -H "apikey: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}" \
            -H "Content-Type: application/json" -d '{}')
          echo "HTTP $code"
          test "$code" = "200"   # a failed run emails the repo owner
```

**Ping 2: Vercel cron** (independent of GitHub). Hobby plans allow daily crons.

```json
// vercel.json
{ "crons": [{ "path": "/api/keepalive", "schedule": "43 18 * * *" }] }
```

`src/app/api/keepalive/route.ts` checks `Authorization: Bearer ${CRON_SECRET}`, calls `supabase.rpc('keepalive')`, sets `export const dynamic = 'force-dynamic'`, and returns the timestamp.

**Backup: weekly database dump** (`.github/workflows/backup.yml`). Add the secret `SUPABASE_DB_URL`, which is the **Session pooler** connection string. GitHub runners use IPv4, so the direct connection does not work. Use `supabase/setup-cli@v1`, then `supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql` and `supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f data.sql`. Upload both files with `actions/upload-artifact@v4` and `retention-days: 90`. Schedule it every Sunday. The repo must stay **private** because the dump contains their finances.

**Backup: in-app export.** Settings → "Download my data (CSV)" exports all entries with category names in the current language. It opens directly in Excel or Numbers.

If the project ever pauses anyway, the owner gets an email from Supabase and can press "Resume project" in the dashboard. The data is kept.

## Execution roadmap

The build runs as 16 prompts in two phases. Phase A builds and polishes the entire interface on sample data. Phase B connects the real database behind it. Do not start Phase B until the family has approved Phase A on their own iPhones.

**How to run each prompt in Antigravity**

- Start a **new agent conversation per prompt**. The project memory lives in `AGENTS.md` and `docs/PLAN.md`, not in chat history, so context never overflows.
- Each prompt ends with the same "definition of done": screenshots at 390×844 in Arabic and English, a self-critique against the Design direction, a commit, a push, and the Vercel preview link.
- After each prompt, open the preview on your iPhone. If something looks off, fix it in the same conversation before moving on.

### Phase A: Interface on sample data

**A0 · Scaffold and deploy**

```text
Create a Next.js 16 App Router project (TypeScript, Tailwind v4, src/ dir, ESLint) in this repo.
Save docs/PLAN.md from the plan I paste below. Then write AGENTS.md containing: the 7 rules in
"Architecture", the UI-first rule, the whole "Design direction" section, and this definition of done:
"Before reporting done: open every changed screen in the browser at 390x844 in /ar and /en,
screenshot, critique against Design direction, fix, then commit, push, and give the Vercel preview URL."
Set up next-intl with locales ['ar','en'], default 'ar', <html dir> set per locale, using proxy.ts
(Next 16 naming). Create messages/ar.json and en.json. Add a placeholder home page.
Connect the repo to Vercel and confirm a production deploy works. Do not touch Supabase yet.
[paste this whole doc exported as Markdown]
```

**A1 · Design system**

```text
Read AGENTS.md. Build the design system only:
- IBM Plex Sans Arabic via next/font, tabular numerals utility
- Tailwind v4 theme tokens for the palette in Design direction, light + dark (prefers-color-scheme)
- shadcn/ui init, then add and restyle: button, card, input, sheet/drawer (use vaul), tabs, switch,
  dropdown-menu, dialog, skeleton; sonner toasts
- money() and normalizeDigits() helpers in src/lib/format with unit tests
- A /[locale]/styleguide page showing every token, type size, component state, and a sample
  entry card, in both themes
Only logical Tailwind classes (ms/me/ps/pe/start/end).
```

**A2 · App shell and sample data**

```text
Read AGENTS.md and the Architecture + Project structure sections of docs/PLAN.md.
1. src/lib/data/types.ts and repository.ts: an interface covering categories (3 tiers),
   wallets, entries (expense/income/transfer, soft delete), monthly summaries and category totals.
2. mock-repository.ts: store in IndexedDB via Dexie, seed with the default bilingual
   category tree from the SQL seed in docs/PLAN.md, 2 wallets, and ~120 realistic Egyptian
   household entries over the last 3 months (EGP amounts).
3. Pick the repository by NEXT_PUBLIC_DATA_MODE (default 'mock'). Expose it via a React context + hooks.
4. (app)/layout.tsx: bottom tab bar with Home, History, Reports, Settings (Lucide icons,
   labels, safe-area padding), a quiet sync dot, page transitions with motion.
5. Home screen: greeting, hero "spent this month" figure, income vs spending mini-summary,
   last 5 entries, and a large floating Add button (opens nothing yet).
```

**A3 · Add-entry sheet (the most important screen)**

```text
Read AGENTS.md and "Signature interactions" in docs/PLAN.md. Build EntrySheet as a vaul drawer:
- Type toggle: Expense / Income / Transfer (segmented control, expense default)
- AmountPad: custom on-screen keypad, large live amount display in EGP, backspace, decimal,
  respects locale digits for display; never opens the iOS keyboard
- CategoryPicker: step 1 category tiles (icon in tinted circle), step 2 subcategory list,
  step 3 item list, breadcrumb to go back, "+ New" at each step to add inline; a Recents row
  of the 6 most-used items shown above step 1
- Transfer mode replaces the picker with From wallet -> To wallet
- DateChips: Today / Yesterday / Pick (native date input)
- Wallet selector defaulting to last used, optional note field
- Save: validation with zod, success checkmark animation, toast with Undo (6s)
Open it from the Home Add button. Save through the repository.
```

**A4 · History and editing**

```text
Read AGENTS.md. Build History: entries grouped by day with day totals, sticky day headers,
month switcher at top, filter chips (All / Expenses / Income), and an empty state with an
illustration. Tapping an entry opens the same EntrySheet in edit mode with a Delete button.
Delete is a soft delete with an Undo toast. Add Settings > "Recently deleted" listing the last
30 days with Restore.
```

**A5 · Reports dashboard**

```text
Read AGENTS.md. Build Reports (read-only): month switcher; hero card with spent, income and net;
a donut of spending by category (Recharts, category colours) with the total in the centre;
a ranked list of categories with amount, % and a thin bar; tap a category to drill into its
subcategories and items; a 6-month bar chart of spending vs income; wallet balances card.
Numbers count up on load. Must read clearly at a glance for someone with no finance background.
```

**A5b · Breakdown (simple pivots)**

```text
Read AGENTS.md and "Reports and simple pivots" in docs/PLAN.md. Add a Breakdown tab to Reports.
1. src/lib/reports/pivot.ts: a pure, unit-tested function pivot(entries, {measure, rows, columns,
   period}) returning row labels, column labels, cells, row/column/grand totals. Rows: category,
   subcategory, item, wallet, person. Columns: month, week, wallet, none.
2. PivotTable component: sticky first column with icon + name, horizontal scroll, bold total row
   and column, heat-tinted cells, whole-pound rounding, faint dash for zero, RTL-correct.
3. Chip rows for Show / Split by / Across / Period, plus the 5 ready-made preset cards.
4. Tap a row to drill down a level (breadcrumb back); tap a cell to open a sheet of its entries.
5. Share: CSV export and PNG image of the current pivot.
It must feel like a simple app screen, not a spreadsheet. Test with long Arabic names and 12 columns.
```

**A6 · Settings and category manager**

```text
Read AGENTS.md. Build Settings: Categories (separate Expense and Income tabs), Wallets,
Language (Arabic/English), Family (placeholder), Download data (placeholder), Sign out (placeholder).
Category manager: drill-down Category > Subcategory > Item; add new at every level (including a
whole new category with icon + colour picker); rename; drag to reorder; archive (hide) instead of
delete with a clear explanation. Wallet manager: add/rename/archive, type, opening balance.
```

**A7 · PWA, login and onboarding screens**

```text
Read AGENTS.md and "PWA setup for iPhone" in docs/PLAN.md. Read the current Serwist Turbopack
docs before coding. Implement the service worker, manifest, iOS metadata, icons (generate from a
simple logo you design as SVG), splash screens, /~offline page, and the /install guide screen.
Also build the visual-only Login and Welcome ("name your household") screens with mock behaviour.
Verify with a production build that the app installs and opens offline.
```

**A8 · Polish pass, then family test (gate)**

```text
Read AGENTS.md. Do a full design QA pass on every screen in both languages and both themes at
390x844 and 430x932: spacing rhythm, alignment in RTL, truncation of long Arabic names, contrast
(WCAG AA), tap targets >= 48px, loading skeletons, empty states, motion with reduced-motion
fallbacks. List every issue you find, fix them, and report before/after screenshots.
```

Then install it on both in-laws' iPhones and watch them log 3 real expenses without help. Note every hesitation. Feed the notes back to the agent in one "A9 fixes" prompt.

### Phase B: Real data

**B1 · Database**

```text
Read AGENTS.md and the "Database schema" section of docs/PLAN.md. Using the Supabase MCP:
apply 0001_schema.sql exactly via apply_migration (save it under supabase/migrations/), then
0002_purge.sql. Run get_advisors (security + performance) and fix anything flagged. Generate
TypeScript types into src/lib/supabase/database.types.ts. Test as SQL: an expense with an income
item must fail; a transfer to the same wallet must fail.
```

**B2 · Authentication**

```text
Read AGENTS.md. Add @supabase/ssr browser + server clients, session refresh in proxy.ts
(only redirect to /login when online and no session), wire the Login screen to email+password,
the Welcome screen to rpc('create_household'), Settings > Family to rpc('add_member'), and Sign out.
Login errors must be friendly and translated. Sessions persist indefinitely.
```

**B3 · Live repository with offline sync**

```text
Read AGENTS.md and "Offline strategy" in docs/PLAN.md. Implement src/lib/offline (Dexie mirror,
outbox, sync) and live-repository.ts implementing the same interface as the mock. Do not change any
screen components. Set NEXT_PUBLIC_DATA_MODE=live in Vercel. Test: airplane mode, add 3 entries,
edit one, reconnect, confirm all 3 reach Supabase exactly once and the sync dot updates.
```

**B4 · Reports on server views**

```text
Read AGENTS.md. Point the Reports data methods at v_monthly_summary, v_monthly_category_totals and
v_account_balances when online, cache the results in Dexie, and show "as of <time>" offline.
```

**B5 · Keep-alive, backups, export**

```text
Read AGENTS.md and "Keep-alive and backups" in docs/PLAN.md. Create keepalive.yml, backup.yml,
vercel.json cron, /api/keepalive with CRON_SECRET, and the CSV export in Settings. Tell me exactly
which GitHub secrets and Vercel env vars to add. Trigger both workflows manually and confirm success.
```

**B6 · Final QA and handover prep**

```text
Read AGENTS.md. End-to-end test on the production URL: install, log in, add/edit/delete/restore,
offline round-trip, add a category at all 3 levels, switch language, export CSV. Run Supabase
get_advisors again. Write docs/HANDOVER.md (for me) and a 1-page Arabic "how to use" guide with
screenshots (for the family).
```

## Handover checklist and known risks

Handover means the family's accounts own everything, the app runs with no one touching it, and you can walk away.

**Handover day**

- [ ] On each iPhone, open the production URL in Safari → Share → Add to Home Screen, **then** log in inside the installed app.
- [ ] Log in once on each phone, set the language, and add one real entry together.
- [ ] Confirm both keep-alive runs are green and `heartbeat.pinged_at` is today.
- [ ] Confirm the backup workflow has produced at least one artifact.
- [ ] Print or send the 1-page Arabic guide.
- [ ] Remove your personal tokens from Antigravity's MCP config. Remove yourself as a GitHub collaborator, or stay on only for emergencies.
- [ ] Set the dedicated Gmail to forward Supabase, Vercel and GitHub emails to one family member, so a pause warning or failed run is never missed.

**Known risks**

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Supabase pauses the project | Low | Two daily pings; Resume button keeps data; owner gets an email |
| An offline entry never syncs (phone lost before reconnect) | Low | Sync runs on every open; sync dot shows unsynced count |
| Two people edit the same entry offline | Very low | Last write wins; edits are rare |
| iOS deletes the installed app's storage | Very low | Server is the source of truth; re-login restores everything |
| Free-tier limits (500 MB database) | Very low | Decades of household entries fit; the advisor email warns early |
| Next.js or Supabase breaking changes | None unless redeployed | Nothing auto-upgrades; the deployed build keeps running as is |
| Forgotten password | Medium | Owner resets it from the Supabase dashboard (Auth → Users) using the family Gmail |

The one thing that can never be automated away is a forgotten password. Keep the family Gmail login somewhere they can find it.
