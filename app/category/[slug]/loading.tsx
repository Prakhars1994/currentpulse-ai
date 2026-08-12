export default function Loading() {
  return <main className="min-h-screen bg-slate-950 py-12 text-white"><div className="mx-auto max-w-7xl animate-pulse px-6"><div className="h-10 w-72 rounded-xl bg-slate-800"/><div className="mt-4 h-5 w-full max-w-2xl rounded bg-slate-800"/><div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{Array.from({length:9}).map((_,i)=><div key={i} className="h-72 rounded-3xl border border-slate-800 bg-slate-900"/>)}</div></div></main>;
}
