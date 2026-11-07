-- NakoLive phase one. Idempotent schema for the free tier.
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
    'recommendation_skip', 'location_set', 'directions_open'
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

-- Driver registration, approval and deliberately delayed live locations.
create table if not exists public.driver_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 30),
  transport_type text not null check (transport_type in ('taxi', 'kombi', 'bus')),
  vehicle_description text not null check (char_length(vehicle_description) between 2 and 120),
  plate text not null check (char_length(plate) between 2 and 30),
  route_ids text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'banned')),
  rejection_message text,
  warning_message text,
  warned_at timestamptz,
  banned_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade early driver-profile drafts that used separate make/model/colour fields.
alter table public.driver_profiles add column if not exists vehicle_description text;
alter table public.driver_profiles add column if not exists warning_message text;
alter table public.driver_profiles add column if not exists warned_at timestamptz;
alter table public.driver_profiles add column if not exists banned_at timestamptz;
alter table public.driver_profiles drop constraint if exists driver_profiles_status_check;
alter table public.driver_profiles add constraint driver_profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'banned'));
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'driver_profiles' and column_name = 'vehicle_make'
  ) then
    execute 'update public.driver_profiles set vehicle_description = trim(concat_ws('' '', vehicle_color, vehicle_make, vehicle_model)) where vehicle_description is null';
  end if;
end $$;
update public.driver_profiles set vehicle_description = 'Vehicle details pending' where vehicle_description is null;
alter table public.driver_profiles alter column vehicle_description set not null;
alter table public.driver_profiles drop column if exists vehicle_make;
alter table public.driver_profiles drop column if exists vehicle_model;
alter table public.driver_profiles drop column if exists vehicle_color;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'driver_profiles_vehicle_description_check') then
    alter table public.driver_profiles add constraint driver_profiles_vehicle_description_check
      check (char_length(vehicle_description) between 2 and 120);
  end if;
end $$;

create unique index if not exists driver_profiles_plate_idx on public.driver_profiles (upper(plate));
create index if not exists driver_profiles_queue_idx on public.driver_profiles (transport_type, status, created_at desc);

create table if not exists public.driver_locations (
  driver_id uuid primary key references public.driver_profiles(user_id) on delete cascade,
  transport_type text not null check (transport_type in ('taxi', 'kombi', 'bus')),
  plate text not null,
  route_ids text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision,
  speed double precision,
  heading double precision,
  motion_state text not null default 'idle' check (motion_state in ('moving', 'idle')),
  sharing boolean not null default false,
  sampled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists driver_locations_public_idx on public.driver_locations (transport_type, sharing, updated_at desc);
create index if not exists driver_locations_routes_gin_idx on public.driver_locations using gin (route_ids);

drop trigger if exists driver_profiles_touch on public.driver_profiles;
create trigger driver_profiles_touch before update on public.driver_profiles
for each row execute function public.touch_updated_at();

drop function if exists public.publish_driver_location(double precision, double precision, double precision, double precision, double precision, timestamptz);
create or replace function public.publish_driver_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_speed double precision default null,
  p_heading double precision default null,
  p_sampled_at timestamptz default now(),
  p_motion_state text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.driver_profiles%rowtype;
  last_update timestamptz;
  last_lat double precision;
  last_lng double precision;
  last_accuracy double precision;
  state text;
begin
  select * into p from public.driver_profiles where user_id = auth.uid();
  if p.user_id is null or p.status <> 'approved' then raise exception 'driver not approved'; end if;
  if p_accuracy is not null and p_accuracy > 120 then return jsonb_build_object('ok', false, 'reason', 'accuracy'); end if;
  select updated_at, lat, lng, accuracy into last_update, last_lat, last_lng, last_accuracy from public.driver_locations where driver_id = auth.uid();
  if last_update is not null and last_update > now() - interval '8 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'rate');
  end if;
  state := case
    when p_motion_state in ('moving', 'idle') then p_motion_state
    when coalesce(p_speed, 0) >= 1.8 then 'moving'
    when last_lat is not null and sqrt(
      power((p_lat - last_lat) * 111320, 2) +
      power((p_lng - last_lng) * 111320 * cos(radians(p_lat)), 2)
    ) >= greatest(35, least(120, coalesce(p_accuracy, 40) + coalesce(last_accuracy, 40))) then 'moving'
    else 'idle'
  end;
  insert into public.driver_locations as d
    (driver_id, transport_type, plate, route_ids, lat, lng, accuracy, speed, heading, motion_state, sharing, sampled_at, updated_at)
  values
    (p.user_id, p.transport_type, p.plate, p.route_ids, p_lat, p_lng, p_accuracy, p_speed, p_heading, state, true, coalesce(p_sampled_at, now()), now())
  on conflict (driver_id) do update set
    transport_type = excluded.transport_type,
    plate = excluded.plate,
    route_ids = excluded.route_ids,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy = excluded.accuracy,
    speed = excluded.speed,
    heading = excluded.heading,
    motion_state = excluded.motion_state,
    sharing = true,
    sampled_at = excluded.sampled_at,
    updated_at = now();
  return jsonb_build_object('ok', true, 'motion_state', state);
end;
$$;

create or replace function public.stop_driver_location()
returns void language sql security definer set search_path = public
as $$ update public.driver_locations set sharing = false, updated_at = now() where driver_id = auth.uid(); $$;

create or replace function public.review_driver(p_driver_id uuid, p_status text, p_message text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid status'; end if;
  update public.driver_profiles set
    status = p_status,
    rejection_message = case when p_status = 'rejected' then nullif(trim(p_message), '') else null end,
    warning_message = case when p_status = 'approved' then null else warning_message end,
    warned_at = case when p_status = 'approved' then null else warned_at end,
    banned_at = case when p_status = 'approved' then null else banned_at end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where user_id = p_driver_id;
  if p_status = 'rejected' then update public.driver_locations set sharing = false where driver_id = p_driver_id; end if;
end;
$$;

create or replace function public.moderate_driver(p_driver_id uuid, p_action text, p_message text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  clean_message text := nullif(trim(p_message), '');
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_action not in ('warn', 'ban', 'delete') then raise exception 'invalid action'; end if;
  if p_action in ('warn', 'ban') and clean_message is null then raise exception 'message required'; end if;

  if p_action = 'warn' then
    update public.driver_profiles set warning_message = clean_message, warned_at = now(), reviewed_by = auth.uid()
    where user_id = p_driver_id and status = 'approved';
  elsif p_action = 'ban' then
    update public.driver_profiles set status = 'banned', rejection_message = clean_message,
      warning_message = null, warned_at = null, banned_at = now(), reviewed_at = now(), reviewed_by = auth.uid()
    where user_id = p_driver_id;
    update public.driver_locations set sharing = false, updated_at = now() where driver_id = p_driver_id;
  else
    delete from public.driver_profiles where user_id = p_driver_id;
  end if;
end;
$$;

alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;

drop policy if exists driver_profiles_own_select on public.driver_profiles;
create policy driver_profiles_own_select on public.driver_profiles for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());
drop policy if exists driver_profiles_own_insert on public.driver_profiles;
create policy driver_profiles_own_insert on public.driver_profiles for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists driver_profiles_own_update on public.driver_profiles;
create policy driver_profiles_own_update on public.driver_profiles for update to authenticated
using (((select auth.uid()) = user_id and status in ('pending', 'rejected')) or public.is_admin())
with check ((((select auth.uid()) = user_id and status = 'pending' and rejection_message is null and reviewed_by is null and reviewed_at is null)) or public.is_admin());

drop policy if exists driver_locations_public_select on public.driver_locations;
create policy driver_locations_public_select on public.driver_locations for select to anon, authenticated
using (sharing and updated_at > now() - interval '5 minutes');

grant select, insert, update on public.driver_profiles to authenticated;
grant select on public.driver_locations to anon, authenticated;
revoke all on function public.publish_driver_location(double precision, double precision, double precision, double precision, double precision, timestamptz, text) from public;
grant execute on function public.publish_driver_location(double precision, double precision, double precision, double precision, double precision, timestamptz, text) to authenticated;
revoke all on function public.stop_driver_location() from public;
grant execute on function public.stop_driver_location() to authenticated;
revoke all on function public.review_driver(uuid, text, text) from public;
grant execute on function public.review_driver(uuid, text, text) to authenticated;
revoke all on function public.moderate_driver(uuid, text, text) from public;
grant execute on function public.moderate_driver(uuid, text, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_locations') then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_profiles') then
    alter publication supabase_realtime add table public.driver_profiles;
  end if;
end $$;

notify pgrst, 'reload schema';
