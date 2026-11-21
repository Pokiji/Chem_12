import assert from 'node:assert/strict'
import {test} from 'node:test'
import {combineCurated} from '../lib/chem'

test('database and Redis adapters store the committed result, recover it, and enforce inference limits',async t=>{
  const settings={SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture',UPSTASH_REDIS_REST_URL:'https://cache.invalid',UPSTASH_REDIS_REST_TOKEN:'fixture'}
  const before={...process.env}
  Object.assign(process.env,settings)
  t.after(()=>{for(const key of Object.keys(settings)){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}})
  const water=combineCurated('hydrogen','oxygen')!
  let stored=false,cached=false,count=0
  t.mock.method(globalThis,'fetch',async(url:URL|string,init?:RequestInit)=>{
    if(String(url).startsWith(settings.UPSTASH_REDIS_REST_URL)){
      const [command]=JSON.parse(String(init?.body))
      if(command==='EVAL')return Response.json({result:++count})
      if(command==='SET')cached=true
      return Response.json({result:command==='GET'&&cached?JSON.stringify(water):null})
    }
    assert.equal(new Headers(init?.headers).get('apikey'),'fixture')
    if(String(url).includes('/rpc/save_candidate')){
      const args=JSON.parse(String(init?.body));assert.deepEqual(args.result_arg,water)
      stored=true;return Response.json(water)
    }
    return Response.json(stored?[{result:water}]:[])
  })
  const {save,lookup,allowGeneration}=await import('../lib/server/storage')
  assert.equal(await lookup('fixture'),null)
  assert.deepEqual(await save('fixture','hydrogen','oxygen',water),water)
  assert.ok(stored&&cached)
  assert.deepEqual(await lookup('fixture'),water)
  const req=new Request('https://example.invalid')
  for(let i=0;i<6;i++)assert.equal(await allowGeneration(req),true)
  assert.equal(await allowGeneration(req),false)
})

