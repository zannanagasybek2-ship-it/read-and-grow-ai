-- Run once in the Supabase SQL Editor. All data is accessed by the Vercel server.
create table if not exists public.rg_config(k text primary key,v text not null);
create table if not exists public.rg_students(
 id uuid primary key default gen_random_uuid(), uid uuid unique not null,
 name text not null, class_name text not null, records jsonb not null default '{}',
 updated timestamptz not null default now()
);
create table if not exists public.rg_library(id text primary key,body jsonb not null);
create table if not exists public.rg_media(
 id uuid primary key,student uuid not null references public.rg_students(id) on delete cascade,
 story text not null,path text unique not null,type text not null,unique(student,story)
);
create table if not exists public.rg_pending(
 id uuid primary key,student uuid not null references public.rg_students(id) on delete cascade,
 story text not null,path text not null,type text not null,size integer not null,
 expires timestamptz not null default(now()+interval '15 minutes')
);
create table if not exists public.rg_limits(k text primary key,n integer not null,expires timestamptz not null);
alter table public.rg_config enable row level security;
alter table public.rg_students enable row level security;
alter table public.rg_library enable row level security;
alter table public.rg_media enable row level security;
alter table public.rg_pending enable row level security;
alter table public.rg_limits enable row level security;
-- No anonymous/authenticated policies: service_role alone accesses these tables.
revoke all on public.rg_config,public.rg_students,public.rg_library,public.rg_media,public.rg_pending,public.rg_limits from anon,authenticated;
grant all on public.rg_config,public.rg_students,public.rg_library,public.rg_media,public.rg_pending,public.rg_limits to service_role;

create or replace function public.rg_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare result integer;
begin
 insert into rg_limits(k,n,expires) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(k) do update set
 n=case when rg_limits.expires<=now() then 1 else rg_limits.n+1 end,
 expires=case when rg_limits.expires<=now() then now()+make_interval(secs=>p_seconds) else rg_limits.expires end
 returning n into result;
 return result<=p_limit;
end $$;

create or replace function public.rg_save_progress(p_uid uuid,p_name text,p_incoming jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved jsonb; sid text; inc jsonb; prev jsonb; merged jsonb; field text; maximum integer;
begin
 select records into saved from rg_students where uid=p_uid for update;
 if not found then raise exception 'Reader not found'; end if;
 for sid,inc in select * from jsonb_each(p_incoming) loop
  prev=coalesce(saved->sid,'{}'::jsonb);
  merged=inc||jsonb_build_object('read',coalesce((inc->>'read')::boolean,false) or coalesce((prev->>'read')::boolean,false));
  foreach field in array array['vocab','quiz','order','gap'] loop
   maximum=case field when 'vocab' then 20 when 'quiz' then 30 when 'order' then 20 else 10 end;
   merged=jsonb_set(merged,array[field],to_jsonb(greatest(coalesce((prev->>field)::integer,0),least(maximum,greatest(0,coalesce((inc->>field)::integer,0))))));
  end loop;
  merged=merged-'media'-'teacherFeedback';
  if prev?'media' then merged=jsonb_set(merged,'{media}',prev->'media'); end if;
  if prev?'teacherFeedback' then merged=jsonb_set(merged,'{teacherFeedback}',prev->'teacherFeedback'); end if;
  saved=jsonb_set(saved,array[sid],merged,true);
 end loop;
 update rg_students set records=saved,name=left(p_name,35),updated=now() where uid=p_uid;
 return saved;
end $$;

create or replace function public.rg_patch_record(p_id uuid,p_story text,p_field text,p_value jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare saved jsonb;
begin
 if p_field not in ('media','teacherFeedback') then raise exception 'Invalid field'; end if;
 select records into saved from rg_students where id=p_id for update;
 if not found then raise exception 'Reader not found'; end if;
 saved=jsonb_set(saved,array[p_story],coalesce(saved->p_story,'{}'::jsonb)||jsonb_build_object(p_field,p_value),true);
 update rg_students set records=saved where id=p_id;
 return true;
end $$;
revoke all on function public.rg_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.rg_save_progress(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.rg_patch_record(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.rg_rate_limit(text,integer,integer) to service_role;
grant execute on function public.rg_save_progress(uuid,text,jsonb) to service_role;
grant execute on function public.rg_patch_record(uuid,text,text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reading-media','reading-media',false,20971520,array['video/mp4','video/webm','audio/webm','audio/mpeg','audio/wav','audio/x-wav'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
