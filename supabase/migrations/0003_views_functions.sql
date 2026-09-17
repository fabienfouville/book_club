-- =============================================================================
-- Bookclub — 0003_views_functions.sql
-- Vue d'agrégats, moteur de recommandation, adhésion par code d'invitation et
-- déclencheurs de notification.
--
-- À exécuter APRÈS 0002_rls.sql. Réexécutable.
-- =============================================================================

-- ==========================================================================
-- Compteurs de bibliothèque
-- La vue `book_stats` est en `security_invoker = true` (elle doit respecter
-- RLS), mais `library_items` n'est lisible que par le cercle du propriétaire :
-- une simple agrégation y renverrait des compteurs tronqués. Ces deux fonctions
-- SECURITY DEFINER renvoient donc un décompte complet — un nombre anonyme, qui
-- ne divulgue aucune ligne ni aucune identité.
-- ==========================================================================

create or replace function public.book_owners_count(p_book_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.library_items li
  where li.book_id = p_book_id and li.is_owned;
$$;

create or replace function public.book_readers_count(p_book_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.library_items li
  where li.book_id = p_book_id and li.shelf = 'read';
$$;

grant execute on function public.book_owners_count(uuid) to anon, authenticated, service_role;
grant execute on function public.book_readers_count(uuid) to anon, authenticated, service_role;

-- ==========================================================================
-- Vue book_stats — conforme à l'interface `BookStats` de types/database.ts
-- ==========================================================================

drop view if exists public.book_stats;
create view public.book_stats
with (security_invoker = true)
as
select
  b.id                                          as book_id,
  r.average_rating                              as average_rating,
  coalesce(r.ratings_count, 0)                  as ratings_count,
  coalesce(v.reviews_count, 0)                  as reviews_count,
  public.book_owners_count(b.id)                as owners_count,
  public.book_readers_count(b.id)               as readers_count
from public.books b
left join (
  select rt.book_id,
         round(avg(rt.rating)::numeric, 2)::double precision as average_rating,
         count(*)::int                                       as ratings_count
  from public.ratings rt
  group by rt.book_id
) r on r.book_id = b.id
left join (
  select rv.book_id, count(*)::int as reviews_count
  from public.reviews rv
  group by rv.book_id
) v on v.book_id = b.id;

comment on view public.book_stats is
  'Agrégats publics par livre (note moyenne, nombre de notes, d''avis, de possesseurs, de lecteurs).';

grant select on public.book_stats to anon, authenticated, service_role;

-- ==========================================================================
-- Rôle porté par le JWT courant ('anon', 'authenticated' ou 'service_role').
-- ==========================================================================
create or replace function public.current_jwt_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  );
$$;

grant execute on function public.current_jwt_role() to anon, authenticated, service_role;

-- ==========================================================================
-- similar_books — « Dans le même esprit » sous une fiche livre
--
-- Trois signaux pondérés :
--   auteur commun ............ 6,0  (très fort)
--   genre partagé ............ 2,0 par genre commun (fort)
--   co-notation 4+ ........... 1,5 par membre ayant aimé les deux (moyen)
-- ==========================================================================

create or replace function public.similar_books(p_book_id uuid, p_limit int default 12)
returns table (book_id uuid, score real, reason_kind text, reason_label text)
language sql
stable
set search_path = public
as $$
  with src as (
    select b.id, b.title, b.authors
    from public.books b
    where b.id = p_book_id
  ),
  src_genres as (
    select bg.genre_slug
    from public.book_genres bg
    where bg.book_id = p_book_id
  ),
  -- Genres : un point de score par genre partagé, libellé = genre le plus
  -- représentatif (celui qui vient en premier dans la nomenclature).
  genre_scores as (
    select bg.book_id as bid, (count(*) * 2.0)::real as sc
    from public.book_genres bg
    where bg.genre_slug in (select genre_slug from src_genres)
      and bg.book_id <> p_book_id
    group by bg.book_id
  ),
  genre_best as (
    select distinct on (bg.book_id) bg.book_id as bid, g.label as lbl
    from public.book_genres bg
    join public.genres g on g.slug = bg.genre_slug
    where bg.genre_slug in (select genre_slug from src_genres)
      and bg.book_id <> p_book_id
    order by bg.book_id, g.sort_order
  ),
  genre_hits as (
    select s.bid, 'genre'::text as knd, bst.lbl, s.sc
    from genre_scores s
    join genre_best bst on bst.bid = s.bid
  ),
  -- Auteur commun : le signal le plus fort, libellé = titre du livre consulté.
  author_hits as (
    select b.id as bid, 'author'::text as knd, (select title from src) as lbl, 6.0::real as sc
    from public.books b
    where b.id <> p_book_id
      and exists (select 1 from src s where b.authors && s.authors)
  ),
  -- « Ceux qui ont mis 4+ à ce livre ont aussi mis 4+ à… »
  co_read_hits as (
    select r2.book_id as bid, 'co_read'::text as knd, (select title from src) as lbl,
           (count(*) * 1.5)::real as sc
    from public.ratings r1
    join public.ratings r2
      on r2.user_id = r1.user_id
     and r2.book_id <> r1.book_id
     and r2.rating >= 4
    where r1.book_id = p_book_id
      and r1.rating >= 4
    group by r2.book_id
  ),
  all_hits as (
    select bid, knd, lbl, sc from genre_hits
    union all
    select bid, knd, lbl, sc from author_hits
    union all
    select bid, knd, lbl, sc from co_read_hits
  ),
  agg as (
    select h.bid, sum(h.sc)::real as total
    from all_hits h
    group by h.bid
  ),
  -- Le motif affiché est celui qui pèse le plus lourd pour ce livre.
  best as (
    select distinct on (h.bid) h.bid, h.knd, h.lbl
    from all_hits h
    order by h.bid, h.sc desc, h.knd
  )
  select a.bid, a.total, bt.knd, bt.lbl
  from agg a
  join best bt on bt.bid = a.bid
  join public.books bk on bk.id = a.bid
  order by a.total desc, bk.created_at desc, a.bid
  limit greatest(coalesce(p_limit, 12), 0);
$$;

comment on function public.similar_books(uuid, int) is
  'Livres proches : auteur commun, genres partagés et co-notation 4+, pondérés.';

grant execute on function public.similar_books(uuid, int) to anon, authenticated, service_role;

-- ==========================================================================
-- recommend_for_user — « Pour vous »
--
-- Combine cinq signaux, exclut tout livre déjà en bibliothèque ou déjà noté :
--   genre ..... affinité tirée des livres notés 4+        (1,5 × poids du genre)
--   author .... autres livres des auteurs appréciés       (6,0)
--   co_read ... filtrage collaboratif sur les notes 4+    (2,5 par voisin)
--   friends ... ce que lisent les amis acceptés           (2,0)
--   popular ... repli, pour ne jamais renvoyer une page vide  (0,1 à 1,1)
--
-- `reason_label` : le titre du livre (author, co_read), le genre (genre), le
-- nom de l'ami (friends), null (popular). De quoi écrire « Parce que vous avez
-- aimé Dune ».
-- ==========================================================================

create or replace function public.recommend_for_user(p_user uuid, p_limit int default 20)
returns table (book_id uuid, score real, reason_kind text, reason_label text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_user is null then
    raise exception 'recommend_for_user : utilisateur manquant';
  end if;

  -- Les recommandations s'appuient sur les lectures des amis : on ne les
  -- calcule que pour soi-même (ou depuis le serveur, en service_role).
  if public.current_jwt_role() <> 'service_role' and p_user is distinct from auth.uid() then
    raise exception 'recommend_for_user : accès refusé';
  end if;

  return query
  with liked as (
    select r.book_id as bid, b.title as ttl, b.authors as auth_list
    from public.ratings r
    join public.books b on b.id = r.book_id
    where r.user_id = p_user and r.rating >= 4
  ),
  -- Tout ce que l'utilisateur connaît déjà : sa bibliothèque et ses notes.
  known as (
    select li.book_id as bid from public.library_items li where li.user_id = p_user
    union
    select r.book_id as bid from public.ratings r where r.user_id = p_user
  ),
  liked_genres as (
    select bg.genre_slug as slug, count(*)::real as weight
    from public.book_genres bg
    join liked l on l.bid = bg.book_id
    group by bg.genre_slug
  ),
  genre_hits as (
    select bg.book_id as bid, 'genre'::text as knd, g.label as lbl,
           (lg.weight * 1.5)::real as sc
    from public.book_genres bg
    join liked_genres lg on lg.slug = bg.genre_slug
    join public.genres g on g.slug = bg.genre_slug
  ),
  author_hits as (
    select b.id as bid, 'author'::text as knd, l.ttl as lbl, 6.0::real as sc
    from public.books b
    join liked l on b.authors && l.auth_list
    where b.id <> l.bid
  ),
  co_read_hits as (
    select r2.book_id as bid, 'co_read'::text as knd, l.ttl as lbl, 2.5::real as sc
    from liked l
    join public.ratings r1
      on r1.book_id = l.bid and r1.rating >= 4 and r1.user_id <> p_user
    join public.ratings r2
      on r2.user_id = r1.user_id and r2.rating >= 4 and r2.book_id <> l.bid
  ),
  friend_ids as (
    select case when f.requester_id = p_user then f.addressee_id else f.requester_id end as fid
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = p_user or f.addressee_id = p_user)
  ),
  friend_hits as (
    select li.book_id as bid, 'friends'::text as knd,
           coalesce(nullif(btrim(pr.display_name), ''), pr.username) as lbl,
           2.0::real as sc
    from public.library_items li
    join friend_ids fr on fr.fid = li.user_id
    join public.profiles pr on pr.id = li.user_id
    where li.shelf in ('read', 'reading')
  ),
  -- Repli : reste toujours sous le poids d'un seul signal personnalisé.
  popular_hits as (
    select b.id as bid, 'popular'::text as knd, null::text as lbl,
           (0.1 + least(coalesce(p.n, 0), 20) * 0.05)::real as sc
    from public.books b
    left join (
      select r.book_id as bid, count(*)::int as n
      from public.ratings r
      where r.rating >= 4
      group by r.book_id
    ) p on p.bid = b.id
  ),
  all_hits as (
    select bid, knd, lbl, sc from genre_hits
    union all select bid, knd, lbl, sc from author_hits
    union all select bid, knd, lbl, sc from co_read_hits
    union all select bid, knd, lbl, sc from friend_hits
    union all select bid, knd, lbl, sc from popular_hits
  ),
  candidates as (
    select h.bid, h.knd, h.lbl, h.sc
    from all_hits h
    where not exists (select 1 from known k where k.bid = h.bid)
  ),
  agg as (
    select c.bid, sum(c.sc)::real as total
    from candidates c
    group by c.bid
  ),
  best as (
    select distinct on (c.bid) c.bid, c.knd, c.lbl
    from candidates c
    order by c.bid, c.sc desc, c.knd
  )
  select a.bid, a.total, bt.knd, bt.lbl
  from agg a
  join best bt on bt.bid = a.bid
  order by a.total desc, a.bid
  limit greatest(coalesce(p_limit, 20), 0);
end;
$$;

comment on function public.recommend_for_user(uuid, int) is
  'Recommandations personnalisées : genres, auteurs, co-lecture, amis, popularité.';

grant execute on function public.recommend_for_user(uuid, int) to authenticated, service_role;

-- ==========================================================================
-- join_community_by_code — rejoindre une communauté avec son code d'invitation
-- SECURITY DEFINER : c'est la seule porte d'entrée des communautés fermées.
-- ==========================================================================

create or replace function public.join_community_by_code(p_code text)
returns public.communities
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_community public.communities;
begin
  if v_user is null then
    raise exception 'Connexion requise pour rejoindre une communauté';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'Code d''invitation manquant';
  end if;

  select c.* into v_community
  from public.communities c
  where upper(c.invite_code) = upper(btrim(p_code));

  if not found then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (v_community.id, v_user, 'member')
  on conflict (community_id, user_id) do nothing;

  return v_community;
end;
$$;

comment on function public.join_community_by_code(text) is
  'Inscrit l''appelant dans la communauté correspondant au code d''invitation.';

grant execute on function public.join_community_by_code(text) to authenticated, service_role;

-- ==========================================================================
-- Notifications — produites par la base
--
-- La politique d'insertion de `notifications` interdit d'écrire pour autrui :
-- ces déclencheurs SECURITY DEFINER sont donc le seul producteur possible.
-- Aucun code applicatif n'a besoin d'insérer une notification.
-- ==========================================================================

create or replace function public.notify_user(
  p_user    uuid,
  p_kind    public.notification_kind,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (p_user, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke execute on function public.notify_user(uuid, public.notification_kind, jsonb) from public, anon, authenticated;
grant execute on function public.notify_user(uuid, public.notification_kind, jsonb) to service_role;

-- ---------------------------------------------------------------- amitiés ---
create or replace function public.on_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify_user(new.addressee_id, 'friend_request',
        jsonb_build_object('friendship_id', new.id, 'from_user', new.requester_id));
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.notify_user(new.requester_id, 'friend_accepted',
      jsonb_build_object('friendship_id', new.id, 'from_user', new.addressee_id));
  end if;
  return null;
end;
$$;

drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify
  after insert or update on public.friendships
  for each row execute function public.on_friendship_change();

-- Horodate la réponse à une demande d'amitié.
create or replace function public.stamp_friendship_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_stamp_response on public.friendships;
create trigger friendships_stamp_response
  before update on public.friendships
  for each row execute function public.stamp_friendship_response();

-- --------------------------------------------------------- recommandations ---
create or replace function public.on_recommendation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_user(new.to_user, 'recommendation',
    jsonb_build_object('recommendation_id', new.id,
                       'from_user', new.from_user,
                       'book_id', new.book_id));
  return null;
end;
$$;

drop trigger if exists recommendations_notify on public.recommendations;
create trigger recommendations_notify
  after insert on public.recommendations
  for each row execute function public.on_recommendation_created();

-- ------------------------------------------------------------- emprunts ---
create or replace function public.on_loan_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object('loan_id', new.id, 'book_id', new.book_id);

  if tg_op = 'INSERT' then
    perform public.notify_user(new.owner_id, 'loan_requested',
      v_payload || jsonb_build_object('from_user', new.borrower_id));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify_user(new.borrower_id, 'loan_accepted',
        v_payload || jsonb_build_object('from_user', new.owner_id));
    elsif new.status = 'declined' then
      perform public.notify_user(new.borrower_id, 'loan_declined',
        v_payload || jsonb_build_object('from_user', new.owner_id));
    elsif new.status = 'returned' then
      perform public.notify_user(new.owner_id, 'loan_returned',
        v_payload || jsonb_build_object('from_user', new.borrower_id));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists loan_requests_notify on public.loan_requests;
create trigger loan_requests_notify
  after insert or update on public.loan_requests
  for each row execute function public.on_loan_request_change();

-- ----------------------------------------------------------- communautés ---
create or replace function public.on_community_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select c.owner_id into v_owner from public.communities c where c.id = new.community_id;
  if v_owner is not null and v_owner <> new.user_id then
    perform public.notify_user(v_owner, 'community_joined',
      jsonb_build_object('community_id', new.community_id, 'from_user', new.user_id));
  end if;
  return null;
end;
$$;

drop trigger if exists community_members_notify on public.community_members;
create trigger community_members_notify
  after insert on public.community_members
  for each row execute function public.on_community_member_added();
