import {createServer} from 'node:http'
import {createHash,timingSafeEqual} from 'node:crypto'
import {z} from 'zod'

const token=process.env.CHEM_GATEWAY_TOKEN
if (!token || token.length<32) throw new Error('Set a gateway token of at least 32 characters')
const digest=s=>createHash('sha256').update(s).digest()
const auth=digest('Bearer '+token)
const reactant=z.object({name:z.string().max(64).regex(/^[A-Za-z0-9 ()-]+$/),formula:z.string().max(40).regex(/^[A-Za-z0-9]+$/)}).strict()
const payload=z.object({reactants:z.tuple([reactant,reactant])}).strict()
let busy=false

async function read(stream,limit) {
  const chunks=[]
  let size=0
  for await(const chunk of stream) {
    size+=chunk.length
    if(size>limit) throw new Error('Size limit exceeded')
    chunks.push(Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

createServer({requestTimeout:10000,headersTimeout:8000},async(req,res)=>{
  const finish=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  if(req.method!=='POST' || req.url!=='/candidate') return finish(404,{error:'Unknown resource'})
  if(!timingSafeEqual(auth,digest(req.headers.authorization || ''))) return finish(401,{error:'Authentication required'})
  let data
  try {data=payload.parse(await read(req,2048))} catch {return finish(400,{error:'Invalid input'})}
  if(busy) return finish(429,{error:'Gateway busy'})
  busy=true
  try {
    const prompt='For the following two neutral reactants propose one balanced, non-hazardous educational sandbox product. If insufficient information return {}. Return only JSON with name, formula (plain elemental symbols and integer subscripts), coefficients [first reactant,second reactant,product], and icon (atom,droplets,crystal,molecule). Give no instructions. Reactants: '+JSON.stringify(data.reactants)
    const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'llama3.1:8b',prompt,format:'json',stream:false,options:{num_predict:200,temperature:0}}),signal:AbortSignal.timeout(16500)})
    if(!response.ok || !response.body) throw new Error('Inference failed')
    const answer=await read(response.body,16384)
    if(typeof answer.response!=='string' || Buffer.byteLength(answer.response)>4096) throw new Error('Invalid response')
    finish(200,JSON.parse(answer.response))
  } catch {finish(503,{error:'Inference unavailable'})}
  finally {busy=false}
}).listen(Number(process.env.GATEWAY_PORT || 8787),'127.0.0.1',()=>console.log('Inference gateway ready on loopback'))

