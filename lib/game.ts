import { z } from "zod";
import { buildAtom, identifyAssembly, supplyCounts, type ParticleCounts, sampleFormula, substances, type Substance } from "./chem";

export type Mode = "easy" | "hard";
export interface Sample {
  key: string;
  id: string;
  counts?: ParticleCounts;
  x: number;
  y: number;
}
export interface Entry {
  time: number;
  title: string;
  detail: string;
  success: boolean;
  productId?: string;
}
export interface Lab {
  items: Sample[];
  discoveries: Substance[];
  log: Entry[];
}
export interface Game {
  mode: Mode;
  easy: Lab;
  hard: Lab;
  grid: boolean;
}
export const storageKey = "little-chemistry.v1";
export const starterOrder = [
  "hydrogen",
  "oxygen",
  "carbon",
  "nitrogen",
  "sodium",
  "chlorine",
  "iron",
  "sulfur",
  "helium",
  "magnesium",
];
export const sample = (id: string, x: number, y: number): Sample => {
  const counts = supplyCounts(id);
  return {
    id: counts ? "particle-group" : id,
    ...(counts && { counts: { ...counts } }),
    key: crypto.randomUUID(),
    x,
    y,
  };
};
export function freshLab(mode: Mode): Lab {
  return {
    items:
      mode === "easy"
        ? [
            sample("hydrogen", 22, 38),
            sample("oxygen", 77, 46),
            sample("nitrogen", 51, 26),
            sample("carbon", 46, 74),
          ]
        : [],
    discoveries: [],
    log: [],
  };
}
export function initialGame(): Game {
  return {
    mode: "hard",
    grid: true,
    easy: freshLab("easy"),
    hard: freshLab("hard"),
  };
}
const substance = z.object({
  id: z.string(),
  name: z.string(),
  formula: z.string(),
  category: z.string(),
  description: z.string(),
  classification: z.enum([
    "verified",
    "plausible",
    "hypothetical",
    "no-reaction",
  ]),
  source: z.string(),
  icon: z.object({ type: z.string(), name: z.string() }),
  concept: z.string().optional(),
  uses: z.string().optional(),
});
const lab = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      counts: z.object({
        protons: z.number().int(), neutrons: z.number().int(), electrons: z.number().int(),
      }).optional(),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),
  ),
  discoveries: z.array(substance),
  log: z.array(
    z.object({
      time: z.number(),
      title: z.string(),
      detail: z.string(),
      success: z.boolean(),
      productId: z.string().optional(),
    }),
  ),
});
export function restore(raw: string | null): Game {
  if (raw)
    try {
      const save = z
        .object({
          mode: z.enum(["easy", "hard"]),
          grid: z.boolean(),
          easy: lab,
          hard: lab,
        })
        .parse(JSON.parse(raw));
      for (const mode of ["easy", "hard"] as const) {
        const ids = new Set(
          [...substances, ...save[mode].discoveries].map((s) => s.id),
        );
        save[mode].items = save[mode].items.filter((s) => {
          // Legacy v1 samples have no recorded isotope and remain chemical samples.
          if (!s.counts) return ids.has(s.id);
          try { return identifyAssembly(s.counts) === s.id; } catch { return false; }
        });
      }
      return save;
    } catch {}
  return initialGame();
}
export function discover(lab: Lab, item: Substance) {
  return lab.discoveries.some((s) => s.id === item.id)
    ? lab.discoveries
    : [...lab.discoveries, item];
}
export type BuiltAtom = ReturnType<typeof buildAtom>;

export function addBuiltAtom(lab: Lab, atom: BuiltAtom): Lab {
  if (atom.charge !== 0) throw new Error("Crafting requires a neutral atom.");
  const element = substances.find((s) => s.id === atom.element.id)!;
  const item = sample(element.id, 28 + ((lab.items.length * 32) % 48), 45 + ((lab.items.length * 13) % 25));
  item.counts = { protons: atom.protons, neutrons: atom.neutrons, electrons: atom.electrons };
  return {
    items: [...lab.items, item],
    discoveries: discover(lab, element),
    log: [{
      title: atom.element.name + "–" + atom.massNumber,
      detail: "Built a neutral atom and added an elemental sample.",
      time: Date.now(),
      productId: element.id,
      success: true,
    }, ...lab.log].slice(0, 150),
  };
}

export function assemble(lab: Lab, source: Sample, target: Sample): Lab {
  if (!source.counts || !target.counts) {
    throw new Error("Add particles to a canvas-built atom or another particle group.");
  }
  const counts = {
    protons: source.counts.protons + target.counts.protons,
    neutrons: source.counts.neutrons + target.counts.neutrons,
    electrons: source.counts.electrons + target.counts.electrons,
  };
  const id = identifyAssembly(counts);
  const item = { ...sample(id, target.x, target.y), counts };
  const items = [...lab.items.filter(i => i.key !== source.key && i.key !== target.key), item];
  if (id === "particle-group") return { ...lab, items };
  const element = substances.find(s => s.id === id)!;
  const title = element.name + "–" + (counts.protons + counts.neutrons);
  const entry = { title, detail: "Assembled a neutral atom.", productId: id, success: true, time: Date.now() };
  return { items, discoveries: discover(lab, element), log: [entry, ...lab.log].slice(0, 150) };
}

export const subscript = (s: string) =>
  s.replace(/\d/g, (c) => "₀₁₂₃₄₅₆₇₈₉"[Number(c)]);
export function formulaFor(s: Substance) {
  return subscript(sampleFormula(s));
}
