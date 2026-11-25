import { useId } from "react";

type Atom = readonly [x: number, y: number, radius: number, element: string];
type Model = readonly Atom[];

const pigments: Record<string, string> = {
  h: "#dde8f5", he: "#f2bf91", c: "#77889b", n: "#577cff", o: "#f7685d",
  f: "#c4ee78", ne: "#ff9f6e", na: "#a68cff", mg: "#85cdb7", al: "#bec5d0",
  si: "#cea989", p: "#f2a260", s: "#f3ce57", cl: "#8bdd80", ar: "#c6a5ee",
  k: "#b59aee", ca: "#b8b7d4", fe: "#c89472", cu: "#d59166", zn: "#adb6c7",
  br: "#d18469", i: "#a784d3", au: "#ebc065", ag: "#d0d8de", li: "#d99ede",
  b: "#d5ab86", be: "#9fbd79", ti: "#b2c2c9", pb: "#97a3ba",
};

const aliases: Record<string, string> = {
  hydrogen: "h", helium: "he", lithium: "li", beryllium: "be", boron: "b", carbon: "c",
  nitrogen: "n", oxygen: "o", fluorine: "f", neon: "ne", sodium: "na", magnesium: "mg",
  aluminium: "al", aluminum: "al", silicon: "si", phosphorus: "p", sulfur: "s", sulphur: "s",
  chlorine: "cl", argon: "ar", potassium: "k", calcium: "ca", iron: "fe", copper: "cu",
  zinc: "zn", bromine: "br", iodine: "i", gold: "au", silver: "ag", titanium: "ti", lead: "pb",
  h2: "h", o2: "o", n2: "n", cl2: "cl", br2: "br", i2: "i", f2: "f",
  h2o: "water", co2: "carbon-dioxide", nacl: "sodium-chloride", nh3: "ammonia", ch4: "methane",
};

function normalize(id: string) {
  const key = id.toLowerCase().trim().replace(/\s+/g, "-");
  return aliases[key] ?? key;
}

const fallbackColors = ["#7aace2", "#b4a4d1", "#9dc2b2", "#c6aca0", "#9eafc6", "#a9c594"];
function pigment(id: string) {
  const index = Array.from(id).reduce((hash, c) => (31 * hash + c.charCodeAt(0)) >>> 0, 0);
  return pigments[id] ?? fallbackColors[index % fallbackColors.length];
}

const pair = (a: string, b = a): Model => [[72, 41, 23, b], [42, 61, 27, a]];
const hydroxide = (metal: string): Model => [
  [79,32,10,"h"], [70,40,17,"o"], [56,54,23,metal], [37,69,17,"o"], [28,76,10,"h"],
];
const lattice = (a: string, b = a): Model => [
  [56, 26, 15, a], [78, 35, 16, b], [36, 40, 17, b], [58, 50, 19, a],
  [79, 62, 18, b], [37, 68, 18, a], [59, 77, 17, b],
];

const models: Record<string, Model> = {
  h: [[75, 43, 21, "h"], [43, 59, 25, "h"]],
  o: pair("o"), n: pair("n"), f: pair("f"), cl: pair("cl"), br: pair("br"), i: pair("i"),
  c: lattice("c"), fe: lattice("fe"), na: lattice("na"), cu: lattice("cu"),
  s: [[39,31,13,"s"],[59,24,14,"s"],[78,33,14,"s"],[86,51,14,"s"],
      [31,51,15,"s"],[38,70,16,"s"],[75,69,16,"s"],[57,77,16,"s"]],
  water: [[79, 67, 16, "h"], [58, 44, 26, "o"], [34, 67, 17, "h"]],
  "carbon-dioxide": [[86, 38, 19, "o"], [58, 51, 19, "c"], [30, 64, 21, "o"]],
  "sodium-chloride": lattice("na", "cl"), "iron-sulfide": lattice("fe", "s"),
  "magnesium-oxide": lattice("mg", "o"), "calcium-oxide": lattice("ca", "o"),
  "copper-oxide": lattice("cu","o"), "silicon-dioxide": lattice("si", "o"),
  "calcium-carbonate": [[73,32,18,"o"],[44,36,15,"o"],[59,53,18,"c"],[37,64,18,"o"],[78,67,22,"ca"]],
  "calcium-hydroxide": hydroxide("ca"),
  "magnesium-hydroxide": hydroxide("mg"),
  "carbonic-acid": [[59,25,15,"o"],[59,48,17,"c"],[36,62,16,"o"],[23,52,9,"h"],[81,62,16,"o"],[89,77,9,"h"]],
  "sulfur-dioxide": [[34,63,18,"o"],[59,43,21,"s"],[84,63,18,"o"]],
  "sulfur-trioxide": [[59,24,17,"o"],[59,49,20,"s"],[34,65,17,"o"],[84,65,17,"o"]],
  "sulfuric-acid": [[38,33,15,"o"],[76,32,15,"o"],[59,51,20,"s"],[36,65,15,"o"],[24,74,8,"h"],[81,65,15,"o"],[92,74,8,"h"]],
  ammonia: [[71,34,13,"h"],[58,50,24,"n"],[78,68,14,"h"],[36,67,15,"h"]],
  methane: [[61,27,13,"h"],[79,43,14,"h"],[57,52,24,"c"],[71,73,15,"h"],[35,62,16,"h"]],
};

export function colorFor(id: string) {
  const key = normalize(id);
  if (key === "water") return "#7fb9ec";
  return pigment(models[key]?.[0][3] ?? key);
}

function tint(hex: string, amount: number) {
  const channels = [1,3,5].map(i => {
    const channel = parseInt(hex.slice(i,i + 2), 16);
    return Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount);
  });
  return `rgb(${channels.join(",")})`;
}

export function Molecule({ id, size = 88, descriptor }: { id: string; size?: number; descriptor?:string }) {
  const prefix = "mol" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const key = normalize(id);
  const model: Model = models[key] ?? (key.startsWith("candidate-") && descriptor === "crystal" ? lattice(key) : key.startsWith("candidate-") && descriptor === "molecule" ? pair(key) : key.startsWith("candidate-") && descriptor === "droplets" ? [[44,58,20,key],[72,40,12,key]] : [[60, 51, 31, key]]);
  return <svg width={size} height={size} viewBox="0 0 120 102" fill="none" aria-hidden="true"
    focusable="false" style={{ display: "block", flexShrink: 0, overflow: "visible", pointerEvents: "none" }}>
    <defs>
      {model.map(([, , , element], i) => {
        const color = pigment(element);
        return <radialGradient key={i} id={`${prefix}-${i}`} cx="33%" cy="24%" r="81%" fx="32%" fy="22%">
          <stop stopColor={tint(color, .72)} />
          <stop offset=".16" stopColor={tint(color, .36)} />
          <stop offset=".43" stopColor={color} />
          <stop offset=".78" stopColor={tint(color, -.43)} />
          <stop offset=".95" stopColor={tint(color, -.66)} />
          <stop offset="1" stopColor={tint(color, -.43)} />
        </radialGradient>;
      })}
    </defs>
    {model.map(([x, y, r], i) => <g key={i}>
      <circle cx={x} cy={y} r={r} fill={`url(#${prefix}-${i})`} />
      <path d={`M ${x-r*.81} ${y-r*.39} Q ${x-r*.62} ${y-r*.83} ${x-r*.17} ${y-r*.89}`}
        stroke="white" strokeOpacity=".24" strokeWidth={r*.045} strokeLinecap="round" />
    </g>)}
  </svg>;
}

export default Molecule;
