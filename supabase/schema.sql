-- Nako phase one. Idempotent schema for the free tier.
-- Anonymous passengers can read active routes and record coarse usage.
-- They cannot read usage tables or change routes.

create table if not exists public.places (
  id text primary key,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('city', 'town', 'village')),
  lat double precision not null,
  lng double precision not null,
  popular boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.zones (
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  summary text,
  lat double precision,
  lng double precision,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  zone_id text references public.zones(id) on delete set null,
  name text not null,
  transport_type text not null check (transport_type in ('taxi', 'kombi', 'bus')),
  origin_name text not null,
  destination_name text not null,
  summary text,
  path jsonb not null,
  guide boolean not null default true,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_sessions (
  session_id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  searches integer not null default 0,
  opens integer not null default 0,
  pwa boolean not null default false,
  last_city text,
  last_transport text
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  event_name text not null,
  city text,
  transport_type text,
  route_id text,
  pwa boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_created_idx on public.usage_events (created_at desc);
create index if not exists usage_events_session_idx on public.usage_events (session_id, created_at desc);
create index if not exists routes_place_idx on public.routes (place_id, transport_type, active);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_route()
returns trigger
language plpgsql
as $$
begin
  if new.name is null or char_length(trim(new.name)) < 2 or char_length(new.name) > 120 then
    raise exception 'invalid name';
  end if;
  if char_length(coalesce(new.summary, '')) > 400 then
    raise exception 'invalid summary';
  end if;
  if jsonb_typeof(new.path) <> 'array' or jsonb_array_length(new.path) < 2 or jsonb_array_length(new.path) > 60 then
    raise exception 'invalid path';
  end if;
  return new;
end;
$$;

drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
for each row execute function public.touch_updated_at();

drop trigger if exists zones_touch on public.zones;
create trigger zones_touch before update on public.zones
for each row execute function public.touch_updated_at();

drop trigger if exists routes_touch on public.routes;
create trigger routes_touch before update on public.routes
for each row execute function public.touch_updated_at();

drop trigger if exists routes_validate on public.routes;
create trigger routes_validate before insert or update on public.routes
for each row execute function public.validate_route();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.record_activity(
  p_session_id text,
  p_event_name text,
  p_city text default null,
  p_transport_type text default null,
  p_route_id text default null,
  p_pwa boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_session_id !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'invalid session';
  end if;
  if p_event_name not in (
    'app_open', 'info_view', 'install_click', 'install_accepted', 'search',
    'transport_select', 'city_select', 'route_select', 'recommendation_accept',
    'recommendation_skip', 'location_set'
  ) then
    raise exception 'invalid event';
  end if;
  if p_transport_type is not null and p_transport_type not in ('taxi', 'kombi', 'bus') then
    raise exception 'invalid transport';
  end if;
  if p_city is not null and char_length(p_city) > 80 then
    raise exception 'invalid city';
  end if;
  if p_route_id is not null and char_length(p_route_id) > 140 then
    raise exception 'invalid route';
  end if;

  select count(*) into v_count
  from public.usage_events
  where session_id = p_session_id
    and created_at > now() - interval '1 hour';

  if v_count > 40 then
    return jsonb_build_object('ok', false, 'reason', 'rate');
  end if;

  insert into public.usage_events (session_id, event_name, city, transport_type, route_id, pwa)
  values (p_session_id, p_event_name, nullif(p_city, ''), p_transport_type, p_route_id, coalesce(p_pwa, false));

  insert into public.usage_sessions as s (session_id, first_seen, last_seen, searches, opens, pwa, last_city, last_transport)
  values (
    p_session_id, now(), now(),
    case when p_event_name = 'search' then 1 else 0 end,
    case when p_event_name = 'app_open' then 1 else 0 end,
    coalesce(p_pwa, false),
    nullif(p_city, ''),
    p_transport_type
  )
  on conflict (session_id) do update set
    last_seen = now(),
    searches = s.searches + case when p_event_name = 'search' then 1 else 0 end,
    opens = s.opens + case when p_event_name = 'app_open' then 1 else 0 end,
    pwa = s.pwa or coalesce(p_pwa, false),
    last_city = coalesce(nullif(p_city, ''), s.last_city),
    last_transport = coalesce(p_transport_type, s.last_transport);

  if random() < 0.02 then
    delete from public.usage_events where created_at < now() - interval '90 days';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  result := jsonb_build_object(
    'sessions_total', (select count(*) from public.usage_sessions),
    'sessions_today', (select count(*) from public.usage_sessions where last_seen >= date_trunc('day', now())),
    'sessions_7d', (select count(*) from public.usage_sessions where last_seen >= now() - interval '7 days'),
    'searches_today', (select count(*) from public.usage_events where event_name = 'search' and created_at >= date_trunc('day', now())),
    'searches_7d', (select count(*) from public.usage_events where event_name = 'search' and created_at >= now() - interval '7 days'),
    'opens_today', (select count(*) from public.usage_events where event_name = 'app_open' and created_at >= date_trunc('day', now())),
    'install_clicks_7d', (select count(*) from public.usage_events where event_name = 'install_click' and created_at >= now() - interval '7 days'),
    'pwa_sessions', (select count(*) from public.usage_sessions where pwa),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'people', people, 'searches', searches) order by day)
      from (
        select created_at::date as day,
          count(distinct session_id) as people,
          count(*) filter (where event_name = 'search') as searches
        from public.usage_events
        where created_at >= now() - interval '14 days'
        group by 1
      ) days
    ), '[]'::jsonb),
    'top_cities', coalesce((
      select jsonb_agg(row_to_json(cities)::jsonb order by hits desc)
      from (
        select city, count(*) as hits
        from public.usage_events
        where event_name = 'search' and city is not null and created_at >= now() - interval '30 days'
        group by city
        order by hits desc
        limit 6
      ) cities
    ), '[]'::jsonb),
    'top_routes', coalesce((
      select jsonb_agg(jsonb_build_object('route_id', route_id, 'name', name, 'hits', hits) order by hits desc)
      from (
        select e.route_id, coalesce(r.name, e.route_id) as name, count(*) as hits
        from public.usage_events e
        left join public.routes r on r.id = e.route_id
        where e.event_name = 'search' and e.route_id is not null and e.created_at >= now() - interval '30 days'
        group by e.route_id, r.name
        order by hits desc
        limit 6
      ) routes_top
    ), '[]'::jsonb),
    'transport_mix', jsonb_build_object(
      'taxi', (select count(*) from public.usage_events where event_name = 'search' and transport_type = 'taxi' and created_at >= now() - interval '30 days'),
      'kombi', (select count(*) from public.usage_events where event_name = 'search' and transport_type = 'kombi' and created_at >= now() - interval '30 days'),
      'bus', (select count(*) from public.usage_events where event_name = 'search' and transport_type = 'bus' and created_at >= now() - interval '30 days')
    ),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('event_name', event_name, 'city', city, 'transport_type', transport_type, 'created_at', created_at) order by created_at desc)
      from (
        select event_name, city, transport_type, created_at
        from public.usage_events
        order by created_at desc
        limit 12
      ) recent_events
    ), '[]'::jsonb)
  );
  return result;
end;
$$;

revoke all on function public.record_activity(text, text, text, text, text, boolean) from public;
grant execute on function public.record_activity(text, text, text, text, text, boolean) to anon, authenticated;
revoke all on function public.admin_summary() from public;
grant execute on function public.admin_summary() to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.places enable row level security;
alter table public.zones enable row level security;
alter table public.routes enable row level security;
alter table public.usage_sessions enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists places_read_active on public.places;
create policy places_read_active on public.places for select to anon using (active);
drop policy if exists places_admin_all on public.places;
create policy places_admin_all on public.places for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists zones_read_active on public.zones;
create policy zones_read_active on public.zones for select to anon using (active);
drop policy if exists zones_admin_all on public.zones;
create policy zones_admin_all on public.zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists routes_read_active on public.routes;
create policy routes_read_active on public.routes for select to anon using (active);
drop policy if exists routes_admin_all on public.routes;
create policy routes_admin_all on public.routes for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.places, public.zones, public.routes to anon, authenticated;
grant insert, update, delete on public.places, public.zones, public.routes to authenticated;
revoke all on public.usage_sessions from anon, authenticated;
revoke all on public.usage_events from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places'
  ) then
    alter publication supabase_realtime add table public.places;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zones'
  ) then
    alter publication supabase_realtime add table public.zones;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'routes'
  ) then
    alter publication supabase_realtime add table public.routes;
  end if;
end $$;

notify pgrst, 'reload schema';
