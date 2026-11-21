import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, FlaskConical } from "lucide-react";
import { buildAtom, elements, type Substance } from "../lib/chem";
import { Molecule, colorFor } from "./Molecule";
import { formulaFor, type Entry } from "../lib/game";

export function Dialog({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <header>
          <h2>{title}</h2>
          <button className="iconbtn" aria-label="Close dialog" onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Builder({
  onBuild,
}: {
  onBuild: (id: string, label: string) => void;
}) {
  const [p, setP] = useState(1),
    [n, setN] = useState(0),
    [e, setE] = useState(1);
  let atom: ReturnType<typeof buildAtom> | undefined,
    error = "";
  try {
    atom = buildAtom(p, n, e);
  } catch (err) {
    error = (err as Error).message;
  }
  return (
    <>
      <p>Choose an isotope preset or adjust the particle counts.</p>
      <select
        aria-label="Element preset"
        value={elements[p - 1]?.id ?? ""}
        onChange={(ev) => {
          const s = elements.find((s) => s.id === ev.target.value)!;
          setP(s.number);
          setN(s.referenceIsotope - s.number);
          setE(s.number);
        }}
      >
        {elements.map((s) => (
          <option value={s.id} key={s.id}>
            {s.number} · {s.name}
          </option>
        ))}
      </select>
      <div className="atom-summary">
        <svg
          viewBox="0 0 100 100"
          width="84"
          height="84"
          role="img"
          aria-label={
            p +
            " protons, " +
            n +
            " neutrons and " +
            e +
            " electrons, schematic"
          }
        >
          <circle
            cx="50"
            cy="50"
            r="33"
            fill="none"
            stroke="#455778"
            strokeDasharray="3 3"
          />
          <circle cx="50" cy="50" r="16" fill="#435b85" />
          <text x="50" y="54" textAnchor="middle" fontSize="12" fill="white">
            {atom?.element.symbol ?? "?"}
          </text>
          {Array.from({ length: Math.min(12, Math.max(0, e)) }, (_, i) => {
            const angle = (i * 2 * Math.PI) / Math.min(12, e);
            return (
              <circle
                key={i}
                cx={50 + 33 * Math.cos(angle)}
                cy={50 + 33 * Math.sin(angle)}
                r="3.5"
                fill="#aad3fc"
              />
            );
          })}
        </svg>
        <div>
          <h2>{atom?.element.symbol ?? "?"}</h2>
          <b>
            {atom?.element.name ?? "Unknown nucleus"}
            {atom && "–" + atom.massNumber}
          </b>
        </div>
      </div>
      <div className="particle-inputs">
        {(
          [
            ["Protons", p, setP],
            ["Neutrons", n, setN],
            ["Electrons", e, setE],
          ] as const
        ).map(([name, value, set]) => (
          <label key={name}>
            {name}
            <input
              type="number"
              min="0"
              max={name === "Protons" ? 118 : name === "Neutrons" ? 200 : 119}
              value={Number.isNaN(value) ? "" : value}
              onChange={(event) => set(event.target.valueAsNumber)}
            />
          </label>
        ))}
      </div>
      {atom ? (
        <p>
          Atomic number {p} · Mass number {atom.massNumber} · Charge{" "}
          {atom.charge > 0 ? "+" : ""}
          {atom.charge}
          <br />
          {atom.isotopeStatus === "known"
            ? "Catalogued isotope"
            : "Isotope unverified in the local catalogue"}
          . Crafting uses a neutral elemental sample.
        </p>
      ) : (
        <p role="alert">{error}</p>
      )}
      <button
        className="primary"
        disabled={!atom}
        onClick={() =>
          atom &&
          onBuild(
            atom.element.id,
            atom.element.name +
              "–" +
              atom.massNumber +
              " (charge " +
              atom.charge +
              ")",
          )
        }
      >
        <FlaskConical size={16} /> Add elemental sample
      </button>
    </>
  );
}
export function Details({
  s,
  log,
  add,
}: {
  s: Substance;
  log: Entry[];
  add?: () => void;
}) {
  const el = elements.find((x) => x.id === s.id),
    entry = log.find((x) => x.productId === s.id);
  return (
    <>
      <div className="detail-model">
        <Molecule id={s.id} size={100} />
        <div>
          <div className="micro">{s.category}</div>
          <h2 style={{ color: colorFor(s.id) }}>{formulaFor(s)}</h2>
        </div>
      </div>
      <p>{s.description}</p>
      <dl>
        {Object.entries({
          Classification: s.classification,
          Family: el?.category,
          "Atomic number": el?.number,
          "Atomic mass": el?.massDisplay,
          "Common oxidation states": el?.oxidationStates.join(", "),
          Concept: s.concept !== s.description ? s.concept : undefined,
          Application: s.uses,
          Experiment: entry?.detail,
          History: entry
            ? entry.title + " · " + new Date(entry.time).toLocaleString()
            : undefined,
        }).map(
          ([k, v]) =>
            v !== undefined &&
            v !== "" && (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ),
        )}
      </dl>
      {add && (
        <button className="primary" onClick={add}>
          Place on canvas
        </button>
      )}
    </>
  );
}
export function Periodic({ inspect }: { inspect: (s: string) => void }) {
  return (
    <div className="table-scroll">
      <div className="periodic">
        {elements.map((el) => {
          const f =
            (el.number >= 57 && el.number <= 71) ||
            (el.number >= 89 && el.number <= 103);
          return (
            <button
              title={el.name}
              key={el.id}
              style={{
                gridRow: f ? (el.number <= 71 ? 8 : 9) : el.period,
                gridColumn: f
                  ? el.number <= 71
                    ? el.number - 54
                    : el.number - 86
                  : el.group || 3,
                color: colorFor(el.id),
              }}
              onClick={() => inspect(el.id)}
            >
              <small>{el.number}</small>
              <b>{el.symbol}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}
