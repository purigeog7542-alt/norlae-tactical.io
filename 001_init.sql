-- Fang Intel: เฟส 1 – โปรเจกต์ + ฟีเจอร์แผนที่ (PostGIS) พร้อม Row Level Security
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์ -> Run

create extension if not exists postgis with schema extensions;

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       text,
  name       text,
  props      jsonb not null default '{}'::jsonb,
  geom       extensions.geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists features_geom_idx on public.features using gist (geom);
create index if not exists features_project_idx on public.features (project_id);

alter table public.projects enable row level security;
alter table public.features enable row level security;

create policy "projects: owner all" on public.projects
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy "features: owner of project" on public.features
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()));

-- บันทึกทั้งชุด (ลบของเดิมแล้วใส่ใหม่ ในทรานแซกชันเดียว) – ทำงานภายใต้ RLS ของผู้เรียก
create or replace function public.save_features(p_project uuid, p_features jsonb)
returns int language plpgsql security invoker set search_path = public, extensions as $$
declare n int;
begin
  delete from public.features where project_id = p_project;
  insert into public.features (project_id, kind, name, props, geom)
  select p_project,
         f->'properties'->>'kind',
         f->'properties'->>'name',
         coalesce(f->'properties', '{}'::jsonb),
         st_setsrid(st_geomfromgeojson(f->>'geometry'), 4326)
  from jsonb_array_elements(p_features) f;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.get_features(p_project uuid)
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', 'Feature', 'properties', props, 'geometry', st_asgeojson(geom)::jsonb)
         ), '[]'::jsonb)
  from public.features where project_id = p_project;
$$;

revoke execute on function public.save_features(uuid, jsonb) from public, anon;
revoke execute on function public.get_features(uuid) from public, anon;
grant execute on function public.save_features(uuid, jsonb) to authenticated;
grant execute on function public.get_features(uuid) to authenticated;
