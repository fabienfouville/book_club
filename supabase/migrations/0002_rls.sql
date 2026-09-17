-- =============================================================================
-- Bookclub — 0002_rls.sql
-- Row Level Security sur toutes les tables + fonctions d'aide.
--
-- À exécuter APRÈS 0001_schema.sql. Réexécutable (les politiques sont
-- systématiquement supprimées avant d'être recréées).
--
-- Règle d'or : une politique ne doit jamais interroger, même indirectement, la
-- table qu'elle protège — sinon Postgres part en récursion infinie. Tous les
-- tests d'appartenance (amitié, communauté, visibilité de profil) passent donc
-- par des fonctions SECURITY DEFINER, qui court-circuitent RLS.
-- =============================================================================

-- ==========================================================================
-- Fonctions d'aide (SECURITY DEFINER, search_path figé)
-- ==========================================================================

-- Deux membres sont-ils amis (demande acceptée, quel que soit le sens) ?
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null
     and b is not null
     and exists (
       select 1
       from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = a and f.addressee_id = b)
           or (f.requester_id = b and f.addressee_id = a))
     );
$$;

-- Deux membres partagent-ils au moins une communauté ?
create or replace function public.share_community(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null
     and b is not null
     and exists (
       select 1
       from public.community_members m1
       join public.community_members m2 on m2.community_id = m1.community_id
       where m1.user_id = a
         and m2.user_id = b
     );
$$;

-- `viewer` a-t-il le droit de voir le profil (et la bibliothèque) de `target` ?
create or replace function public.can_see_profile(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target is not null
     and (
       viewer = target
       or exists (select 1 from public.profiles p where p.id = target and p.is_public)
       or public.are_friends(viewer, target)
       or public.share_community(viewer, target)
     );
$$;

-- Appartenance à une communauté. Indispensable : sans cette fonction, la
-- politique de lecture de `community_members` interrogerait `community_members`.
create or replace function public.is_community_member(p_community uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_community is not null
     and p_user is not null
     and exists (
       select 1
       from public.community_members m
       where m.community_id = p_community
         and m.user_id = p_user
     );
$$;

grant execute on function public.are_friends(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.share_community(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_see_profile(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.is_community_member(uuid, uuid) to anon, authenticated, service_role;

-- ==========================================================================
-- Activation de RLS sur TOUTES les tables
-- ==========================================================================
alter table public.profiles          enable row level security;
alter table public.books             enable row level security;
alter table public.genres            enable row level security;
alter table public.book_genres       enable row level security;
alter table public.library_items     enable row level security;
alter table public.ratings           enable row level security;
alter table public.reviews           enable row level security;
alter table public.review_likes      enable row level security;
alter table public.friendships       enable row level security;
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.recommendations   enable row level security;
alter table public.loan_requests     enable row level security;
alter table public.notifications     enable row level security;

-- ==========================================================================
-- books / genres / book_genres — catalogue partagé
-- Lecture publique, ajout par tout membre connecté, modification par `added_by`.
-- ==========================================================================

drop policy if exists books_select_public on public.books;
create policy books_select_public on public.books
  for select to anon, authenticated
  using (true);

drop policy if exists books_insert_authenticated on public.books;
create policy books_insert_authenticated on public.books
  for insert to authenticated
  with check (auth.uid() is not null and (added_by is null or added_by = auth.uid()));

drop policy if exists books_update_owner on public.books;
create policy books_update_owner on public.books
  for update to authenticated
  using (added_by is not null and added_by = auth.uid())
  with check (added_by is not null and added_by = auth.uid());

drop policy if exists books_delete_owner on public.books;
create policy books_delete_owner on public.books
  for delete to authenticated
  using (added_by is not null and added_by = auth.uid());

drop policy if exists genres_select_public on public.genres;
create policy genres_select_public on public.genres
  for select to anon, authenticated
  using (true);

drop policy if exists genres_insert_authenticated on public.genres;
create policy genres_insert_authenticated on public.genres
  for insert to authenticated
  with check (auth.uid() is not null);
-- Pas de politique update/delete : la nomenclature des genres n'est modifiable
-- que par une migration (ou la clé service_role). `genres` n'a pas d'`added_by`.

drop policy if exists book_genres_select_public on public.book_genres;
create policy book_genres_select_public on public.book_genres
  for select to anon, authenticated
  using (true);

drop policy if exists book_genres_insert_authenticated on public.book_genres;
create policy book_genres_insert_authenticated on public.book_genres
  for insert to authenticated
  with check (auth.uid() is not null);

-- Le rattachement d'un livre à un genre suit le propriétaire du livre.
drop policy if exists book_genres_update_book_owner on public.book_genres;
create policy book_genres_update_book_owner on public.book_genres
  for update to authenticated
  using (exists (select 1 from public.books b
                 where b.id = book_genres.book_id and b.added_by = auth.uid()))
  with check (exists (select 1 from public.books b
                      where b.id = book_genres.book_id and b.added_by = auth.uid()));

drop policy if exists book_genres_delete_book_owner on public.book_genres;
create policy book_genres_delete_book_owner on public.book_genres
  for delete to authenticated
  using (exists (select 1 from public.books b
                 where b.id = book_genres.book_id and b.added_by = auth.uid()));

-- ==========================================================================
-- profiles — public, soi-même, amis, ou communauté partagée
-- ==========================================================================

drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
  for select to anon, authenticated
  using (public.can_see_profile(auth.uid(), id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self on public.profiles
  for delete to authenticated
  using (id = auth.uid());

-- ==========================================================================
-- ratings / reviews / review_likes — lecture publique, écriture par l'auteur
-- ==========================================================================

drop policy if exists ratings_select_public on public.ratings;
create policy ratings_select_public on public.ratings
  for select to anon, authenticated
  using (true);

drop policy if exists ratings_insert_self on public.ratings;
create policy ratings_insert_self on public.ratings
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ratings_update_self on public.ratings;
create policy ratings_update_self on public.ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ratings_delete_self on public.ratings;
create policy ratings_delete_self on public.ratings
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public on public.reviews
  for select to anon, authenticated
  using (true);

drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_insert_self on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists reviews_update_self on public.reviews;
create policy reviews_update_self on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists reviews_delete_self on public.reviews;
create policy reviews_delete_self on public.reviews
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists review_likes_select_public on public.review_likes;
create policy review_likes_select_public on public.review_likes
  for select to anon, authenticated
  using (true);

drop policy if exists review_likes_insert_self on public.review_likes;
create policy review_likes_insert_self on public.review_likes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists review_likes_delete_self on public.review_likes;
create policy review_likes_delete_self on public.review_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ==========================================================================
-- library_items — propriétaire, amis acceptés, membres des mêmes communautés
-- ==========================================================================

drop policy if exists library_items_select_circle on public.library_items;
create policy library_items_select_circle on public.library_items
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
    or public.share_community(auth.uid(), user_id)
  );

drop policy if exists library_items_insert_self on public.library_items;
create policy library_items_insert_self on public.library_items
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists library_items_update_self on public.library_items;
create policy library_items_update_self on public.library_items
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists library_items_delete_self on public.library_items;
create policy library_items_delete_self on public.library_items
  for delete to authenticated
  using (user_id = auth.uid());

-- ==========================================================================
-- friendships — visibles et modifiables par les deux parties.
-- Seul l'`addressee_id` peut faire passer le statut à 'accepted'.
-- ==========================================================================

drop policy if exists friendships_select_parties on public.friendships;
create policy friendships_select_parties on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester on public.friendships
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and requester_id <> addressee_id
    and status in ('pending', 'blocked')
  );

drop policy if exists friendships_update_parties on public.friendships;
create policy friendships_update_parties on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (
    (requester_id = auth.uid() or addressee_id = auth.uid())
    -- l'acceptation est le privilège du destinataire
    and (status <> 'accepted' or addressee_id = auth.uid())
  );

drop policy if exists friendships_delete_parties on public.friendships;
create policy friendships_delete_parties on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ==========================================================================
-- communities / community_members
-- ==========================================================================

drop policy if exists communities_select_open_or_member on public.communities;
create policy communities_select_open_or_member on public.communities
  for select to anon, authenticated
  using (
    is_open
    or owner_id = auth.uid()
    or public.is_community_member(id, auth.uid())
  );

drop policy if exists communities_insert_owner on public.communities;
create policy communities_insert_owner on public.communities
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists communities_update_owner on public.communities;
create policy communities_update_owner on public.communities
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists communities_delete_owner on public.communities;
create policy communities_delete_owner on public.communities
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists community_members_select_members on public.community_members;
create policy community_members_select_members on public.community_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_community_member(community_id, auth.uid())
  );

-- On s'inscrit soi-même, et uniquement dans une communauté ouverte. Les
-- communautés fermées se rejoignent via `join_community_by_code()` (0003).
drop policy if exists community_members_insert_self on public.community_members;
create policy community_members_insert_self on public.community_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.communities c
                where c.id = community_id and c.is_open)
  );

-- Le propriétaire administre les rôles de sa communauté.
drop policy if exists community_members_update_owner on public.community_members;
create policy community_members_update_owner on public.community_members
  for update to authenticated
  using (exists (select 1 from public.communities c
                 where c.id = community_members.community_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.communities c
                      where c.id = community_members.community_id and c.owner_id = auth.uid()));

-- On part quand on veut ; le propriétaire peut exclure un membre.
drop policy if exists community_members_delete_self_or_owner on public.community_members;
create policy community_members_delete_self_or_owner on public.community_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.communities c
               where c.id = community_members.community_id and c.owner_id = auth.uid())
  );

-- ==========================================================================
-- recommendations — émetteur et destinataire uniquement
-- ==========================================================================

drop policy if exists recommendations_select_parties on public.recommendations;
create policy recommendations_select_parties on public.recommendations
  for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

drop policy if exists recommendations_insert_sender on public.recommendations;
create policy recommendations_insert_sender on public.recommendations
  for insert to authenticated
  with check (from_user = auth.uid() and from_user <> to_user and status = 'sent');

-- Seul le destinataire fait évoluer le statut (vu / gardé / écarté).
drop policy if exists recommendations_update_recipient on public.recommendations;
create policy recommendations_update_recipient on public.recommendations
  for update to authenticated
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

drop policy if exists recommendations_delete_parties on public.recommendations;
create policy recommendations_delete_parties on public.recommendations
  for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- ==========================================================================
-- loan_requests — propriétaire et emprunteur, chacun selon ses transitions
-- ==========================================================================

drop policy if exists loan_requests_select_parties on public.loan_requests;
create policy loan_requests_select_parties on public.loan_requests
  for select to authenticated
  using (owner_id = auth.uid() or borrower_id = auth.uid());

drop policy if exists loan_requests_insert_borrower on public.loan_requests;
create policy loan_requests_insert_borrower on public.loan_requests
  for insert to authenticated
  with check (
    borrower_id = auth.uid()
    and owner_id <> auth.uid()
    and status = 'pending'
  );

-- L'emprunteur peut annuler sa demande ou déclarer le livre rendu.
drop policy if exists loan_requests_update_borrower on public.loan_requests;
create policy loan_requests_update_borrower on public.loan_requests
  for update to authenticated
  using (borrower_id = auth.uid())
  with check (
    borrower_id = auth.uid()
    and status in ('pending', 'cancelled', 'returned')
  );

-- Le propriétaire accepte, refuse, confirme le prêt ou le retour.
drop policy if exists loan_requests_update_owner on public.loan_requests;
create policy loan_requests_update_owner on public.loan_requests
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and status in ('accepted', 'declined', 'borrowed', 'returned')
  );

-- Une demande encore en attente peut être supprimée par son auteur.
drop policy if exists loan_requests_delete_borrower on public.loan_requests;
create policy loan_requests_delete_borrower on public.loan_requests
  for delete to authenticated
  using (borrower_id = auth.uid() and status = 'pending');

-- ==========================================================================
-- notifications — strictement privées
-- ==========================================================================

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Les notifications destinées aux autres sont créées par des déclencheurs
-- SECURITY DEFINER (fichier 0003) : personne ne peut en écrire pour autrui.
drop policy if exists notifications_insert_self on public.notifications;
create policy notifications_insert_self on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());
