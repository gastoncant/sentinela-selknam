-- Ejecutar una vez en un proyecto nuevo de Supabase.
create table public.organizations (id uuid primary key, name text not null);
create table public.memberships (
  org_id uuid references public.organizations(id), user_id uuid references auth.users(id),
  primary key (org_id,user_id)
);
create table public.candidates (
  id text primary key, org_id uuid not null references public.organizations(id),
  published boolean not null default false,
  feature jsonb not null
);
create table public.review_heads (
  candidate_id text primary key references public.candidates(id),
  org_id uuid not null references public.organizations(id),
  state text not null, reason text not null, version integer not null default 0,
  at timestamptz not null default now()
);
create table public.reviews (
  id bigint generated always as identity primary key,
  candidate_id text not null references public.candidates(id),
  org_id uuid not null references public.organizations(id),
  author uuid not null references auth.users(id),
  state text not null, reason text not null, version integer not null,
  at timestamptz not null default now(),
  unique(candidate_id,version)
);
create index candidates_org on public.candidates(org_id);
create index review_org on public.reviews(org_id,candidate_id);
create index membership_user on public.memberships(user_id,org_id);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.candidates enable row level security;
alter table public.review_heads enable row level security;
alter table public.reviews enable row level security;
revoke all on public.organizations, public.memberships, public.candidates, public.review_heads, public.reviews from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.candidates to anon,authenticated;
grant select on public.memberships,public.organizations,public.review_heads,public.reviews to authenticated;
create policy own_membership on public.memberships for select to authenticated using (user_id=(select auth.uid()));
create policy member_org on public.organizations for select to authenticated using (
  exists(select 1 from public.memberships m where m.org_id=id and m.user_id=(select auth.uid()))
);
create policy published_candidates_anon on public.candidates for select to anon using (published);
create policy published_candidates_auth on public.candidates for select to authenticated using (published or exists(
  select 1 from public.memberships m where m.org_id=candidates.org_id and m.user_id=(select auth.uid())
));
create policy member_heads on public.review_heads for select to authenticated using (exists(
  select 1 from public.memberships m where m.org_id=review_heads.org_id and m.user_id=(select auth.uid())
));
create policy member_reviews on public.reviews for select to authenticated using (exists(
  select 1 from public.memberships m where m.org_id=reviews.org_id and m.user_id=(select auth.uid())
));
create function public.record_review(p_candidate text,p_state text,p_reason text,p_expected integer)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_org uuid;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_state is null or p_state not in ('Compatible con impacto de castor','Otra causa','Información insuficiente')
     or p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_expected is null or p_expected<0 then
    raise exception 'Campos inválidos' using errcode='22023';
  end if;
  select c.org_id into v_org from public.candidates c where c.id=p_candidate;
  if v_org is null or not exists(select 1 from public.memberships m where m.org_id=v_org and m.user_id=auth.uid()) then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  insert into public.review_heads(candidate_id,org_id,state,reason,version)
    values(p_candidate,v_org,'Pendiente de revisión','',0) on conflict do nothing;
  select version into v_version from public.review_heads where candidate_id=p_candidate for update;
  if v_version<>p_expected then raise exception 'Conflicto de versión' using errcode='40001'; end if;
  update public.review_heads set state=p_state,reason=trim(p_reason),version=v_version+1,at=now() where candidate_id=p_candidate;
  insert into public.reviews(candidate_id,org_id,author,state,reason,version)
    values(p_candidate,v_org,auth.uid(),p_state,trim(p_reason),v_version+1);
  return v_version+1;
end $$;
revoke all on function public.record_review(text,text,text,integer) from public,anon;
grant execute on function public.record_review(text,text,text,integer) to authenticated;

