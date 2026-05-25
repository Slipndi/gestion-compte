-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RÉCURRENTS / BUDGET — Schéma Supabase                        ║
-- ║  À coller dans : Supabase → SQL Editor → New query → Run      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── Catégories de dépense ───────────────────────────────────────
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#C2522F',
  created_at timestamptz not null default now()
);

-- ── Paiements récurrents ────────────────────────────────────────
create table if not exists public.recurrents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label       text not null,
  amount      numeric(10,2) not null,
  day         int,                       -- jour de prélèvement (1-31), informatif
  start_month date not null,             -- 1er jour du mois de début
  end_month   date,                      -- 1er jour du mois de fin (null = sans fin)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Dépenses ponctuelles ────────────────────────────────────────
create table if not exists public.depenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month       date not null,             -- 1er jour du mois concerné
  label       text not null,
  amount      numeric(10,2) not null,
  category_id uuid references public.categories(id) on delete set null,
  spent_on    date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ── Revenus par défaut (1 ligne / utilisateur) ──────────────────
create table if not exists public.revenu_defaults (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ludovic     numeric(10,2) not null default 0,
  marie_laure numeric(10,2) not null default 0,
  aides       numeric(10,2) not null default 0
);

-- ── Revenus d'un mois précis (écrase le défaut) ─────────────────
create table if not exists public.revenu_months (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month       date not null,
  ludovic     numeric(10,2) not null default 0,
  marie_laure numeric(10,2) not null default 0,
  aides       numeric(10,2) not null default 0,
  primary key (user_id, month)
);

-- ── Index utiles ────────────────────────────────────────────────
create index if not exists idx_depenses_user_month on public.depenses (user_id, month);
create index if not exists idx_recurrents_user      on public.recurrents (user_id);

-- ── Row-Level Security : chacun ne voit que ses lignes ──────────
alter table public.categories      enable row level security;
alter table public.recurrents      enable row level security;
alter table public.depenses        enable row level security;
alter table public.revenu_defaults enable row level security;
alter table public.revenu_months   enable row level security;

create policy "own_categories"      on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_recurrents"      on public.recurrents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_depenses"        on public.depenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_revenu_defaults" on public.revenu_defaults
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_revenu_months"   on public.revenu_months
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
