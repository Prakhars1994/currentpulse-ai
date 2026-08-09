"use client";

import { useMemo, useState } from "react";
import { Globe2, MapPin, Map as MapIcon } from "lucide-react";

const INDIA_LOCATIONS = {
  india: { label: "India", point: [46, 52] },
  "new delhi": { label: "New Delhi", point: [35, 29], state: "Delhi" },
  delhi: { label: "Delhi", point: [35, 29], state: "Delhi" },
  mumbai: { label: "Mumbai", point: [26, 67], state: "Maharashtra" },
  maharashtra: { label: "Maharashtra", point: [29, 62] },
  gujarat: { label: "Gujarat", point: [15, 54] },
  rajasthan: { label: "Rajasthan", point: [23, 42] },
  punjab: { label: "Punjab", point: [29, 24] },
  haryana: { label: "Haryana", point: [31, 31] },
  "uttar pradesh": { label: "Uttar Pradesh", point: [48, 40] },
  bihar: { label: "Bihar", point: [65, 42] },
  "west bengal": { label: "West Bengal", point: [72, 51] },
  assam: { label: "Assam", point: [83, 39] },
  sikkim: { label: "Sikkim", point: [73, 35] },
  odisha: { label: "Odisha", point: [61, 59] },
  "madhya pradesh": { label: "Madhya Pradesh", point: [39, 53] },
  chhattisgarh: { label: "Chhattisgarh", point: [50, 58] },
  jharkhand: { label: "Jharkhand", point: [63, 50] },
  karnataka: { label: "Karnataka", point: [32, 77], state: "Karnataka" },
  bengaluru: { label: "Bengaluru", point: [34, 81], state: "Karnataka", city: "Bengaluru", localPoint: [63, 78] },
  bangalore: { label: "Bengaluru", point: [34, 81], state: "Karnataka", city: "Bengaluru", localPoint: [63, 78] },
  banglore: { label: "Bengaluru", point: [34, 81], state: "Karnataka", city: "Bengaluru", localPoint: [63, 78] },
  kerala: { label: "Kerala", point: [34, 89] },
  "tamil nadu": { label: "Tamil Nadu", point: [41, 88] },
  chennai: { label: "Chennai", point: [44, 86], state: "Tamil Nadu", city: "Chennai" },
  telangana: { label: "Telangana", point: [39, 69] },
  hyderabad: { label: "Hyderabad", point: [40, 69], state: "Telangana", city: "Hyderabad" },
  "andhra pradesh": { label: "Andhra Pradesh", point: [45, 73] },
  visakhapatnam: { label: "Visakhapatnam", point: [54, 67], state: "Andhra Pradesh", city: "Visakhapatnam" },
  goa: { label: "Goa", point: [27, 72] },
  "jammu and kashmir": { label: "Jammu & Kashmir", point: [32, 13] },
  ladakh: { label: "Ladakh", point: [42, 13] },
  uttarakhand: { label: "Uttarakhand", point: [41, 28] },
  "himachal pradesh": { label: "Himachal Pradesh", point: [35, 22] },
  himachal: { label: "Himachal Pradesh", point: [35, 22] },
  dehradun: { label: "Dehradun", point: [40, 29], state: "Uttarakhand", city: "Dehradun" },
  gwalior: { label: "Gwalior", point: [38, 43], state: "Madhya Pradesh", city: "Gwalior" },
  kolkata: { label: "Kolkata", point: [72, 54], state: "West Bengal", city: "Kolkata" },
};

const WORLD_LOCATIONS = {
  india: { label: "India", point: [69, 55], country: "India" },
  china: { label: "China", point: [73, 39], country: "China" },
  pakistan: { label: "Pakistan", point: [64, 48], country: "Pakistan" },
  bangladesh: { label: "Bangladesh", point: [75, 52], country: "Bangladesh" },
  nepal: { label: "Nepal", point: [70, 47], country: "Nepal" },
  bhutan: { label: "Bhutan", point: [74, 47], country: "Bhutan" },
  myanmar: { label: "Myanmar", point: [78, 55], country: "Myanmar" },
  "sri lanka": { label: "Sri Lanka", point: [70, 65], country: "Sri Lanka" },
  maldives: { label: "Maldives", point: [65, 66], country: "Maldives" },
  afghanistan: { label: "Afghanistan", point: [62, 42], country: "Afghanistan" },
  japan: { label: "Japan", point: [88, 39], country: "Japan" },
  vietnam: { label: "Vietnam", point: [81, 58], country: "Vietnam" },
  indonesia: { label: "Indonesia", point: [81, 72], country: "Indonesia" },
  australia: { label: "Australia", point: [86, 82], country: "Australia" },
  russia: { label: "Russia", point: [69, 23], country: "Russia" },
  ukraine: { label: "Ukraine", point: [56, 31], country: "Ukraine" },
  germany: { label: "Germany", point: [50, 31], country: "Germany" },
  france: { label: "France", point: [47, 35], country: "France" },
  greece: { label: "Greece", point: [54, 39], country: "Greece" },
  italy: { label: "Italy", point: [51, 39], country: "Italy" },
  "united kingdom": { label: "United Kingdom", point: [46, 29], country: "United Kingdom" },
  uk: { label: "United Kingdom", point: [46, 29], country: "United Kingdom" },
  "united states": { label: "United States", point: [20, 39], country: "United States" },
  usa: { label: "United States", point: [20, 39], country: "United States" },
  canada: { label: "Canada", point: [18, 25], country: "Canada" },
  brazil: { label: "Brazil", point: [31, 69], country: "Brazil" },
  venezuela: { label: "Venezuela", point: [27, 59], country: "Venezuela" },
  cuba: { label: "Cuba", point: [22, 51], country: "Cuba" },
  "south africa": { label: "South Africa", point: [54, 78], country: "South Africa" },
  sudan: { label: "Sudan", point: [57, 58], country: "Sudan" },
  iran: { label: "Iran", point: [61, 47], country: "Iran" },
  israel: { label: "Israel", point: [56, 47], country: "Israel" },
  egypt: { label: "Egypt", point: [55, 51], country: "Egypt" },
  "red sea": { label: "Red Sea", point: [58, 54], country: "World" },
  "indian ocean": { label: "Indian Ocean", point: [68, 70], country: "World" },
  "bay of bengal": { label: "Bay of Bengal", point: [75, 60], country: "World" },
  "arabian sea": { label: "Arabian Sea", point: [64, 59], country: "World" },
  "strait of hormuz": { label: "Strait of Hormuz", point: [63, 50], country: "World" },
  taiwan: { label: "Taiwan", point: [84, 46], country: "Taiwan" },
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

function resolveLocation(location = "") {
  const key = keyFor(location);
  if (INDIA_LOCATIONS[key]) {
    const item = INDIA_LOCATIONS[key];
    return {
      mapType: "india",
      label: item.label || location,
      country: "India",
      state: item.state || (item.city ? "" : item.label),
      city: item.city || "",
      point: item.point,
      localPoint: item.localPoint || null,
      localAsset: item.state === "Karnataka" || item.label === "Karnataka" ? "/maps/karnataka-districts.svg" : "",
    };
  }

  if (WORLD_LOCATIONS[key]) {
    const item = WORLD_LOCATIONS[key];
    return {
      mapType: "world",
      label: item.label || location,
      country: item.country || item.label,
      state: "",
      city: "",
      point: item.point,
      localPoint: null,
      localAsset: "",
    };
  }

  return {
    mapType: "world",
    label: location,
    country: "World",
    state: "",
    city: "",
    point: null,
    localPoint: null,
    localAsset: "",
  };
}

function Marker({ point, label, compact = false }) {
  if (!point) return null;
  return (
    <span className={`atlas-marker${compact ? " atlas-marker--compact" : ""}`} style={{ left: `${point[0]}%`, top: `${point[1]}%` }}>
      <i />
      {!compact && <b>{label}</b>}
    </span>
  );
}

function LocationTrail({ meta }) {
  const trail = [meta.country];
  if (meta.state && meta.state !== meta.country) trail.push(meta.state);
  if (meta.city) trail.push(meta.city);
  else if (meta.label && !trail.includes(meta.label)) trail.push(meta.label);

  return (
    <div className="atlas-location-trail" aria-label="Location hierarchy">
      {trail.map((item, index) => (
        <span key={`${item}-${index}`}>
          <small>{index === 0 ? "Country" : index === 1 && meta.mapType === "india" ? "State" : index === trail.length - 1 ? "Place" : "Region"}</small>
          <strong>{item}</strong>
          {index < trail.length - 1 && <em>→</em>}
        </span>
      ))}
    </div>
  );
}

export default function ArticleStudyVisuals({ mapLocations }) {
  const locations = useMemo(() => normaliseLocations(mapLocations), [mapLocations]);
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");
  if (!locations.length) return null;

  const meta = resolveLocation(selectedLocation);
  const overviewAsset = meta.mapType === "india" ? "/maps/india-states-en.svg" : "/maps/world-political-blank.svg";
  const zoomPosition = meta.point ? `${meta.point[0]}% ${meta.point[1]}%` : "50% 50%";

  return (
    <section className="atlas-locator-card" aria-label="Static location map for this article">
      <div className="atlas-locator-head">
        <div>
          <span><MapPin size={15} /> Map focus</span>
          <h2>Locate the place</h2>
        </div>
        <small>{meta.mapType === "india" ? <><MapIcon size={14} /> India political locator</> : <><Globe2 size={14} /> World political locator</>}</small>
      </div>

      <LocationTrail meta={meta} />

      <div className="atlas-composite-map">
        <div className="atlas-overview-map">
          <img src={overviewAsset} alt={meta.mapType === "india" ? "Political map of India with states" : "Political world map"} />
          <Marker point={meta.point} label={meta.label} />
          <span className="atlas-overview-tag">Overview</span>
        </div>

        <div className="atlas-local-inset">
          <span className="atlas-overview-tag">Closer view</span>
          {meta.localAsset ? (
            <div className="atlas-inset-image">
              <img src={meta.localAsset} alt={`${meta.state || meta.label} local map`} />
              <Marker point={meta.localPoint || [63, 78]} label={meta.city || meta.label} compact />
              <div className="atlas-inset-label"><strong>{meta.state || meta.label}</strong><span>{meta.city || meta.label}</span></div>
            </div>
          ) : (
            <div className="atlas-inset-zoom" style={{ backgroundImage: `url(${overviewAsset})`, backgroundPosition: zoomPosition }}>
              <span className="atlas-inset-center"><i /></span>
              <div className="atlas-inset-label"><strong>{meta.state || meta.country}</strong><span>{meta.city || meta.label}</span></div>
            </div>
          )}
        </div>
      </div>

      {locations.length > 1 && (
        <div className="atlas-location-tabs" aria-label="Other places mentioned in article">
          {locations.map((location) => {
            const item = resolveLocation(location);
            return (
              <button key={location} type="button" onClick={() => setSelectedLocation(location)} className={selectedLocation === location ? "is-active" : ""}>
                <MapPin size={13} /> {item.label}
              </button>
            );
          })}
        </div>
      )}

      <p className="atlas-map-note">
        Static revision aid · approximate marker placement · map base: {meta.mapType === "india" ? (
          <a href="https://commons.wikimedia.org/wiki/File:India-map-en.svg" target="_blank" rel="noopener noreferrer">Wikimedia Commons (CC BY-SA 3.0)</a>
        ) : (
          <a href="https://commons.wikimedia.org/wiki/File:BlankMap-World.svg" target="_blank" rel="noopener noreferrer">Wikimedia Commons (public domain)</a>
        )}.
      </p>
    </section>
  );
}
