export default function Loading() {
  return <main className="min-h-screen bg-slate-100 py-12"><div className="mx-auto max-w-6xl animate-pulse px-6"><div className="h-36 rounded-2xl bg-white"/><div className="mt-8 space-y-5">{Array.from({length:5}).map((_,i)=><div key={i} className="h-48 rounded-2xl bg-white"/>)}</div></div></main>;
}
