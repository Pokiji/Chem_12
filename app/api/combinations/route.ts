import {z} from 'zod'
import {input,json} from '../../../lib/server/http'
import {CombinationError,combineSubstances} from '../../../lib/server/combinations'
import {allowGeneration} from '../../../lib/server/storage'

export const maxDuration=60
const id=z.string().min(1).max(96).regex(/^[A-Za-z0-9-]+$/)
const body=z.object({a:id,b:id}).strict()

export async function POST(request:Request) {
  const args=await input(request,body).catch(()=>null)
  if (!args) return json({error:'Supply two valid substance IDs in a and b.'},400)
  try {
    return json(await combineSubstances(args.a,args.b,()=>allowGeneration(request)))
  } catch (error) {
    if (error instanceof CombinationError) return json({error:error.message},error.status)
    return json({error:'Unable to process this experiment.'},503)
  }
}
