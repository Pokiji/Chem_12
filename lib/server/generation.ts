import {createHash} from 'node:crypto'
import {z} from 'zod'
import {sampleFormula,type CombinationResult,type Substance} from '../chem'
import {boundedJSON} from './http'

const term=z.number().int().min(1).max(16)
const candidate=z.object({
  name:z.string().trim().min(2).max(56).regex(/^[A-Za-z][A-Za-z0-9 ()-]+$/),
  formula:z.string().min(1).max(40).regex(/^(?:[A-Z][a-z]?(?:[1-9]\d?)?)+$/),
  coefficients:z.tuple([term,term,term]),
  icon:z.enum(['atom','droplets','crystal','molecule'])
}).strict()

// The model can propose a single neutral product. Restrict the checked grammar
// to ordinary elemental formulas and decline unsupported notation.
function composition(formula:string) {
  if (!/^(?:[A-Z][a-z]?(?:[1-9]\d?)?)+$/.test(formula)) return null
  const counts=new Map<string,number>()
  for (const [,symbol,count] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts.set(symbol,(counts.get(symbol)||0)+Number(count||1))
  return counts
}

export interface ChemistryGenerationProvider {
  propose(a:Substance,b:Substance):Promise<CombinationResult|null>
}

export class OllamaChemistryProvider implements ChemistryGenerationProvider {
  async propose(a:Substance,b:Substance):Promise<CombinationResult|null> {
    const url=process.env.CHEM_GATEWAY_URL, token=process.env.CHEM_GATEWAY_TOKEN
    if (!url || !token) return null
    const endpoint=new URL(url)
    if (endpoint.protocol!=='https:' && !(endpoint.protocol==='http:' && endpoint.hostname==='127.0.0.1' && !process.env.VERCEL)) throw new Error('Gateway requires TLS')
    const fa=sampleFormula(a),fb=sampleFormula(b)
    const left=composition(fa),right=composition(fb)
    if (!left || !right) return null
    const headers:Record<string,string>={Authorization:'Bearer '+token,'Content-Type':'application/json'}
    if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
      headers['CF-Access-Client-Id']=process.env.CF_ACCESS_CLIENT_ID
      headers['CF-Access-Client-Secret']=process.env.CF_ACCESS_CLIENT_SECRET
    }
    const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({reactants:[{name:a.name,formula:fa},{name:b.name,formula:fb}]}),redirect:'error',signal:AbortSignal.timeout(18000)})
    if (!response.ok) throw new Error('Inference unavailable')
    const parsed=candidate.safeParse(await boundedJSON(response,4096))
    if (!parsed.success) return null
    const {name,formula:output,coefficients:[x,y,n],icon}=parsed.data
    const productCounts=composition(output)!
    const symbols=new Set([...left.keys(),...right.keys(),...productCounts.keys()])
    if (![...symbols].every(s=>(left.get(s)||0)*x+(right.get(s)||0)*y===(productCounts.get(s)||0)*n)) return null
    const id='candidate-'+createHash('sha256').update([a.id,b.id].sort().join('|')+':'+output).digest('hex').slice(0,24)
    const explanation='A model proposed this formula. Its atom counts balance. Formation and stability have not been verified.'
    const product:Substance={id,name,formula:output,category:'Compound',description:explanation,icon:{type:'local',name:icon},classification:'hypothetical',source:'ollama'}
    const part=(k:number,f:string)=>(k===1?'':String(k))+f
    return {product,classification:'hypothetical',equation:part(x,fa)+' + '+part(y,fb)+' → '+part(n,output),conditions:'Unknown',explanation}
  }
}
