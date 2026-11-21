import { createHash } from 'node:crypto'
import type { CombinationResult, Substance } from '../chem'

const recent = new Map<string,CombinationResult>()
const memoryLimits = new Map<string,number>()
let localMinute = 0
const db = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
const redisURL = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

async function redis(...command:(string|number)[]) {
  if (!redisURL || !redisToken) return null
  const response = await fetch(redisURL,{method:'POST',headers:{Authorization:'Bearer '+redisToken,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(2500),cache:'no-store'})
  if (!response.ok) throw new Error('Redis unavailable')
  const {result,error} = await response.json()
  if (error) throw new Error('Redis command failed')
  return result
}

export async function allowGeneration(request:Request) {
  const minute = Math.floor(Date.now()/60000)
  const client = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'shared' : 'local'
  const key = 'lc:rate:'+minute+':'+createHash('sha256').update(client).digest('hex')
  if (redisURL && redisToken) {
    const count = await redis('EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",1,key)
    return typeof count==='number' && count<=6
  }
  if (process.env.VERCEL) return false
  if (localMinute !== minute) {memoryLimits.clear(); localMinute=minute}
  const count=(memoryLimits.get(key) || 0)+1
  memoryLimits.set(key,count)
  return count<=6
}

async function database(path:string,body?:unknown) {
  if (!db || !secret) return null
  const response = await fetch(new URL('/rest/v1/'+path,db),{method:body?'POST':'GET',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(4000),cache:'no-store'})
  if (!response.ok) throw new Error('Database unavailable')
  return response.json()
}

function remember(key:string,value:CombinationResult) {
  if (recent.size>=512) recent.delete(recent.keys().next().value!)
  recent.set(key,value)
}

export async function lookup(key:string):Promise<CombinationResult|null> {
  const hot=recent.get(key)
  if (hot) return hot
  const cached=await redis('GET','lc:v1:'+key).catch(()=>null)
  if (typeof cached==='string') return JSON.parse(cached)
  const rows=await database('generated_combinations?select=result&pair_key=eq.'+encodeURIComponent(key)+'&limit=1')
  const found=rows?.[0]?.result
  if (found) remember(key,found)
  return found || null
}

export async function generatedSubstance(id:string):Promise<Substance|undefined> {
  if (!/^candidate-[a-f0-9]{24}$/.test(id)) return
  for (const result of recent.values()) if (result.product?.id===id) return result.product
  const rows=await database('substances?select=data&id=eq.'+id+'&limit=1')
  return rows?.[0]?.data
}

export async function save(key:string,a:string,b:string,result:CombinationResult):Promise<CombinationResult> {
  const stored=await database('rpc/save_candidate',{pair_key_arg:key,input_a_arg:a,input_b_arg:b,result_arg:result}) || recent.get(key) || result
  remember(key,stored)
  await redis('SET','lc:v1:'+key,JSON.stringify(stored),'EX',86400).catch(()=>null)
  return stored
}
