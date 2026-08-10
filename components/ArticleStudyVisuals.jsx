"use client";

import { useMemo, useState } from "react";
import { Globe2, MapPin, Mountain, Map as MapIcon } from "lucide-react";

const INDIA_BOUNDS = { north: 37.5, south: 5.0, west: 67.0, east: 99.0 };
const WORLD_BOUNDS = { north: 90, south: -90, west: -180, east: 180 };

// Stable approximate coordinates for common UPSC-relevant Indian locations.
// Unknown places are intentionally shown without a guessed marker rather than
// putting a dot in the wrong state/country.
const INDIA_LOCATIONS = {
  india: { label: "India", lat: 22.8, lon: 79.0 },
  "new delhi": { label: "New Delhi", lat: 28.6139, lon: 77.2090, state: "Delhi", city: "New Delhi" },
  delhi: { label: "Delhi", lat: 28.7041, lon: 77.1025, state: "Delhi" },
  mumbai: { label: "Mumbai", lat: 19.0760, lon: 72.8777, state: "Maharashtra", city: "Mumbai" },
  pune: { label: "Pune", lat: 18.5204, lon: 73.8567, state: "Maharashtra", city: "Pune" },
  satara: { label: "Satara", lat: 17.6805, lon: 74.0183, state: "Maharashtra", city: "Satara" },
  maharashtra: { label: "Maharashtra", lat: 19.7515, lon: 75.7139, state: "Maharashtra" },
  ahmedabad: { label: "Ahmedabad", lat: 23.0225, lon: 72.5714, state: "Gujarat", city: "Ahmedabad" },
  surat: { label: "Surat", lat: 21.1702, lon: 72.8311, state: "Gujarat", city: "Surat" },
  gujarat: { label: "Gujarat", lat: 22.2587, lon: 71.1924, state: "Gujarat" },
  jaipur: { label: "Jaipur", lat: 26.9124, lon: 75.7873, state: "Rajasthan", city: "Jaipur" },
  rajasthan: { label: "Rajasthan", lat: 27.0238, lon: 74.2179, state: "Rajasthan" },
  amritsar: { label: "Amritsar", lat: 31.6340, lon: 74.8723, state: "Punjab", city: "Amritsar" },
  punjab: { label: "Punjab", lat: 31.1471, lon: 75.3412, state: "Punjab" },
  chandigarh: { label: "Chandigarh", lat: 30.7333, lon: 76.7794, state: "Chandigarh", city: "Chandigarh" },
  haryana: { label: "Haryana", lat: 29.0588, lon: 76.0856, state: "Haryana" },
  lucknow: { label: "Lucknow", lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh", city: "Lucknow" },
  varanasi: { label: "Varanasi", lat: 25.3176, lon: 82.9739, state: "Uttar Pradesh", city: "Varanasi" },
  ballia: { label: "Ballia", lat: 25.7607, lon: 84.1471, state: "Uttar Pradesh", city: "Ballia" },
  balla: { label: "Ballia", lat: 25.7607, lon: 84.1471, state: "Uttar Pradesh", city: "Ballia" },
  "uttar pradesh": { label: "Uttar Pradesh", lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh" },
  patna: { label: "Patna", lat: 25.5941, lon: 85.1376, state: "Bihar", city: "Patna" },
  bihar: { label: "Bihar", lat: 25.0961, lon: 85.3131, state: "Bihar" },
  kolkata: { label: "Kolkata", lat: 22.5726, lon: 88.3639, state: "West Bengal", city: "Kolkata" },
  tamluk: { label: "Tamluk", lat: 22.3000, lon: 87.9200, state: "West Bengal", city: "Tamluk" },
  "west bengal": { label: "West Bengal", lat: 22.9868, lon: 87.8550, state: "West Bengal" },
  guwahati: { label: "Guwahati", lat: 26.1445, lon: 91.7362, state: "Assam", city: "Guwahati" },
  assam: { label: "Assam", lat: 26.2006, lon: 92.9376, state: "Assam" },
  gangtok: { label: "Gangtok", lat: 27.3389, lon: 88.6065, state: "Sikkim", city: "Gangtok" },
  sikkim: { label: "Sikkim", lat: 27.5330, lon: 88.5122, state: "Sikkim" },
  bhubaneswar: { label: "Bhubaneswar", lat: 20.2961, lon: 85.8245, state: "Odisha", city: "Bhubaneswar" },
  odisha: { label: "Odisha", lat: 20.9517, lon: 85.0985, state: "Odisha" },
  bhopal: { label: "Bhopal", lat: 23.2599, lon: 77.4126, state: "Madhya Pradesh", city: "Bhopal" },
  gwalior: { label: "Gwalior", lat: 26.2183, lon: 78.1828, state: "Madhya Pradesh", city: "Gwalior" },
  "madhya pradesh": { label: "Madhya Pradesh", lat: 22.9734, lon: 78.6569, state: "Madhya Pradesh" },
  raipur: { label: "Raipur", lat: 21.2514, lon: 81.6296, state: "Chhattisgarh", city: "Raipur" },
  chhattisgarh: { label: "Chhattisgarh", lat: 21.2787, lon: 81.8661, state: "Chhattisgarh" },
  ranchi: { label: "Ranchi", lat: 23.3441, lon: 85.3096, state: "Jharkhand", city: "Ranchi" },
  jharkhand: { label: "Jharkhand", lat: 23.6102, lon: 85.2799, state: "Jharkhand" },
  bengaluru: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  bangalore: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  banglore: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  mysuru: { label: "Mysuru", lat: 12.2958, lon: 76.6394, state: "Karnataka", city: "Mysuru" },
  mysore: { label: "Mysuru", lat: 12.2958, lon: 76.6394, state: "Karnataka", city: "Mysuru" },
  karnataka: { label: "Karnataka", lat: 15.3173, lon: 75.7139, state: "Karnataka" },
  kochi: { label: "Kochi", lat: 9.9312, lon: 76.2673, state: "Kerala", city: "Kochi" },
  thiruvananthapuram: { label: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, state: "Kerala", city: "Thiruvananthapuram" },
  kerala: { label: "Kerala", lat: 10.8505, lon: 76.2711, state: "Kerala" },
  chennai: { label: "Chennai", lat: 13.0827, lon: 80.2707, state: "Tamil Nadu", city: "Chennai" },
  "tamil nadu": { label: "Tamil Nadu", lat: 11.1271, lon: 78.6569, state: "Tamil Nadu" },
  hyderabad: { label: "Hyderabad", lat: 17.3850, lon: 78.4867, state: "Telangana", city: "Hyderabad" },
  telangana: { label: "Telangana", lat: 18.1124, lon: 79.0193, state: "Telangana" },
  visakhapatnam: { label: "Visakhapatnam", lat: 17.6868, lon: 83.2185, state: "Andhra Pradesh", city: "Visakhapatnam" },
  "andhra pradesh": { label: "Andhra Pradesh", lat: 15.9129, lon: 79.7400, state: "Andhra Pradesh" },
  goa: { label: "Goa", lat: 15.2993, lon: 74.1240, state: "Goa" },
  srinagar: { label: "Srinagar", lat: 34.0837, lon: 74.7973, state: "Jammu & Kashmir", city: "Srinagar" },
  "jammu and kashmir": { label: "Jammu & Kashmir", lat: 33.7782, lon: 76.5762, state: "Jammu & Kashmir" },
  leh: { label: "Leh", lat: 34.1526, lon: 77.5771, state: "Ladakh", city: "Leh" },
  ladakh: { label: "Ladakh", lat: 34.1526, lon: 77.5771, state: "Ladakh" },
  dehradun: { label: "Dehradun", lat: 30.3165, lon: 78.0322, state: "Uttarakhand", city: "Dehradun" },
  uttarakhand: { label: "Uttarakhand", lat: 30.0668, lon: 79.0193, state: "Uttarakhand" },
  shimla: { label: "Shimla", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh", city: "Shimla" },
  "himachal pradesh": { label: "Himachal Pradesh", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh" },
  himachal: { label: "Himachal Pradesh", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh" },
  "bay of bengal": { label: "Bay of Bengal", lat: 15.0, lon: 88.0 },
  "arabian sea": { label: "Arabian Sea", lat: 15.0, lon: 69.0 },
  "indian ocean": { label: "Indian Ocean", lat: 7.5, lon: 78.0 },
};

const WORLD_LOCATIONS = {
  china: { label: "China", lat: 35.9, lon: 104.2, country: "China" },
  pakistan: { label: "Pakistan", lat: 30.4, lon: 69.3, country: "Pakistan" },
  bangladesh: { label: "Bangladesh", lat: 23.7, lon: 90.4, country: "Bangladesh" },
  nepal: { label: "Nepal", lat: 28.4, lon: 84.1, country: "Nepal" },
  bhutan: { label: "Bhutan", lat: 27.5, lon: 90.4, country: "Bhutan" },
  myanmar: { label: "Myanmar", lat: 21.9, lon: 95.9, country: "Myanmar" },
  "sri lanka": { label: "Sri Lanka", lat: 7.9, lon: 80.8, country: "Sri Lanka" },
  maldives: { label: "Maldives", lat: 3.2, lon: 73.2, country: "Maldives" },
  afghanistan: { label: "Afghanistan", lat: 33.9, lon: 67.7, country: "Afghanistan" },
  japan: { label: "Japan", lat: 36.2, lon: 138.3, country: "Japan" },
  vietnam: { label: "Vietnam", lat: 14.1, lon: 108.3, country: "Vietnam" },
  indonesia: { label: "Indonesia", lat: -0.8, lon: 113.9, country: "Indonesia" },
  australia: { label: "Australia", lat: -25.3, lon: 133.8, country: "Australia" },
  russia: { label: "Russia", lat: 61.5, lon: 105.3, country: "Russia" },
  ukraine: { label: "Ukraine", lat: 48.4, lon: 31.2, country: "Ukraine" },
  germany: { label: "Germany", lat: 51.2, lon: 10.5, country: "Germany" },
  france: { label: "France", lat: 46.2, lon: 2.2, country: "France" },
  greece: { label: "Greece", lat: 39.1, lon: 21.8, country: "Greece" },
  italy: { label: "Italy", lat: 41.9, lon: 12.6, country: "Italy" },
  "united kingdom": { label: "United Kingdom", lat: 55.4, lon: -3.4, country: "United Kingdom" },
  uk: { label: "United Kingdom", lat: 55.4, lon: -3.4, country: "United Kingdom" },
  "united states": { label: "United States", lat: 39.8, lon: -98.6, country: "United States" },
  usa: { label: "United States", lat: 39.8, lon: -98.6, country: "United States" },
  canada: { label: "Canada", lat: 56.1, lon: -106.3, country: "Canada" },
  brazil: { label: "Brazil", lat: -14.2, lon: -51.9, country: "Brazil" },
  venezuela: { label: "Venezuela", lat: 6.4, lon: -66.6, country: "Venezuela" },
  cuba: { label: "Cuba", lat: 21.5, lon: -77.8, country: "Cuba" },
  "south africa": { label: "South Africa", lat: -30.6, lon: 22.9, country: "South Africa" },
  sudan: { label: "Sudan", lat: 12.9, lon: 30.2, country: "Sudan" },
  iran: { label: "Iran", lat: 32.4, lon: 53.7, country: "Iran" },
  israel: { label: "Israel", lat: 31.0, lon: 34.9, country: "Israel" },
  egypt: { label: "Egypt", lat: 26.8, lon: 30.8, country: "Egypt" },
  "red sea": { label: "Red Sea", lat: 20.3, lon: 38.5, country: "World" },
  "strait of hormuz": { label: "Strait of Hormuz", lat: 26.6, lon: 56.3, country: "World" },
  taiwan: { label: "Taiwan", lat: 23.7, lon: 121.0, country: "Taiwan" },
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
  return String(value).toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function geoPoint(lat, lon, bounds) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return [x, y];
}

function resolveLocation(location = "") {
  const key = keyFor(location);
  if (INDIA_LOCATIONS[key]) {
    const item = INDIA_LOCATIONS[key];
    return {
      mapType: "india",
      label: item.label || location,
      country: "India",
      state: item.state || "",
      city: item.city || "",
      point: geoPoint(item.lat, item.lon, INDIA_BOUNDS),
      lat: item.lat,
      lon: item.lon,
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
      point: geoPoint(item.lat, item.lon, WORLD_BOUNDS),
      lat: item.lat,
      lon: item.lon,
    };
  }
  return {
    mapType: "world",
    label: location,
    country: "Location",
    state: "",
    city: "",
    point: null,
    lat: null,
    lon: null,
  };
}

function Marker({ point, label }) {
  if (!point) return null;
  return (
    <span className="geo-marker" style={{ left: `${point[0]}%`, top: `${point[1]}%` }}>
      <i />
      <b>{label}</b>
    </span>
  );
}

function LocationTrail({ meta }) {
  const trail = [];
  if (meta.mapType === "india") trail.push(["Country", "India"]);
  else if (meta.country && meta.country !== "World") trail.push(["Country", meta.country]);
  if (meta.state && meta.state !== "India") trail.push(["State", meta.state]);
  if (meta.city) trail.push(["Place", meta.city]);
  else if (meta.label && !trail.some(([, value]) => value === meta.label)) trail.push(["Focus", meta.label]);

  return (
    <div className="atlas-location-trail" aria-label="Location hierarchy">
      {trail.map(([type, value], index) => (
        <span key={`${type}-${value}`}>
          <small>{type}</small>
          <strong>{value}</strong>
          {index < trail.length - 1 && <em>→</em>}
        </span>
      ))}
    </div>
  );
}

function MapPanel({ title, icon, asset, meta, physical = false }) {
  const isIndia = meta.mapType === "india";
  return (
    <div className={`geo-map-panel ${isIndia ? "geo-map-panel--india" : "geo-map-panel--world"}`}>
      <div className="geo-map-panel-head">
        <span>{icon}{title}</span>
        {meta.point && <small>{meta.lat.toFixed(2)}°, {meta.lon.toFixed(2)}°</small>}
      </div>
      <div className={`geo-map-frame ${isIndia ? "geo-map-frame--india" : "geo-map-frame--world"}`}>
        <img src={asset} alt={`${physical ? "Physical" : "Political"} locator map for ${meta.label}`} />
        <Marker point={meta.point} label={meta.label} />
      </div>
    </div>
  );
}

export default function ArticleStudyVisuals({ mapLocations }) {
  const locations = useMemo(() => normaliseLocations(mapLocations), [mapLocations]);
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");
  if (!locations.length) return null;

  const meta = resolveLocation(selectedLocation);
  const politicalAsset = meta.mapType === "india"
    ? "/maps/india-location-map.svg"
    : "/maps/world-location-map.svg";
  const physicalAsset = meta.mapType === "india"
    ? "/maps/india-relief-location-map.jpg"
    : "/maps/world-physical-map.jpg";

  return (
    <section className="atlas-locator-card" aria-label="Static location maps for this article">
      <div className="atlas-locator-head">
        <div>
          <span><MapPin size={15} /> Map focus</span>
          <h2>Locate the place</h2>
        </div>
        <small>{meta.point ? "Coordinate-based static locator" : "No guessed marker for unknown locations"}</small>
      </div>

      <LocationTrail meta={meta} />

      <div className="geo-map-grid">
        <MapPanel
          title="Political map"
          icon={<MapIcon size={14} />}
          asset={politicalAsset}
          meta={meta}
        />
        <MapPanel
          title="Physical map"
          icon={<Mountain size={14} />}
          asset={physicalAsset}
          meta={meta}
          physical
        />
      </div>

      <div className="atlas-location-tabs" aria-label="Locations mentioned in article">
        {locations.map((location) => {
          const resolved = resolveLocation(location);
          return (
            <button
              key={location}
              type="button"
              onClick={() => setSelectedLocation(location)}
              className={selectedLocation === location ? "is-active" : ""}
              title={resolved.point ? `Show ${resolved.label}` : `${resolved.label}: exact marker unavailable`}
            >
              <MapPin size={13} /> {resolved.label}
            </button>
          );
        })}
      </div>

      <p className="atlas-map-note">
        {meta.point
          ? "Marker uses stored geographic coordinates on equirectangular location-map bounds."
          : "The article names this place, but CurrentPulse does not have a verified coordinate for it, so no marker is guessed."}
        {" "}India map bases: Wikimedia Commons / Uwe Dedering (CC BY-SA 3.0). World political base: public domain; physical world base: Gundan (CC BY-SA 4.0).
      </p>
    </section>
  );
}
