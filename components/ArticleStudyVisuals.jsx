"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";

const INDIA_POINTS = {
  india: [49, 50], "new delhi": [43, 29], delhi: [43, 29], mumbai: [31, 57],
  maharashtra: [36, 55], gujarat: [26, 43], rajasthan: [34, 31], punjab: [38, 20],
  haryana: [41, 27], "uttar pradesh": [53, 34], bihar: [67, 37], "west bengal": [76, 44],
  assam: [84, 34], sikkim: [72, 30], odisha: [65, 53], "madhya pradesh": [48, 49],
  chhattisgarh: [58, 52], jharkhand: [68, 46], karnataka: [42, 69], kerala: [43, 83],
  "tamil nadu": [51, 82], telangana: [49, 62], "andhra pradesh": [57, 67], goa: [35, 66],
  "jammu and kashmir": [42, 11], ladakh: [50, 12], uttarakhand: [51, 25], himachal: [45, 19],
  bengaluru: [43, 70], chennai: [55, 80], hyderabad: [49, 63], kolkata: [75, 47],
  dehradun: [49, 25], visakhapatnam: [61, 64], gwalior: [45, 40],
};

const WORLD_POINTS = {
  india: [69, 55], china: [73, 39], pakistan: [64, 48], bangladesh: [75, 52], nepal: [70, 47],
  bhutan: [74, 47], myanmar: [78, 55], "sri lanka": [70, 65], maldives: [65, 66], afghanistan: [62, 42],
  japan: [88, 39], vietnam: [81, 58], indonesia: [81, 72], australia: [86, 82], russia: [69, 23],
  ukraine: [56, 31], germany: [50, 31], france: [47, 35], greece: [54, 39], italy: [51, 39],
  "united kingdom": [46, 29], uk: [46, 29], "united states": [20, 39], usa: [20, 39], canada: [18, 25],
  brazil: [31, 69], venezuela: [27, 59], cuba: [22, 51], "south africa": [54, 78], sudan: [57, 58],
  iran: [61, 47], israel: [56, 47], egypt: [55, 51], "red sea": [58, 54], "indian ocean": [68, 70],
  "bay of bengal": [75, 60], "arabian sea": [64, 59], "strait of hormuz": [63, 50], taiwan: [84, 46],
};

function normaliseLocations(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 4);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 4) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 4);
  }
}

function keyFor(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function IndiaMap({ point, label }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Schematic India locator for ${label}`}>
      <path className="map-land" d="M43 6 L54 8 59 16 62 23 70 28 73 38 68 45 66 55 61 62 57 72 52 92 47 84 44 74 38 66 34 55 27 46 31 37 35 28 37 18 Z" />
      <path className="map-boundary" d="M35 28 L62 23 M31 37 L68 45 M34 55 L61 62 M44 74 L57 72" />
      {point && <><circle className="map-pulse" cx={point[0]} cy={point[1]} r="5" /><circle className="map-marker" cx={point[0]} cy={point[1]} r="2.4" /></>}
    </svg>
  );
}

function WorldMap({ point, label }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Schematic world locator for ${label}`}>
      <path className="map-land" d="M7 25 L20 18 31 23 34 34 27 43 25 57 17 67 11 53 6 43 Z M39 24 L50 18 60 24 66 36 61 45 56 50 54 67 48 82 43 69 45 53 37 41 Z M64 22 L79 19 94 28 91 43 82 49 79 61 70 58 66 45 Z M78 70 L90 68 96 78 90 88 80 84 Z" />
      <path className="map-grid" d="M5 50 H95 M50 12 V90" />
      {point && <><circle className="map-pulse" cx={point[0]} cy={point[1]} r="5" /><circle className="map-marker" cx={point[0]} cy={point[1]} r="2.4" /></>}
    </svg>
  );
}

export default function ArticleStudyVisuals({ mapLocations }) {
  const locations = useMemo(() => normaliseLocations(mapLocations), [mapLocations]);
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");
  if (!locations.length) return null;

  const selectedKey = keyFor(selectedLocation);
  const indiaPoint = INDIA_POINTS[selectedKey];
  const worldPoint = WORLD_POINTS[selectedKey];
  const mapType = indiaPoint ? "india" : "world";
  const point = indiaPoint || worldPoint || null;

  return (
    <section className="static-locator-card" aria-label="Static article locator map">
      <div className="static-locator-head">
        <div>
          <span className="static-locator-kicker"><MapPin size={16} /> Map focus</span>
          <h2>Locate the place</h2>
        </div>
        <span className="static-map-type">{mapType === "india" ? "India political schematic" : "World political schematic"}</span>
      </div>
      <div className="static-locator-layout">
        <div className="static-map-canvas">
          {mapType === "india" ? <IndiaMap point={point} label={selectedLocation} /> : <WorldMap point={point} label={selectedLocation} />}
          <div className="static-map-caption">
            <strong>{selectedLocation}</strong>
            <span>{point ? "Approximate locator for revision" : "Location listed in source; precise marker unavailable"}</span>
          </div>
        </div>
        <div className="static-map-tabs" aria-label="Locations mentioned in article">
          {locations.map((location) => (
            <button key={location} type="button" onClick={() => setSelectedLocation(location)} className={selectedLocation === location ? "is-active" : ""}>
              <MapPin size={14} /> {location}
            </button>
          ))}
          <p>Schematic only · not to scale · no live map tracking.</p>
        </div>
      </div>
    </section>
  );
}
