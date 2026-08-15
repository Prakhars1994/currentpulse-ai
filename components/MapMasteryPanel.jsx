"use client";

import { useEffect, useState } from "react";
import { MAP_MASTERY_DATA, detectMapMasteryTopic } from "@/lib/study/mapMastery";

const INDIA = { north: 37.5, south: 5, west: 67, east: 99 };

function pos(lat, lon, world) {
  const left = world ? ((lon + 180) / 360) * 100 : ((lon - INDIA.west) / (INDIA.east - INDIA.west)) * 100;
  const top = world ? ((90 - lat) / 180) * 100 : ((INDIA.north - lat) / (INDIA.north - INDIA.south)) * 100;
  return { left: `${Math.max(2, Math.min(98, left))}%`, top: `${Math.max(2, Math.min(98, top))}%` };
}

function Tile({ title, image, points, world = false, reveal = true, hi = false }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80">
      <div className="px-4 py-3"><h3 className="font-black text-cyan-200">{title}</h3><p className="text-xs text-slate-500">{hi ? "लंबे नामों की जगह संख्या-मार्कर मानचित्र को साफ रखते हैं।" : "Number markers instead of long labels keep the map readable."}</p></div>
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        <img src={image} alt={title} className="h-full w-full object-cover opacity-75" loading="lazy" />
        {points.map(([name, lat, lon], index) => <span key={name} title={reveal ? name : `${index + 1}`} style={pos(lat, lon, world)} className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-300 text-[9px] font-black text-slate-950 ring-2 ring-slate-950">{index + 1}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-1 p-4 text-[11px] text-slate-300 sm:grid-cols-3">
        {points.map(([name,,,note], index) => <div key={name}><b className="text-cyan-300">{index + 1}.</b> {reveal ? <>{name}<span className="text-slate-500"> · {note}</span></> : <span className="text-slate-500"> ?</span>}</div>)}
      </div>
    </div>
  );
}

function LakeMeadLocal({ reveal, hi }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-slate-950/80">
      <div className="px-4 py-3"><h3 className="font-black text-amber-200">{hi ? "Lake Mead स्थानीय USA मानचित्र" : "Lake Mead local USA map"}</h3><p className="text-xs text-slate-500">{hi ? "Nevada–Arizona और आसपास के परीक्षा-उपयोगी स्थान।" : "Nevada–Arizona and nearby exam-relevant geography."}</p></div>
      <img src="/maps/lake-mead-southwest-study.svg" alt="Lake Mead Nevada Arizona study map" className="aspect-[16/9] w-full object-cover" loading="lazy" />
      <div className="grid grid-cols-2 gap-1 p-4 text-[11px] text-slate-300">
        {["Lake Mead","Colorado River","Hoover Dam","Las Vegas","Grand Canyon","Nevada–Arizona border"].map((name,index) => <div key={name}><b className="text-amber-300">{index+1}.</b> {reveal ? name : "?"}</div>)}
      </div>
    </div>
  );
}

export default function MapMasteryPanel({ title = "", articleText = "" }) {
  const [reveal, setReveal] = useState(true);
  const [hi, setHi] = useState(false);
  useEffect(() => {
    try { setHi(new URLSearchParams(window.location.search).get("lang") === "hi"); } catch {}
  }, []);

  const topic = detectMapMasteryTopic(title, articleText);
  if (!topic) return null;
  const data = MAP_MASTERY_DATA[topic];
  const isMead = /lake mead/i.test(title);

  return (
    <section className="rounded-3xl border border-cyan-400/15 bg-slate-900/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{hi ? "Map Mastery · देखें → याद करें → दोहराएँ" : "Map Mastery · See → recall → repeat"}</p><h2 className="mt-1 text-2xl font-black text-white">{hi ? `महत्वपूर्ण ${topic} को मानचित्र से याद करें` : `Master important ${topic}`}</h2></div>
        <button type="button" onClick={() => setReveal((value) => !value)} className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">{reveal ? (hi ? "Recall mode: नाम छिपाएँ" : "Recall mode: hide names") : (hi ? "उत्तर दिखाएँ" : "Reveal answers")}</button>
      </div>

      <div className={`mt-5 grid gap-5 ${isMead ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
        {isMead && <LakeMeadLocal reveal={reveal} hi={hi} />}
        <Tile title={hi ? `भारत के महत्वपूर्ण ${topic}` : `Important ${topic} of India`} image="/maps/india-states-en.svg" points={data.india} reveal={reveal} hi={hi} />
        <Tile title={hi ? `विश्व के महत्वपूर्ण ${topic}` : `Important ${topic} of the world`} image="/maps/world-political-blank.svg" points={data.world} world reveal={reveal} hi={hi} />
      </div>
    </section>
  );
}
