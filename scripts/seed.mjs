import {elements, substances, recipes, equilibriumRecipes, canonicalKey} from '../lib/chem.ts'

const {SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY} = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configure Supabase server credentials first.')

async function post(table, key, rows) {
  const url = new URL('/rest/v1/'+table, SUPABASE_URL)
  if (key) url.searchParams.set('on_conflict',key)
  const response = await fetch(url,{
    method:'POST',
    headers:{
      apikey:SUPABASE_SERVICE_ROLE_KEY,
      Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=minimal'
    },
    body:JSON.stringify(rows),
    signal:AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(table+' seed failed (HTTP '+response.status+')')
  console.log('Seeded '+table)
}

await post('elements','atomic_number',elements.map(e=>({atomic_number:e.atomicNumber,symbol:e.symbol,data:e})))
await post('substances','id',substances.map(s=>({id:s.id,data:s,source:'curated'})))
await post('chemical_recipes','pair_key',recipes.map(r=>({pair_key:canonicalKey(r.a,r.b),input_a:r.a,input_b:r.b,product:r.product,equation:r.equation,conditions:r.conditions})))

for (const r of equilibriumRecipes) {
  await post('rpc/seed_equilibrium_recipe', null, {
    pair_key_arg: canonicalKey(r.a, r.b), a: r.a, b: r.b,
    equation_arg: r.equation, conditions_arg: r.conditions, products: r.productIds,
  })
}
