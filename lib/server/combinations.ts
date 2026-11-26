import {canonicalKey, combineCurated, deterministicRule, substances, type CombinationResult} from '../chem'
import {OllamaChemistryProvider} from './generation'
import {generatedSubstance,lookup,save} from './storage'

export class CombinationError extends Error {
  readonly status:number
  constructor(message:string,status:number) {
    super(message)
    this.status=status
  }
}

const none=(explanation:string):CombinationResult=>({classification:'no-reaction',equation:'',conditions:'',explanation})

export async function combineSubstances(inputA:string,inputB:string,canGenerate:()=>Promise<boolean>):Promise<CombinationResult> {
  const [a,b]=[inputA,inputB].sort()
  try {
    const resolve=(id:string)=>substances.find(item=>item.id===id) || generatedSubstance(id)
    const [first,second]=await Promise.all([resolve(a),resolve(b)])
    if (!first || !second) throw new CombinationError('Unknown substance. Select an item from the library.',404)
    const recipe=combineCurated(a,b)
    if (recipe) return recipe
    if (first.category === 'Ion' || second.category === 'Ion' || /[+-]$/.test(first.formula) || /[+-]$/.test(second.formula)) return none('No curated reaction is available for this ion pair.')
    const key=canonicalKey(a,b)
    const cached=await lookup(key).catch(()=>null)
    if (cached) return cached
    const rule=deterministicRule(a,b)
    if (rule) return rule
    if (!process.env.CHEM_GATEWAY_URL || !process.env.CHEM_GATEWAY_TOKEN) return none('There is no curated reaction for this pair. More evidence or specific conditions are needed.')
    if (!(await canGenerate())) throw new CombinationError('Inference limit reached. Try another experiment or return in one minute.',429)
    const candidate=await new OllamaChemistryProvider().propose(first,second)
    return candidate ? await save(key,a,b,candidate) : none('No balanced single-product candidate was supported for this pair.')
  } catch (error) {
    if (error instanceof CombinationError) throw error
    return none('The discovery service is temporarily unavailable. Try this pair later or explore a curated reaction.')
  }
}
