"use client";

import { useEffect, useState } from "react";
import { MAP_MASTERY_DATA, detectMapMasteryTopic } from "@/lib/study/mapMastery";

const INDIA = { north: 37.5, south: 5, west: 67, east: 99 };

function pos(lat, lon, world) {
  const left = world
    ? ((lon + 180) / 360) * 100
    : ((lon - INDIA.west) / (INDIA.east - INDIA.west)) * 100;
  const top = world
    ? ((90 - lat) / 180) * 100
    : ((INDIA.north - lat) / (INDIA.north - INDIA.south)) * 100;

  return {
    left: `${Math.max(3, Math.min(97, left))}%`,
    top: `${Math.max(4, Math.min(96, top))}%`,
  };
}

function MapPoint({ name, lat, lon, index, world, reveal }) {
  const position = pos(lat, lon, world);
  const alignRight = Number.parseFloat(position.left) > 68;
  const alignBottom = Number.parseFloat(position.top) > 72;

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={position}
      title={name}
    >
      <div className="relative flex items-center">
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-white bg-cyan-500 text-[7px] font-black leading-none text-slate-950 shadow-sm ring-1 ring-slate-950/60">
          {index + 1}
        </span>
        {reveal && (
          <span
            className={`absolute whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-950/92 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-white shadow-md ${
              alignRight ? "right-4" : "left-4"
            } ${alignBottom ? "bottom-0" : "top-0"}`}
          >
            {name}
          </span>
        )}
      </div>
    </div>
  );
}

function Tile({ title, image, points, world = false, reveal = true, hi = false }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80">
      <div className="px-4 py-3">
        <h3 className="font-black text-cyan-200">{title}</h3>
        <p className="text-xs text-slate-500">
          {hi
            ? "हर बिंदु पर छोटा संख्या-मार्कर और स्पष्ट नाम-लेबल दिया गया है।"
            : "Every point uses a small numbered marker with a direct place label."}
        </p>
      </div>
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover opacity-78"
          loading="lazy"
        />
        {points.map(([name, lat, lon], index) => (
          <MapPoint
            key={`${name}-${index}`}
            name={name}
            lat={lat}
            lon={lon}
            index={index}
            world={world}
            reveal={reveal}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-4 text-[11px] text-slate-300 sm:grid-cols-3">
        {points.map(([name, , , note], index) => (
          <div key={`${name}-legend`} className="min-w-0">
            <b className="text-cyan-300">{index + 1}.</b>{" "}
            {reveal ? (
              <>
                <span className="font-semibold text-slate-200">{name}</span>
                {note ? <span className="text-slate-500"> · {note}</span> : null}
              </>
            ) : (
              <span className="text-slate-500">?</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LakeMeadLocal({ reveal, hi }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-slate-950/80">
      <div className="px-4 py-3">
        <h3 className="font-black text-amber-200">
          {hi ? "Lake Mead स्थानीय USA मानचित्र" : "Lake Mead local USA map"}
        </h3>
        <p className="text-xs text-slate-500">
          {hi
            ? "Nevada-Arizona और आसपास के परीक्षा-उपयोगी स्थान।"
            : "Nevada-Arizona and nearby exam-relevant geography."}
        </p>
      </div>
      <img
        src="/maps/lake-mead-southwest-study.svg"
        alt="Lake Mead Nevada Arizona study map"
        className="aspect-[16/9] w-full object-cover"
        loading="lazy"
      />
      <div className="grid grid-cols-2 gap-1 p-4 text-[11px] text-slate-300">
        {["Lake Mead", "Colorado River", "Hoover Dam", "Las Vegas", "Grand Canyon", "Nevada-Arizona border"].map(
          (name, index) => (
            <div key={name}>
              <b className="text-amber-300">{index + 1}.</b>{" "}
              {reveal ? name : "?"}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function MapMasteryPanel({ title = "", articleText = "" }) {
  const [reveal, setReveal] = useState(true);
  const [hi, setHi] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setHi(new URLSearchParams(window.location.search).get("lang") === "hi");
      } catch {}
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const topic = detectMapMasteryTopic(title, articleText);
  if (!topic) return null;

  const data = MAP_MASTERY_DATA[topic];
  const isMead = /lake mead/i.test(title);

  return (
    <section className="rounded-3xl border border-cyan-400/15 bg-slate-900/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">
            {hi ? "Map Mastery · देखें -> याद करें -> दोहराएँ" : "Map Mastery · See -> recall -> repeat"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            {hi ? `महत्वपूर्ण ${topic} को मानचित्र से याद करें` : `Master important ${topic}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setReveal((value) => !value)}
          className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200"
        >
          {reveal
            ? hi
              ? "Recall mode: नाम छिपाएँ"
              : "Recall mode: hide names"
            : hi
              ? "उत्तर दिखाएँ"
              : "Reveal answers"}
        </button>
      </div>

      <div className={`mt-5 grid gap-5 ${isMead ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
        {isMead && <LakeMeadLocal reveal={reveal} hi={hi} />}
        <Tile
          title={hi ? `भारत के महत्वपूर्ण ${topic}` : `Important ${topic} of India`}
          image="/maps/india-states-en.svg"
          points={data.india}
          reveal={reveal}
          hi={hi}
        />
        <Tile
          title={hi ? `विश्व के महत्वपूर्ण ${topic}` : `Important ${topic} of the world`}
          image="/maps/world-political-blank.svg"
          points={data.world}
          world
          reveal={reveal}
          hi={hi}
        />
      </div>
    </section>
  );
}
