
import { MAP_MASTERY_DATA, detectMapMasteryTopic } from "@/lib/study/mapMastery";

const INDIA = { north: 37.5, south: 5, west: 67, east: 99 };

function pos(lat, lon, world) {
  const left = world ? ((lon + 180) / 360) * 100 : ((lon - INDIA.west) / (INDIA.east - INDIA.west)) * 100;
  const top = world ? ((90 - lat) / 180) * 100 : ((INDIA.north - lat) / (INDIA.north - INDIA.south)) * 100;
  return { left: `${Math.max(2, Math.min(98, left))}%`, top: `${Math.max(2, Math.min(98, top))}%` };
}

function Tile({ title, image, points, world = false }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80">
      <div className="px-4 py-3"><h3 className="font-black text-cyan-200">{title}</h3><p className="text-xs text-slate-500">Numbers instead of long labels keep the map readable.</p></div>
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        <img src={image} alt={title} className="h-full w-full object-cover opacity-75" loading="lazy" />
        {points.map(([name, lat, lon], index) => (
          <span key={name} title={name} style={pos(lat, lon, world)} className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-300 text-[9px] font-black text-slate-950 ring-2 ring-slate-950">
            {index + 1}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 p-4 text-[11px] text-slate-300 sm:grid-cols-3">
        {points.map(([name,,,note], index) => <div key={name}><b className="text-cyan-300">{index + 1}.</b> {name}<span className="text-slate-500"> · {note}</span></div>)}
      </div>
    </div>
  );
}

export default function MapMasteryPanel({ title = "", articleText = "" }) {
  const topic = detectMapMasteryTopic(title, articleText);
  if (!topic) return null;
  const data = MAP_MASTERY_DATA[topic];

  return (
    <section className="rounded-3xl border border-cyan-400/15 bg-slate-900/70 p-5 sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Map Mastery · See → recall → repeat</p>
        <h2 className="mt-1 text-2xl font-black text-white">Master important {topic}</h2>
      </div>

      {/lake mead/i.test(title) && (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-slate-300">
          <b className="text-amber-300">Lake Mead local context:</b> Nevada–Arizona border · Colorado River · Hoover Dam · Las Vegas to the west · Grand Canyon region upstream/east · Colorado River Basin.
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Tile title={`Important ${topic} of India`} image="/maps/india-states-en.svg" points={data.india} />
        <Tile title={`Important ${topic} of the world`} image="/maps/world-political-blank.svg" points={data.world} world />
      </div>
    </section>
  );
}
