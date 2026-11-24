"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointer,
} from "react";
import {
  Activity,
  ArrowDownAZ,
  Atom,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FlaskConical,
  Grid2X2,
  Menu,
  MousePointer2,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  supplies,
  supplyCounts,
  type ParticleCounts,
  combineCurated,
  deterministicRule,
  elements,
  recipes,
  substances,
  type CombinationResult,
  type Substance,
} from "../lib/chem";
import {
  assemble,
  addBuiltAtom,
  discover,
  formulaFor,
  freshLab,
  initialGame,
  restore,
  sample,
  starterOrder,
  storageKey,
  type Game,
  type Lab,
  type Mode,
  type Sample,
} from "../lib/game";
import { Builder, Details, Dialog, Periodic } from "./LabDialogs";
import { colorFor, Molecule } from "./Molecule";

type Modal =
  | "settings"
  | "help"
  | "table"
  | "journal"
  | "build"
  | "detail"
  | "reset"
  | null;
const catalog = new Map(substances.map((s) => [s.id, s]));
const elemental = new Map(elements.map((e) => [e.id, e]));
const ordered = [...new Set([...starterOrder, ...elements.map((e) => e.id)])];
const guides = [
  recipes.find((r) => r.productId === "water")!,
  recipes.find((r) => r.productId === "sodium-chloride")!,
  recipes.find((r) => r.productId === "iron-sulfide")!,
];
type Drag = {
  id: string;
  key?: string;
  startX: number;
  startY: number;
  pointer: number;
  moved: boolean;
};
function particleLabel(c: ParticleCounts) {
  if (c.protons + c.neutrons + c.electrons === 1) {
    return c.protons ? "Proton" : c.neutrons ? "Neutron" : "Electron";
  }
  return "Particle group";
}
function composition(c: ParticleCounts) {
  return `${c.protons}p · ${c.neutrons}n · ${c.electrons}e`;
}
function particleMark(c: ParticleCounts) {
  const charge = c.protons - c.electrons;
  return <span className="particle-mark">{particleLabel(c) === "Particle group" ? <Atom /> : particleLabel(c)[0].toLowerCase()}
    <sup>{charge > 0 ? "+" + charge : charge}</sup></span>;
}
export default function Laboratory() {
  const [game, setGame] = useState<Game>(initialGame),
    [ready, setReady] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [detail, setDetail] = useState("hydrogen");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [sorted, setSorted] = useState(false),
    [library, setLibrary] = useState(false);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<string | null>(null),
    [ghost, setGhost] = useState<{ id: string; counts?: ParticleCounts; x: number; y: number } | null>(
      null,
    );
  const [undo, setUndo] = useState<Sample[][]>([]),
    [flash, setFlash] = useState(""),
    [saved, setSaved] = useState(true);
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    suppress = useRef(false),
    pending = useRef(false);
  const mode = game.mode,
    lab = game[mode];
  const lookup = (id: string) =>
    catalog.get(id) ?? lab.discoveries.find((s) => s.id === id);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Guest saves are browser-only and must load after hydration.
      setGame(restore(localStorage.getItem(storageKey)));
    } catch {
      setSaved(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(game));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report the actual storage write status.
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [game, ready]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 2200);
    return () => clearTimeout(t);
  }, [flash]);
  function edit(fn: (l: Lab) => Lab) {
    setGame((g) => ({ ...g, [mode]: fn(g[mode]) }));
  }
  function checkpoint() {
    setUndo((u) => [...u.slice(-19), lab.items]);
  }
  function openDetail(id: string) {
    setDetail(id);
    setModal("detail");
  }
  function switchMode(m: Mode) {
    if (pending.current) return;
    setGame((g) => ({ ...g, mode: m }));
    setUndo([]);
    setTarget(null);
    setMessage("");
    setQuery("");
    setFilter("All");
  }
  const owned = (
    mode === "easy" ? ordered.map((id) => catalog.get(id)!) : []
  ).concat(lab.discoveries);
  const choices = owned.filter(
    (s) =>
      (filter === "All" ||
        s.category === (filter === "Elements" ? "Element" : "Compound")) &&
      (s.name + " " + s.formula).toLowerCase().includes(query.toLowerCase()),
  );
  if (sorted) choices.sort((a, b) => a.name.localeCompare(b.name));
  function add(
    id: string,
    x = 22 + ((lab.items.length * 17) % 55),
    y = 27 + ((lab.items.length * 19) % 47),
  ) {
    if (pending.current) return;
    checkpoint();
    edit((l) => ({ ...l, items: [...l.items, sample(id, x, y)] }));
    setLibrary(false);
  }
  function drop(source: Sample, destination: Sample) {
    if (pending.current) return;
    if (source.id !== "particle-group" && destination.id !== "particle-group") {
      void combine(source.id, destination.id, [source.key, destination.key], destination.x, destination.y);
      return;
    }
    setTarget(null);
    try {
      const next = assemble(lab, source, destination);
      const item = next.items.at(-1)!;
      checkpoint();
      edit(() => next);
      setFlash(item.key);
      setMessage((lookup(item.id)?.name ?? particleLabel(item.counts!)) + " · " + composition(item.counts!));
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  async function combine(
    first: string,
    second: string,
    remove: string[],
    x: number,
    y: number,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setTarget(null);
    try {
      let result = combineCurated(first, second);
      if (!result) {
        try {
          const res = await fetch("/api/combinations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ a: first, b: second }),
            signal: AbortSignal.timeout(25000),
          });
          const body = await res.json();
          if (!res.ok) throw Error(body.error || "Combination unavailable.");
          result = body as CombinationResult;
        } catch (err) {
          result = deterministicRule(first, second) ?? {
            classification: "no-reaction",
            equation: "",
            conditions: "",
            explanation:
              err instanceof TypeError
                ? "Offline. This pair has no local recipe."
                : (err as Error).message,
          };
        }
      }
      const outcome = result!,
        product = outcome.product,
        newItem = product && sample(product.id, x, y);
      if (product) {
        checkpoint();
        setFlash(newItem!.key);
      }
      const title = product ? product.name : "No supported reaction";
      const detail = [outcome.equation, outcome.conditions, outcome.explanation]
        .filter(Boolean)
        .join(" · ");
      const entry = {
        time: Date.now(),
        title,
        detail,
        success: !!product,
        productId: product?.id,
      };
      edit((l) => ({
        ...l,
        items: newItem
          ? [...l.items.filter((i) => !remove.includes(i.key)), newItem]
          : l.items,
        discoveries: product ? discover(l, product) : l.discoveries,
        log: [entry, ...l.log].slice(0, 150),
      }));
      setMessage(
        product
          ? product.name + " · " + outcome.equation + " · " + outcome.conditions
          : outcome.explanation,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function start(e: ReactPointer<HTMLButtonElement>, id: string, key?: string) {
    if (!e.isPrimary || e.button !== 0 || pending.current) return;
    suppress.current = false;
    drag.current = {
      id,
      key,
      startX: e.clientX,
      startY: e.clientY,
      pointer: e.pointerId,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointer<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5)
      d.moved = true;
    if (d.moved) setGhost({ id: d.id, counts: lab.items.find(i => i.key === d.key)?.counts ?? supplyCounts(d.id), x: e.clientX, y: e.clientY });
  }
  function end(e: ReactPointer<HTMLButtonElement>) {
    const d = drag.current;
    if (d?.pointer !== e.pointerId) return;
    drag.current = null;
    setGhost(null);
    if (!d?.moved || !canvas.current) return;
    suppress.current = true;
    const rect = canvas.current.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      return;
    const x = Math.max(
        10,
        Math.min(90, ((e.clientX - rect.left) / rect.width) * 100),
      ),
      y = Math.max(
        18,
        Math.min(82, ((e.clientY - rect.top) / rect.height) * 100),
      );
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-sample-key]")?.dataset.sampleKey;
    const near = lab.items
      .filter((i) => i.key !== d.key)
      .map((i) => ({
        i,
        dist: i.key === hit ? 0 : Math.hypot(
          ((i.x - x) * rect.width) / 100,
          ((i.y - y) * rect.height) / 100,
        ),
      }))
      .sort((a, b) => a.dist - b.dist)[0];
    if (near && near.dist < 58) {
      drop(lab.items.find(i => i.key === d.key) ?? sample(d.id, x, y), near.i);
    } else if (d.key) {
      checkpoint();
      edit((l) => ({
        ...l,
        items: l.items.map((i) => (i.key === d.key ? { ...i, x, y } : i)),
      }));
    } else add(d.id, x, y);
  }
  function handlers(id: string, key?: string) {
    return {
      onPointerDown: (e: ReactPointer<HTMLButtonElement>) => start(e, id, key),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: (e: ReactPointer<HTMLButtonElement>) => {
        if (drag.current?.pointer !== e.pointerId) return;
        suppress.current = true;
        drag.current = null;
        setGhost(null);
      },
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.detail && suppress.current) {
          suppress.current = false;
          return;
        }
        if (target) {
          const other = lab.items.find((s) => s.key === target);
          if (other && key !== target)
            drop(lab.items.find(i => i.key === key) ?? sample(id, other.x, other.y), other);
          else setTarget(null);
        } else if (key && id === "particle-group") {
          setTarget(key);
        } else if (key) {
          setDetail(id);
          setModal("detail");
          setSelectedKey(key);
        } else add(id);
      },
    };
  }
  const [selectedKey, setSelectedKey] = useState("");
  const current = lookup(detail);
  const inspected = lab.items.find(i => i.key === selectedKey && i.id === detail);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">
            <FlaskConical size={26} />
          </span>
          Little<span className="brand-second">Chemistry</span>
        </div>
        <nav>
          <button onClick={() => setModal("journal")}>
            <BookOpen />
            Journal
            <span
              className="count"
              aria-label={lab.discoveries.length + " discoveries"}
            >
              {lab.discoveries.length}
            </span>
          </button>
        </nav>
        <div className="top-actions">
          <button
            className="iconbtn"
            title="Help"
            aria-label="Help"
            onClick={() => setModal("help")}
          >
            <CircleHelp />
          </button>
          <button
            className="iconbtn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 />
          </button>
        </div>
      </header>
      <div className="workarea">
        <aside className={library ? "sidebar mobile-open" : "sidebar"}>
          <div className="side-top">
            <div className="side-title">
              <h2>Substance library</h2>
              <button
                className={"sort-button iconbtn " + (sorted ? "blue" : "")}
                aria-label="Toggle alphabetical sorting"
                aria-pressed={sorted}
                onClick={() => setSorted(!sorted)}
              >
                <ArrowDownAZ size={16} />
              </button>
              <button
                className="only-mobile iconbtn"
                onClick={() => setLibrary(false)}
                aria-label="Close library"
              >
                <PanelLeftClose size={18} />
              </button>
            </div>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Search substances"
                placeholder="Search substances..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="filters">
              {["All", "Elements", "Compounds"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={filter === f ? "active" : ""}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="sub-list">
            {choices.map((s) => (
              <button
                className="sub-row"
                key={s.id}
                {...handlers(s.id)}
                title={"Place " + s.name + " on canvas"}
              >
                <span
                  className="symbol"
                  style={{
                    color: colorFor(s.id),
                    background: colorFor(s.id) + "15",
                    borderColor: colorFor(s.id) + "35",
                  }}
                >
                  {s.formula}
                </span>
                <span className="sub-text">
                  <b>{s.name}</b>
                  <small>{elemental.get(s.id)?.category ?? s.category}</small>
                </span>
              </button>
            ))}
            {!choices.length && (
              <p className="muted">{owned.length ? "No matching substances." : "Atoms you build will appear here."}</p>
            )}
          </div>
          <button
            className="table-link"
            onClick={() => {
              setModal("table");
              setLibrary(false);
            }}
          >
            <Grid2X2 size={16} />
            Periodic table
            <ChevronRight size={14} />
          </button>
        </aside>
        <main>
          <div className="headline">
            <h1>Reaction sandbox</h1>
            <div className="mode">
              <FlaskConical size={15} />
              <select
                aria-label="Game mode"
                value={mode}
                disabled={busy}
                onChange={(e) => switchMode(e.target.value as Mode)}
              >
                <option value="easy">Easy mode</option>
                <option value="hard">Hard mode</option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <section className="canvas-frame">
            <header className="canvas-head">
              <button className="only-mobile library-toggle" onClick={() => setLibrary(true)}>
                <Menu size={16} /> Library
              </button>
              <div>
                {mode === "hard" && (
                  <button disabled={busy} onClick={() => setModal("build")}>
                    <Atom size={15} />
                    Build atom
                  </button>
                )}
                <button
                  disabled={busy || !undo.length}
                  onClick={() => {
                    edit((l) => ({ ...l, items: undo.at(-1)! }));
                    setUndo((u) => u.slice(0, -1));
                    setTarget(null);
                    setMessage("");
                  }}
                >
                  <Undo2 size={15} />
                  Undo
                </button>
                <span className="sep" />
                <button
                  disabled={busy || !lab.items.length}
                  onClick={() => {
                    checkpoint();
                    edit((l) => ({ ...l, items: [] }));
                    setTarget(null);
                  }}
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              </div>
            </header>
            {mode === "hard" && (
              <section className="particle-shelf" aria-label="Subatomic particles">
                <strong>Subatomic particles</strong>
                <div>{Object.keys(supplies).map((particle, index) => (
                  <button key={particle} disabled={busy} {...handlers(particle)}>
                    <b aria-hidden="true">{["p⁺", "n⁰", "e⁻"][index]}</b>{particle}
                  </button>
                ))}</div>
              </section>
            )}
            <div className={"canvas " + (game.grid ? "grid" : "")} ref={canvas}>
              {lab.items.map((i) => {
                const s = lookup(i.id);
                const name = s?.name ?? (i.counts && particleLabel(i.counts));
                return (
                  name && (
                    <button
                      key={i.key}
                      data-sample-key={i.key}
                      className={
                        "specimen " +
                        (flash === i.key ? "discover " : "") +
                        (target === i.key ? "chosen" : "")
                      }
                      style={{ left: i.x + "%", top: i.y + "%" }}
                      {...handlers(i.id, i.key)}
                      aria-pressed={target === i.key}
                      aria-label={name + " on canvas" + (i.counts ? ", " + composition(i.counts) + ", charge " + (i.counts.protons - i.counts.electrons) : "") + ", inspect or combine"}
                    >
                      <span className="model">
                        {i.counts ? (s ? <span className="particle-mark"><sup>{i.counts.protons + i.counts.neutrons}</sup>{s.formula}</span> : particleMark(i.counts)) : s && <Molecule
                          id={s.id}
                          descriptor={s.icon.name}
                          size={131}
                        />}
                      </span>
                      <span className="spec-label">
                        <i style={{ background: colorFor(i.id) }} />
                        {name}
                        <code>{i.counts ? composition(i.counts) : s && formulaFor(s)}</code>
                      </span>
                    </button>
                  )
                );
              })}
              {!lab.items.length && (
                <div className="empty-canvas">
                  <Atom />
                  <p>
                    {mode === "hard"
                      ? "Drag a proton here, then drop an electron on it to build hydrogen."
                      : "Select a substance from the library."}
                  </p>

                </div>
              )}
            </div>
            <footer className="canvas-foot">
              <MousePointer2 size={14} />
              <span>
                {busy
                  ? "Checking possible reactions…"
                  : target
                    ? "Select a second sample to combine."
                    : "Drag substances together to combine them."}
              </span>
              {!saved && <span role="status">Storage unavailable</span>}
            </footer>
          </section>
          {message && (
            <div className="notice" role="status">
              <Activity size={16} />
              {message}
              <button
                className="iconbtn"
                aria-label="Dismiss feedback"
                onClick={() => setMessage("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <details className="guide">
            <summary>Experiment starters</summary>
            <div className="guide-cards">
              {guides.map((r) => (
                <button
                  key={r.productId}
                  className="guide-card"
                  disabled={
                    busy ||
                    ![r.a, r.b].every((id) => owned.some((s) => s.id === id))
                  }
                  onClick={() => {
                    checkpoint();
                    edit((l) => ({
                      ...l,
                      items: [
                        ...l.items,
                        sample(r.a, 32, 49),
                        sample(r.b, 66, 56),
                      ],
                    }));
                    setMessage(
                      "Added " +
                        catalog.get(r.a)!.name +
                        " and " +
                        catalog.get(r.b)!.name +
                        ". Drag them together.",
                    );
                  }}
                >
                  <span className="guide-art">
                    <Molecule id={r.a} size={45} />
                    <Plus size={10} />
                    <Molecule id={r.b} size={45} />
                  </span>
                  <b>
                    {catalog.get(r.a)?.name} + {catalog.get(r.b)?.name}
                  </b>
                  <small>
                    {r.productId === "water"
                      ? "Molecular bonding"
                      : r.productId === "sodium-chloride"
                        ? "Ionic bonding"
                        : "Compound formation"}
                  </small>
                </button>
              ))}
            </div>
          </details>
        </main>
      </div>
      {ghost && (
        <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.counts ? <span className="spec-label">{lookup(ghost.id)?.name ?? particleLabel(ghost.counts)} · {composition(ghost.counts)}</span> : <Molecule id={ghost.id} size={70} />}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            {
              settings: "Lab settings",
              help: "Using the sandbox",
              table: "Periodic table",
              journal: "Discovery journal",
              build: "Atom builder",
              detail: current?.name ?? "Substance",
              reset: "Reset this laboratory?",
            }[modal]
          }
          close={() => setModal(null)}
          wide={modal === "table"}
        >
          {modal === "help" && (
            <>
              <p>
                In hard mode, drag a proton onto the canvas and drop an electron on it to unlock hydrogen. Add particles to a built atom to change its composition. Drop two neutral samples together for a chemical reaction. Drag a library sample onto the canvas, then drop it onto another
                sample. You can also click a library entry to place it.
              </p>
              <p>
                Click or press Enter on a supply to place one. Select a particle group, then a supply or another sample to combine. For a neutral sample, open it, choose “Combine
                with…”, then select another sample.
              </p>
              <p>
                Verified discoveries include a balanced equation and the
                conditions under which it applies. Hard mode lets you construct
                your own elements.
              </p>
            </>
          )}
          {modal === "settings" && (
            <>
              <label className="setting">
                <span>Show canvas grid</span>
                <input
                  type="checkbox"
                  checked={game.grid}
                  onChange={(e) =>
                    setGame((g) => ({ ...g, grid: e.target.checked }))
                  }
                />
              </label>
              <button className="secondary" onClick={() => setModal("reset")}>
                Reset {mode} mode progress
              </button>
            </>
          )}
          {modal === "reset" && (
            <>
              <p>
                This removes this mode’s workspace, discoveries, and experiment
                history from this browser.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setGame((g) => ({ ...g, [mode]: freshLab(mode) }));
                  setUndo([]);
                  setMessage("");
                  setTarget(null);
                  setModal(null);
                }}
              >
                Reset progress
              </button>
            </>
          )}
          {modal === "table" && (
            <Periodic
              inspect={(id) => {
                setSelectedKey("");
                openDetail(id);
              }}
            />
          )}
          {modal === "build" && (
            <Builder
              onBuild={(atom) => {
                checkpoint();
                edit((l) => addBuiltAtom(l, atom));
                setModal(null);
                setMessage(atom.element.name + " added to the canvas and library.");
              }}
            />
          )}
          {modal === "detail" && current && (
            <>
              {inspected?.counts && <p>Built atom · {composition(inspected.counts)}</p>}
              <Details
                s={current}
                log={lab.log}
                add={
                  owned.some((s) => s.id === detail)
                    ? () => {
                        add(detail);
                        setModal(null);
                      }
                    : undefined
                }
              />
              {inspected && (
                <button
                  className="secondary"
                  onClick={() => {
                    setTarget(selectedKey);
                    setModal(null);
                  }}
                >
                  Combine with…
                </button>
              )}
            </>
          )}
          {modal === "journal" && (
            <>
              <div className="journal-count">
                <BookOpen />
                {lab.discoveries.length} discoveries
              </div>
              {lab.discoveries.map((s) => (
                <button
                  key={s.id}
                  className="discovery-tag"
                  onClick={() => {
                    setSelectedKey("");
                    openDetail(s.id);
                  }}
                >
                  <Check size={13} />
                  {s.name}
                </button>
              ))}
              <details className="history">
                <summary>Experiment history ({lab.log.length})</summary>
                {!lab.log.length ? (
                  <p>
                    Your experiments will appear here. Try combining hydrogen and
                    oxygen.
                  </p>
                ) : (
                  lab.log.map((entry, i) => (
                    <article className="entry" key={i}>
                      <Clock3 size={15} />
                      <div>
                        <b>{entry.title}</b>
                        <p>{entry.detail}</p>
                      </div>
                    </article>
                  ))
                )}
              </details>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
