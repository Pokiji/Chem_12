begin;
alter table public.chemical_recipes alter column product drop not null;

-- Single-output recipes keep their original foreign key. Multi-output recipes
-- use one ordered row per canvas sample, including repeated species.
alter table public.chemical_recipes alter column product drop not null;
create table public.chemical_recipe_products (
  pair_key text not null references public.chemical_recipes on delete cascade,
  position integer not null check (position > 0),
  product text not null references public.substances,
  primary key (pair_key, position)
);
alter table public.chemical_recipe_products enable row level security;
revoke all on public.chemical_recipe_products from anon, authenticated;
grant select on public.chemical_recipe_products to anon, authenticated;
create policy catalog_read on public.chemical_recipe_products for select to anon, authenticated using (true);
grant all on public.chemical_recipe_products to service_role;

create function public.seed_equilibrium_recipe(
  pair_key_arg text, a text, b text, equation_arg text, conditions_arg text, products text[]
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(cardinality(products), 0) < 2 then
    raise exception 'At least two output samples are required';
  end if;
  insert into public.chemical_recipes(pair_key, input_a, input_b, equation, conditions)
  values (pair_key_arg, a, b, equation_arg, conditions_arg)
  on conflict (pair_key) do update set input_a = excluded.input_a, input_b = excluded.input_b,
    product = null, equation = excluded.equation, conditions = excluded.conditions;
  delete from public.chemical_recipe_products where pair_key = pair_key_arg;
  insert into public.chemical_recipe_products(pair_key, position, product)
  select pair_key_arg, ordinal, species from unnest(products) with ordinality as outputs(species, ordinal);
end $$;
revoke all on function public.seed_equilibrium_recipe(text,text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.seed_equilibrium_recipe(text,text,text,text,text,text[]) to service_role;

commit;
