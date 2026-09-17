-- =============================================================================
-- Bookclub — 0001_schema.sql
-- Extensions, types énumérés, tables, index et déclencheurs structurels.
--
-- À coller dans l'éditeur SQL de Supabase, EN PREMIER, sur un projet neuf.
-- Le fichier est réexécutable : chaque objet est créé « si absent ».
--
-- Le contrat qui fait foi est `types/database.ts` : noms de tables, de colonnes
-- et valeurs d'énumération y correspondent exactement.
-- =============================================================================

-- ------------------------------------------------------------------ extensions
-- pgcrypto est déjà présent sur Supabase ; la ligne est un simple garde-fou.
create extension if not exists pgcrypto;

-- ------------------------------------------------------------- types énumérés
-- `create type` n'accepte pas `if not exists` : on encapsule pour rester
-- réexécutable sans jamais recréer (donc casser) un type déjà utilisé.
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'shelf' and n.nspname = 'public') then
    create type public.shelf as enum ('wishlist', 'reading', 'read', 'abandoned');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'friendship_status' and n.nspname = 'public') then
    create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'loan_status' and n.nspname = 'public') then
    create type public.loan_status as enum
      ('pending', 'accepted', 'declined', 'borrowed', 'returned', 'cancelled');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'recommendation_status' and n.nspname = 'public') then
    create type public.recommendation_status as enum ('sent', 'seen', 'saved', 'dismissed');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'community_role' and n.nspname = 'public') then
    create type public.community_role as enum ('owner', 'member');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'book_source' and n.nspname = 'public') then
    create type public.book_source as enum ('openlibrary', 'googlebooks', 'manual', 'seed');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'notification_kind' and n.nspname = 'public') then
    create type public.notification_kind as enum (
      'friend_request',
      'friend_accepted',
      'recommendation',
      'loan_requested',
      'loan_accepted',
      'loan_declined',
      'loan_returned',
      'community_joined'
    );
  end if;
end;
$$;

-- --------------------------------------------------------- utilitaires communs

-- Tient `updated_at` à jour ; branché uniquement sur les tables dont le contrat
-- prévoit la colonne (ratings, reviews, loan_requests).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Code d'invitation lisible (8 caractères) pour les communautés.
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

-- ==========================================================================
-- Tables
-- ==========================================================================

-- ------------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique,
  display_name    text,
  avatar_url      text,
  bio             text,
  favorite_genres text[] not null default '{}'::text[],
  is_public       boolean not null default true,
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500)
);

comment on table public.profiles is
  'Profil public d''un membre, en miroir de auth.users (créé par handle_new_user).';

-- -------------------------------------------------------------------- genres
create table if not exists public.genres (
  slug       text primary key,
  label      text not null,
  emoji      text not null default '',
  sort_order integer not null default 0,
  constraint genres_slug_format check (slug ~ '^[a-z0-9-]{2,40}$')
);

create index if not exists genres_sort_order_idx on public.genres (sort_order);

-- --------------------------------------------------------------------- books
create table if not exists public.books (
  id             uuid primary key default gen_random_uuid(),
  source         public.book_source not null default 'manual',
  source_id      text,
  isbn13         text,
  title          text not null,
  subtitle       text,
  authors        text[] not null default '{}'::text[],
  cover_url      text,
  description    text,
  published_year integer,
  page_count     integer,
  language       text,
  added_by       uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint books_title_not_blank check (char_length(btrim(title)) > 0),
  constraint books_isbn13_format check (isbn13 is null or isbn13 ~ '^[0-9]{13}$'),
  constraint books_published_year_range
    check (published_year is null or published_year between 1 and 2200),
  constraint books_page_count_range
    check (page_count is null or page_count between 1 and 50000)
);

comment on table public.books is
  'Catalogue partagé et dédupliqué : un livre importé par un membre sert à tous.';

-- Déduplication du catalogue : (source, source_id) quand source_id est renseigné.
create unique index if not exists books_source_source_id_key
  on public.books (source, source_id)
  where source_id is not null;

-- Deuxième filet de déduplication, tous fournisseurs confondus.
create unique index if not exists books_isbn13_key
  on public.books (isbn13)
  where isbn13 is not null;

create index if not exists books_added_by_idx on public.books (added_by);
create index if not exists books_created_at_idx on public.books (created_at desc);
create index if not exists books_title_lower_idx on public.books (lower(title));
create index if not exists books_authors_idx on public.books using gin (authors);
-- Recherche plein texte française sur titre + sous-titre (aucune extension requise).
create index if not exists books_fts_idx on public.books
  using gin (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(subtitle, '')));

-- --------------------------------------------------------------- book_genres
create table if not exists public.book_genres (
  book_id    uuid not null references public.books (id) on delete cascade,
  genre_slug text not null references public.genres (slug) on delete cascade,
  primary key (book_id, genre_slug)
);

create index if not exists book_genres_genre_slug_idx on public.book_genres (genre_slug);

-- ------------------------------------------------------------- library_items
create table if not exists public.library_items (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  shelf       public.shelf not null default 'wishlist',
  is_owned    boolean not null default false,
  is_lendable boolean not null default false,
  notes       text,
  added_at    timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, book_id),
  constraint library_items_notes_length check (notes is null or char_length(notes) <= 2000)
);

create index if not exists library_items_book_id_idx on public.library_items (book_id);
create index if not exists library_items_user_shelf_idx on public.library_items (user_id, shelf);
create index if not exists library_items_added_at_idx on public.library_items (user_id, added_at desc);
-- Sert la page « emprunter » : les livres prêtables, par livre.
create index if not exists library_items_lendable_idx on public.library_items (book_id)
  where is_lendable;

-- ------------------------------------------------------------------- ratings
create table if not exists public.ratings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  rating     smallint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  constraint ratings_rating_range check (rating between 1 and 5)
);

create index if not exists ratings_book_id_idx on public.ratings (book_id);
-- Le moteur de recommandation ne lit que les notes >= 4.
create index if not exists ratings_liked_idx on public.ratings (book_id, user_id)
  where rating >= 4;

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- reviews
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  body        text not null,
  has_spoiler boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reviews_body_not_blank check (char_length(btrim(body)) > 0),
  constraint reviews_body_length check (char_length(body) <= 10000),
  -- Un avis par membre et par livre : l'écriture se fait en upsert.
  constraint reviews_user_book_key unique (user_id, book_id)
);

create index if not exists reviews_book_id_idx on public.reviews (book_id, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews (user_id, created_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- review_likes
create table if not exists public.review_likes (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists review_likes_user_id_idx on public.review_likes (user_id);

-- --------------------------------------------------------------- friendships
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- Une seule relation par paire, quel que soit le sens de la demande.
create unique index if not exists friendships_pair_key on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

-- --------------------------------------------------------------- communities
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default public.generate_invite_code(),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint communities_slug_format check (slug ~ '^[a-z0-9-]{2,60}$'),
  constraint communities_name_not_blank check (char_length(btrim(name)) > 0)
);

create index if not exists communities_owner_id_idx on public.communities (owner_id);

-- ---------------------------------------------------------- community_members
create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.community_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists community_members_user_id_idx on public.community_members (user_id);

-- Le créateur devient membre « owner » : sans cela il ne verrait pas sa propre
-- communauté fermée (les politiques de lecture passent par l'appartenance).
create or replace function public.handle_new_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (community_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists communities_add_owner on public.communities;
create trigger communities_add_owner
  after insert on public.communities
  for each row execute function public.handle_new_community();

-- ----------------------------------------------------------- recommendations
create table if not exists public.recommendations (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  message    text,
  status     public.recommendation_status not null default 'sent',
  created_at timestamptz not null default now(),
  constraint recommendations_no_self check (from_user <> to_user),
  constraint recommendations_message_length
    check (message is null or char_length(message) <= 1000),
  constraint recommendations_unique_triplet unique (from_user, to_user, book_id)
);

create index if not exists recommendations_to_user_idx
  on public.recommendations (to_user, created_at desc);
create index if not exists recommendations_from_user_idx
  on public.recommendations (from_user, created_at desc);
create index if not exists recommendations_book_id_idx on public.recommendations (book_id);

-- ------------------------------------------------------------- loan_requests
create table if not exists public.loan_requests (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  borrower_id uuid not null references public.profiles (id) on delete cascade,
  status      public.loan_status not null default 'pending',
  message     text,
  due_at      timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint loan_requests_no_self check (owner_id <> borrower_id),
  constraint loan_requests_message_length
    check (message is null or char_length(message) <= 1000)
);

-- Une seule demande vivante à la fois pour un même trio.
create unique index if not exists loan_requests_active_key
  on public.loan_requests (book_id, owner_id, borrower_id)
  where status in ('pending', 'accepted', 'borrowed');

create index if not exists loan_requests_owner_idx
  on public.loan_requests (owner_id, status, created_at desc);
create index if not exists loan_requests_borrower_idx
  on public.loan_requests (borrower_id, status, created_at desc);
create index if not exists loan_requests_book_id_idx on public.loan_requests (book_id);

drop trigger if exists loan_requests_set_updated_at on public.loan_requests;
create trigger loan_requests_set_updated_at
  before update on public.loan_requests
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- ==========================================================================
-- Création automatique du profil à l'inscription
-- ==========================================================================

-- Dérive un identifiant depuis l'e-mail (ou les métadonnées d'inscription) et
-- ajoute un suffixe numérique tant que le nom est déjà pris.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      text;
  v_candidate text;
  v_suffix    integer := 0;
begin
  v_base := lower(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    ''
  ));
  v_base := regexp_replace(v_base, '[^a-z0-9_]+', '_', 'g');
  v_base := regexp_replace(v_base, '_{2,}', '_', 'g');
  v_base := btrim(v_base, '_');

  -- E-mail exotique ou connexion sans e-mail : on retombe sur l'identifiant.
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'membre_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  v_base := left(v_base, 24);
  v_base := btrim(v_base, '_');
  if char_length(v_base) < 3 then
    v_base := 'membre_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.profiles p where p.username = v_candidate) loop
    v_suffix := v_suffix + 1;
    if v_suffix > 9999 then
      v_candidate := 'membre_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      exit;
    end if;
    v_candidate := v_base || v_suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_candidate,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name',
                          new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- Ne jamais faire échouer une inscription à cause du profil : le code
    -- applicatif sait créer le profil manquant au premier passage.
    raise warning 'handle_new_user a échoué pour % : %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================================
-- Droits (la sécurité réelle est portée par les politiques RLS du fichier 0002)
-- ==========================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on function public.generate_invite_code() to authenticated, service_role;
