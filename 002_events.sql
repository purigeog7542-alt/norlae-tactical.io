-- เฟส 2: เอกสาร PDF + เหตุการณ์ที่สกัดได้ (รันต่อจาก 001_init.sql)

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path  text not null,
  title      text,
  status     text not null default 'uploaded' check (status in ('uploaded','extracted','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  document_id   uuid references public.documents(id) on delete cascade,
  event_date    date,
  kind          text not null default 'other' check (kind in ('drug_seizure','border_crossing','arrest_operation','other')),
  substance     text,
  quantity      numeric,
  unit          text,
  method        text,
  location_text text,
  tambon        text,
  amphoe        text,
  province      text,
  geom          extensions.geometry(Point, 4326),
  source_page   int,
  source_quote  text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);
create index if not exists events_project_idx on public.events (project_id, status);
create index if not exists events_geom_idx on public.events using gist (geom);

alter table public.documents enable row level security;
alter table public.events enable row level security;

create policy "documents: owner of project" on public.documents for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()));

create policy "events: owner of project" on public.events for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner = auth.uid()));

-- ที่เก็บไฟล์ PDF (private) แยกโฟลเดอร์ตาม project_id
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "storage documents: owner of project" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] in
         (select id::text from public.projects where owner = auth.uid()))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] in
         (select id::text from public.projects where owner = auth.uid()));

create or replace function public.get_events(p_project uuid, p_status text default null)
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select coalesce(jsonb_agg(
    (to_jsonb(e) - 'geom') || jsonb_build_object('lng', st_x(e.geom), 'lat', st_y(e.geom))
    order by e.event_date nulls last, e.created_at), '[]'::jsonb)
  from public.events e
  where e.project_id = p_project and (p_status is null or e.status = p_status);
$$;

create or replace function public.set_event_location(p_event uuid, p_lng float8, p_lat float8)
returns void language sql security invoker set search_path = public, extensions as $$
  update public.events set geom = st_setsrid(st_makepoint(p_lng, p_lat), 4326) where id = p_event;
$$;

revoke execute on function public.get_events(uuid, text) from public, anon;
revoke execute on function public.set_event_location(uuid, float8, float8) from public, anon;
grant execute on function public.get_events(uuid, text) to authenticated;
grant execute on function public.set_event_location(uuid, float8, float8) to authenticated;
