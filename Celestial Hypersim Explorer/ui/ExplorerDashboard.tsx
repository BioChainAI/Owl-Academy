"use client";
import { modules } from "../modules/registry";
import type { CanonTome, Department } from "../schemas/domain";
import { searchCanon } from "../services/catalog";
import { useExplorer } from "./store";

export function ExplorerDashboard({ tomes }: { tomes: CanonTome[] }) {
  const { query, department, selectedModule, setQuery, setDepartment, setModule } = useExplorer();
  const current = modules.find(module => module.id === selectedModule)!;
  const results = searchCanon(tomes, query, department);
  const departments = [...new Set(tomes.map(tome => tome.dept))];
  return <main>
    <header><span className="eyebrow">Owl Academy / Research Systems</span><span className="status">Isolated scaffold · no live session</span></header>
    <section className="intro"><p className="eyebrow">A map of knowledge, memory & possibility</p><h1>Celestial<br /><em>Hypersim Explorer</em></h1><p>Navigate the Grand Archives. Trace the Major Tome canon. Prepare the next chambers of Owl Academy.</p></section>
    <div className="workspace">
      <aside aria-label="Explorer modules"><p className="eyebrow">Explore the Academy</p><nav>{modules.map(module => <button key={module.id} aria-pressed={selectedModule === module.id} onClick={() => setModule(module.id)}><span className="module-symbol">{["◈", "⌘", "▤", "✧", "◇", "⬡"][module.phase - 1]}</span>{module.name}<small>{module.status}</small></button>)}</nav><div className="boundary"><span className="eyebrow">Integration boundary</span><p>Public canon data only. Registrar tiers, Minor Tome keys, and Firestore writes are disconnected.</p></div></aside>
      <div className="content">
        <section className="panel module-detail" aria-live="polite"><p className="eyebrow">Phase {current.phase} / {current.status}</p><h2>{current.name}</h2><p>{current.purpose}</p><details><summary>Academy source & data contract</summary><code>{current.source}</code><p>Data: {current.data.join(", ")}</p><p>{current.status === "planned" ? "Architecture prepared. Interactive implementation is scheduled in the roadmap." : "Read-only catalog projection is available below."}</p></details></section>
        <section className="panel" aria-labelledby="canon-title"><div className="section-heading"><div><p className="eyebrow">Immutable curriculum / read-only projection</p><h2 id="canon-title">Major Tome Canon</h2></div><span className="count">{tomes.length} tomes · {departments.length} departments</span></div>
          <div className="filters"><label>Search the canon<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, canon ID, or artifact…" /></label><label>Department<select aria-label="Department" value={department} onChange={event => setDepartment(event.target.value as Department | "all")}><option value="all">All departments</option>{departments.map(dept => <option key={dept} value={dept}>Department {dept}</option>)}</select></label></div>
          <p role="status" className="results-count">{results.length} matching tomes</p>
          <div className="tome-list">{results.length === 0 ? <p className="empty">No tomes match. Try another title or department.</p> : results.map(tome => <article key={tome.canonId} className="tome"><span className="seat">{String(tome.globalIndex).padStart(3, "0")}</span><div><h3>{tome.title}</h3><code>{tome.canonId}</code><p>Department {tome.dept} · {tome.requiredTier} · {tome.status}</p><details><summary>Source record</summary><p>{tome.contentPath || "No lesson path assigned in the canon."}</p><p>Prerequisites: {tome.prereqs.join(", ") || "None recorded"}</p></details></div></article>)}</div>
        </section>
        <section className="panel"><p className="eyebrow">Existing Mage Tower systems</p><h2>Control panel integration map</h2><div className="control-grid">{[["Codex", "Profile, Arts XP, Vis, rank & Registrar identity", "mage_tower/Codex.html"], ["Instructor Console", "Author tomes and artifacts on certified planes", "mage_tower/Instructor_Console.html"], ["Admin Console", "Department catalog, tome registry & chain audit", "mage_tower/Admin_Console.html"], ["Unlock Console", "Seal-signed access and completion approval", "mage_tower/Unlock_Console.html"]].map(([title, detail, source]) => <article key={title}><h3>{title}</h3><p>{detail}</p><code>{source}</code></article>)}</div><p className="footnote">Source references only. No production panel is embedded or connected.</p></section>
      </div>
    </div><footer>Owl Academy · Architecture scaffold 0.1 · Grand Archives → Major Tomes → future Hyper-Sim Chambers</footer>
  </main>;
}
