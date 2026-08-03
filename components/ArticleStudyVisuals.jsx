"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, ExternalLink, MapPin, Route } from "lucide-react";

import ArticleContent from "@/components/ArticleContent";

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

export default function ArticleStudyVisuals({ title, visualSummary, memoryTrick, mapLocations }) {
  const locations = useMemo(() => normaliseLocations(mapLocations), [mapLocations]);
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");

  if (!visualSummary && !memoryTrick && !locations.length) return null;

  return (
    <section className="study-visual-grid" aria-label="Article revision aids">
      {visualSummary && (
        <div className="study-visual-card study-visual-card--flow">
          <div className="study-visual-label"><Route size={19} /> 30-second concept map</div>
          <ArticleContent content={visualSummary} />
        </div>
      )}

      {memoryTrick && (
        <div className="study-visual-card study-visual-card--memory">
          <div className="study-visual-label"><BrainCircuit size={19} /> Remember this</div>
          <ArticleContent content={memoryTrick} />
          <figure className="study-memory-figure">
            <img
              src={`/api/memory-visual?${new URLSearchParams({
                title: title || "UPSC Current Affairs",
                memory: memoryTrick,
                summary: visualSummary || "",
              }).toString()}`}
              alt={`Memory map for ${title || "this current-affairs topic"}`}
              loading="lazy"
            />
            <figcaption>CurrentPulse original revision visual · safe to save and revise</figcaption>
          </figure>
        </div>
      )}

      {locations.length > 0 && (
        <div className="study-map-card">
          <div className="study-visual-label"><MapPin size={19} /> Places in this article</div>
          <div className="study-map-tabs" role="tablist" aria-label="Map locations">
            {locations.map((location) => (
              <button
                key={location}
                type="button"
                role="tab"
                aria-selected={selectedLocation === location}
                onClick={() => setSelectedLocation(location)}
                className={selectedLocation === location ? "is-active" : ""}
              >
                {location}
              </button>
            ))}
          </div>
          <div className="study-map-frame">
            <iframe
              key={selectedLocation}
              title={`Map of ${selectedLocation}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(selectedLocation)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="study-map-link"
          >
            Explore {selectedLocation} on map <ExternalLink size={15} />
          </a>
        </div>
      )}
    </section>
  );
}
