import { Accessibility, ArrowRight, Bot, CheckCircle2, Route, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#112119]">
      <nav aria-label="Primary navigation" className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <span className="flex items-center gap-3 font-bold"><span className="grid size-10 place-items-center rounded-xl bg-[#102b20] text-[#dfff85]"><Route /></span>ClearPath</span>
        <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[#102b20] px-5 py-3 text-sm font-bold text-white hover:bg-[#193d2e] focus-visible:outline-2 focus-visible:outline-offset-2">Launch studio <ArrowRight className="size-4" /></Link>
      </nav>
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#397352]">WebMCP-native accessibility planning</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[.98] tracking-[-.06em] sm:text-7xl">Spatial evidence an agent can actually use.</h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#5f6f65]">ClearPath audits structured floor-plan geometry, generates constraint-safe alternatives, and keeps every consequential change staged until a person approves it.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[#102b20] px-6 py-3 text-sm font-bold text-white">Open the live plan <ArrowRight className="size-4" /></Link>
            <a href="#evidence" className="rounded-full border border-[#bac9bc] px-6 py-3 text-sm font-bold">See what is calculated</a>
          </div>
        </div>
        <div id="evidence" className="rounded-[2rem] border border-[#cad6ca] bg-white p-6 shadow-[0_30px_80px_rgba(29,61,43,.12)]">
          <div className="flex items-center justify-between"><span className="text-sm font-bold">North Hall / live model</span><span className="rounded-full bg-[#e7f5c4] px-3 py-1 text-xs font-bold">Planning heuristic</span></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[['Geometry', 'Route clearance'], ['Constraints', 'Locks + capacity'], ['Control', 'Stage + undo']].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f0f4ed] p-4"><p className="text-[10px] uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-2 text-sm font-bold">{value}</p></div>)}
          </div>
          <div className="mt-5 rounded-2xl bg-[#102b20] p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-bold"><Bot className="size-4 text-[#dfff85]" /> Why WebMCP matters</p>
            <p className="mt-2 text-xs leading-6 text-white/65">Coordinates, zones, object identity, exact metric deltas, locks, and version state are exposed as structured tools. A screenshot cannot recover those semantics reliably.</p>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-[#4f6257]">
            <li className="flex gap-2"><Accessibility className="size-4 text-[#397352]" /> Audits recompute whenever geometry changes.</li>
            <li className="flex gap-2"><ShieldCheck className="size-4 text-[#397352]" /> Locked objects and minimum capacity are enforced.</li>
            <li className="flex gap-2"><CheckCircle2 className="size-4 text-[#397352]" /> The full interface works without WebMCP.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
