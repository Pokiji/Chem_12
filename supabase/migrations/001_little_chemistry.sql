begin;
create table public.elements (
  atomic_number smallint primary key check (atomic_number between 1 and 118),
  symbol text unique not null,
  data jsonb not null
);
create table public.substances (
  id text primary key,
  data jsonb not null,
  source text not null default 'curated',
  created_at timestamptz not null default now()
);
create table public.chemical_recipes (
  pair_key text primary key,
  input_a text not null references public.substances,
  input_b text not null references public.substances,
  product text not null references public.substances,
  equation text not null,
  conditions text not null
);
create table public.generated_combinations (
  pair_key text primary key,
  input_a text not null references public.substances,
  input_b text not null references public.substances,
  product text not null references public.substances,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table public.player_profiles (
  player_id uuid primary key references auth.users on delete cascade,
  display_name text check (length(display_name)<=80)
);
create table public.player_discoveries (
  player_id uuid not null references auth.users on delete cascade,
  substance_id text not null references public.substances,
  discovered_at timestamptz not null default now(),
  primary key(player_id,substance_id)
);
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users on delete cascade,
  mode text not null check(mode in ('easy','hard')),
  created_at timestamptz not null default now(),
  unique(id,player_id)
);
create table public.workspace_items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  session_id uuid not null,
  substance_id text not null references public.substances,
  x real not null check(x between 0 and 1),
  y real not null check(y between 0 and 1),
  foreign key(session_id,player_id) references public.game_sessions(id,player_id) on delete cascade
);
create index game_sessions_player on public.game_sessions(player_id);
create index workspace_items_session on public.workspace_items(player_id,session_id);

do $$
declare tbl text;
begin
  foreach tbl in array array['elements','substances','chemical_recipes','generated_combinations','player_profiles','player_discoveries','game_sessions','workspace_items'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon, authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
  foreach tbl in array array['elements','substances','chemical_recipes','generated_combinations'] loop
    execute format('grant select on public.%I to anon,authenticated',tbl);
    execute format('create policy catalog_read on public.%I for select to anon,authenticated using(true)',tbl);
  end loop;
  foreach tbl in array array['player_profiles','player_discoveries','game_sessions','workspace_items'] loop
    execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
    execute format('create policy own_data on public.%I for all to authenticated using(player_id=(select auth.uid())) with check(player_id=(select auth.uid()))',tbl);
  end loop;
end $$;

create function public.save_candidate(pair_key_arg text,input_a_arg text,input_b_arg text,result_arg jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(pair_key_arg,0));
  select result into existing from public.generated_combinations where pair_key=pair_key_arg;
  if found then return existing; end if;
  insert into public.substances(id,data,source)
  values(result_arg->'product'->>'id',result_arg->'product','ollama');
  insert into public.generated_combinations(pair_key,input_a,input_b,product,result)
  values(pair_key_arg,input_a_arg,input_b_arg,result_arg->'product'->>'id',result_arg);
  return result_arg;
end $$;
revoke all on function public.save_candidate(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_candidate(text,text,text,jsonb) to service_role;
commit;
