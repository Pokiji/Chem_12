import { z } from 'zod'
import { buildAtom } from '../../../../lib/chem'
import { input, json } from '../../../../lib/server/http'

const particles = z.number().int().nonnegative()
export async function POST(request:Request) {
  try {
    const {protons, neutrons, electrons} = await input(request,z.object({protons:particles,neutrons:particles,electrons:particles}).strict())
    return json(buildAtom(protons, neutrons, electrons))
  } catch (error) {
    return json({error: error instanceof z.ZodError ? 'Supply integer particle counts.' : error instanceof Error ? error.message : 'Invalid atom.'},400)
  }
}
