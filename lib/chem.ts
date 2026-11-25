import elementRows from '../data/elements.json' with { type: 'json' }
import recipeRows from '../data/recipes.json' with { type: 'json' }

export type ElementRecord = (typeof elementRows)[number] & { atomicNumber: number }
export const elements: ElementRecord[] = elementRows.map(e => ({ ...e, atomicNumber: e.number }))

export type Classification = 'verified' | 'plausible' | 'hypothetical' | 'no-reaction'
export interface Substance {
  id: string
  name: string
  formula: string
  category: string
  description: string
  classification: Classification
  source: string
  icon: { type: string; name: string }
  concept?: string
  uses?: string
}
export interface CombinationResult {
  product?: Substance
  classification: Classification
  equation: string
  conditions: string
  explanation: string
}

// These formulas describe the elemental samples used by the sandbox recipes.
const molecularForms: Record<string, string> = {
  H: 'H2', N: 'N2', O: 'O2', F: 'F2', Cl: 'Cl2', Br: 'Br2', I: 'I2', S: 'S8',
}
export function sampleFormula(s: Substance) {
  return s.category === 'Element' ? molecularForms[s.formula] ?? s.formula : s.formula
}

export const recipes = recipeRows.map(recipe => ({ ...recipe, product: recipe.productId }))

const ambientDescriptions: Record<string, string> = {
  hydrogen: 'The lightest element. In its ordinary gaseous form, hydrogen atoms travel in pairs.',
  oxygen: 'A colorless diatomic gas involved in respiration and many oxidation reactions.',
  carbon: 'The backbone of organic molecules. Its atoms also form diamond and graphite.',
  nitrogen: 'A diatomic gas that makes up most of Earth’s atmosphere.',
  sodium: 'A soft alkali metal. Its atoms can lose an electron to form sodium ions.',
  chlorine: 'A halogen that forms diatomic molecules and chloride salts.',
  iron: 'A transition metal found in steel and in the oxygen-carrying proteins of blood.',
  sulfur: 'A yellow nonmetal whose atoms commonly form eight-membered rings.',
  helium: 'A light noble gas with a filled first electron shell.',
}

export const substances: Substance[] = [
  ...elements.map((e): Substance => ({
    id: e.id, name: e.name, formula: e.symbol, category: 'Element',
    description: ambientDescriptions[e.id] ?? `${e.name} belongs to the ${e.category.toLowerCase()} family of elements. Its nuclei contain ${e.number} protons.`,
    concept: `Changing the number of neutrons produces a different isotope of ${e.id}.`,
    classification: 'verified', source: 'curated', icon: { type: 'local', name: 'atom' },
  })),
  ...recipes.map((r): Substance => ({
    id: r.productId, name: r.name, formula: r.formula, category: 'Compound',
    description: r.concept, concept: r.concept, uses: r.uses, classification: 'verified',
    source: 'curated', icon: { type: 'local', name: r.productId === 'water' ? 'droplets' : 'molecule' },
  })),
]

// Library labels describe the curated acid and base discoveries in water.
export const acidBaseFamily = new Map<string, 'Acid' | 'Base'>([
  ['carbonic-acid', 'Acid'], ['sulfuric-acid', 'Acid'],
  ['ammonia', 'Base'], ['calcium-hydroxide', 'Base'], ['magnesium-hydroxide', 'Base'],
])

export function canonicalKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

const recipeIndex = new Map(recipes.map(r => [canonicalKey(r.a, r.b), r]))
const substanceIndex = new Map(substances.map(item => [item.id, item]))

export function combineCurated(a: string, b: string): CombinationResult | undefined {
  const recipe = recipeIndex.get(canonicalKey(a, b))
  if (!recipe) return
  return {
    product: substanceIndex.get(recipe.productId), classification: 'verified',
    equation: recipe.equation, conditions: recipe.conditions, explanation: recipe.concept,
  }
}

export function deterministicRule(a: string, b: string): CombinationResult | undefined {
  let explanation: string
  if (a === b) {
    explanation = 'Two samples of the same substance represent a larger sample under these conditions.'
  } else if ([a, b].some(id => id === 'helium' || id === 'neon')) {
    explanation = 'Helium and neon have filled outer electron shells. No ordinary reaction is represented for this pair.'
  } else {
    return
  }
  return { classification: 'no-reaction', equation: '', conditions: 'Ordinary conditions', explanation }
}

export interface ParticleCounts {
  protons: number
  neutrons: number
  electrons: number
}

export const supplies = {
  Proton: { protons: 1, neutrons: 0, electrons: 0 },
  Neutron: { protons: 0, neutrons: 1, electrons: 0 },
  Electron: { protons: 0, neutrons: 0, electrons: 1 },
} satisfies Record<string, ParticleCounts>

export function supplyCounts(id: string): ParticleCounts | undefined {
  if (Object.hasOwn(supplies, id)) return supplies[id as keyof typeof supplies]
}

// Groups without a nucleus can wait on the canvas for a proton.
export function identifyAssembly({ protons, neutrons, electrons }: ParticleCounts) {
  if (protons === 0) {
    if (![neutrons, electrons].every(Number.isSafeInteger) ||
        neutrons < 0 || neutrons > 200 || electrons < 0 || electrons > 1 ||
        neutrons + electrons === 0) {
      throw new RangeError('This particle group exceeds the supported counts.')
    }
    return 'particle-group'
  }
  const atom = buildAtom(protons, neutrons, electrons)
  return atom.charge === 0 ? atom.element.id : 'particle-group'
}

export function buildAtom(protons: number, neutrons: number, electrons: number) {
  if (![protons, neutrons, electrons].every(Number.isSafeInteger)) {
    throw new RangeError('Particle counts must be whole numbers.')
  }
  if (protons < 1 || protons > elements.length) {
    throw new RangeError('Choose between 1 and 118 protons.')
  }
  if (neutrons < 0 || neutrons > 200 || (neutrons === 0 && protons > 1)) {
    throw new RangeError('This neutron count is outside the supported nuclear configurations.')
  }
  if (electrons < 0 || electrons > protons + 1) {
    throw new RangeError('The builder supports electron counts from zero to one above the proton count.')
  }
  const element = elements[protons - 1]
  const massNumber = protons + neutrons
  const known = element.knownIsotopes.includes(massNumber)
  // Reject extreme extrapolations; a near-reference count alone never proves an isotope exists.
  if (!known && (massNumber < element.referenceIsotope * 0.65 || massNumber > element.referenceIsotope * 1.6 + 4)) {
    throw new RangeError('This mass number is outside the sandbox isotope range.')
  }
  return {
    element, atomicNumber: protons, massNumber, protons, neutrons, electrons,
    charge: protons - electrons, isotopeStatus: known ? 'known' as const : 'unverified' as const,
  }
}
