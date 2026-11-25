import assert from 'node:assert/strict'
import test from 'node:test'
import { acidBaseFamily, buildAtom, canonicalKey, combineCurated, deterministicRule, elements, recipes, sampleFormula, substances } from '../lib/chem.ts'

test('each atomic number constructs the corresponding representative isotope', () => {
  assert.equal(elements.length, 118)
  for (const [index, e] of elements.entries()) {
    const z = index + 1
    const atom = buildAtom(z, e.referenceIsotope - z, z)
    assert.equal(atom.element.id, e.id)
    assert.equal(atom.massNumber, e.referenceIsotope)
    assert.equal(atom.atomicNumber, z)
    assert.equal(atom.isotopeStatus, 'known')
    assert.equal(atom.charge, 0)
  }
  assert.equal(buildAtom(118, 176, 118).element.symbol, 'Og')
})

test('neutrons determine isotope and electrons determine signed charge', () => {
  assert.equal(buildAtom(1, 0, 1).element.name, 'Hydrogen')
  assert.equal(buildAtom(1, 1, 0).massNumber, 2)
  assert.equal(buildAtom(3, 4, 2).charge, 1)
  assert.equal(buildAtom(17, 18, 18).charge, -1)
  assert.equal(buildAtom(2, 2, 2).massNumber, 4)
  assert.equal(buildAtom(6, 8, 6).isotopeStatus, 'known')
  assert.equal(buildAtom(6, 9, 6).isotopeStatus, 'known')
  assert.equal(buildAtom(50, 115, 50).isotopeStatus, 'unverified')
})

test('invalid and unsupported configurations receive meaningful errors', () => {
  for (const [p,n,e] of [[0,0,0],[119,176,119],[1,0,-1],[2,0,2],[1.5,1,1],[3,-1,3],[1,0,10],[1,160,1],[NaN,0,1]]) {
    assert.throws(() => buildAtom(p,n,e), RangeError)
  }
})

test('a recipe and its key are independent of input order', () => {
  assert.equal(canonicalKey('oxygen','hydrogen'), canonicalKey('hydrogen','oxygen'))
  const water = combineCurated('oxygen','hydrogen')
  assert.deepEqual(water, combineCurated('hydrogen','oxygen'))
  assert.equal(water?.classification,'verified')
  assert.equal(water?.product?.formula, 'H2O')
  assert.equal(water?.equation, '2H2 + O2 → 2H2O')
  assert.ok(water?.conditions)
  assert.equal(combineCurated('iron','sulfur')?.product?.formula, 'FeS')
  assert.equal(combineCurated('sodium','chlorine')?.product?.formula, 'NaCl')
  assert.equal(combineCurated('carbon','oxygen')?.product?.formula, 'CO2')
  assert.equal(combineCurated('helium','neon'), undefined)
  assert.equal(deterministicRule('helium','neon')?.classification,'no-reaction')
})

function counts(formula: string, coefficient: number, total: Map<string, number>) {
  const expand = (text: string, scale: number) => {
    for (const [,symbol,count] of text.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
      assert.ok(elements.some(e => e.symbol === symbol))
      total.set(symbol, (total.get(symbol) ?? 0) + Number(count || 1) * scale)
    }
  }
  const ungrouped = formula.replace(/\(([^()]+)\)(\d+)/g, (_, group: string, n: string) => {
    expand(group, Number(n) * coefficient)
    return ''
  })
  expand(ungrouped, coefficient)
}

test('acid and base discoveries are reachable from element samples', () => {
  const available = new Set(elements.map(e => e.id))
  for (const [a, b, product] of [
    ['hydrogen', 'oxygen', 'water'], ['carbon', 'oxygen', 'carbon-dioxide'],
    ['carbon-dioxide', 'water', 'carbonic-acid'],
    ['sulfur', 'oxygen', 'sulfur-dioxide'], ['sulfur-dioxide', 'oxygen', 'sulfur-trioxide'],
    ['sulfur-trioxide', 'water', 'sulfuric-acid'],
    ['magnesium', 'oxygen', 'magnesium-oxide'], ['magnesium-oxide', 'water', 'magnesium-hydroxide'],
    ['calcium', 'oxygen', 'calcium-oxide'], ['calcium-oxide', 'water', 'calcium-hydroxide'],
    ['nitrogen', 'hydrogen', 'ammonia'],
  ]) {
    assert.ok(available.has(a) && available.has(b))
    const result = combineCurated(b, a)
    assert.equal(result?.product?.id, product)
    assert.equal(result?.product?.category, 'Compound')
    available.add(product)
  }
  for (const id of acidBaseFamily.keys()) assert.ok(available.has(id))
})

test('all curated neutral equations conserve every element and reference catalog entries', () => {
  const ids = new Set(substances.map(s => s.id))
  const keys = new Set<string>()
  for (const r of recipes) {
    assert.ok([r.a,r.b,r.productId].every(id => ids.has(id)))
    assert.deepEqual(r.reactantFormulas, [r.a, r.b].map(id => sampleFormula(substances.find(s => s.id === id)!)))
    const terms = [...r.reactantFormulas, r.formula].map((f, i) => (r.coefficients[i] === 1 ? '' : r.coefficients[i]) + f)
    assert.deepEqual(r.equation.split(/ \+ | [→⇌] /), terms)
    const key = canonicalKey(r.a,r.b)
    assert.ok(!keys.has(key))
    keys.add(key)
    const left = new Map<string,number>(), right = new Map<string,number>()
    r.reactantFormulas.forEach((f,i) => counts(f, r.coefficients[i], left))
    counts(r.formula, r.coefficients[2], right)
    assert.deepEqual(left,right,r.equation)
  }
})
