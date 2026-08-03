function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function plain(value = "", maximum = 500) {
  return String(value || "")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function wrap(value, maximum, lineLimit) {
  const words = plain(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maximum && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
    if (lines.length >= lineLimit) break;
  }
  if (current && lines.length < lineLimit) lines.push(current);
  return lines;
}

function textLines(lines, { x, y, size, gap, color, weight = 600 }) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * gap}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
    )
    .join("");
}

function summaryParts(value = "") {
  const cleaned = plain(value, 700)
    .replace(/Trigger:\s*/i, "")
    .replace(/Core idea:\s*/i, "")
    .replace(/UPSC link:\s*/i, "");
  const parts = cleaned.split(/\s*(?:→|->)\s*/).filter(Boolean).slice(0, 3);
  while (parts.length < 3) parts.push(["Latest development", "Core mechanism", "Exam relevance"][parts.length]);
  return parts;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const title = plain(params.get("title") || "UPSC Current Affairs", 180);
  const memory = plain(params.get("memory") || "Connect the key facts as one revision story.", 420);
  const parts = summaryParts(params.get("summary") || "");
  const titleLines = wrap(title, 42, 2);
  const memoryLines = wrap(memory, 72, 3);
  const labels = ["1 · TRIGGER", "2 · CORE IDEA", "3 · UPSC LINK"];
  const colors = ["#67e8f9", "#fde68a", "#86efac"];

  const cards = parts.map((part, index) => {
    const x = 70 + index * 375;
    return `<rect x="${x}" y="430" width="340" height="160" rx="24" fill="#0f172a" stroke="${colors[index]}" stroke-opacity=".55"/>
      <text x="${x + 24}" y="470" fill="${colors[index]}" font-family="Arial, sans-serif" font-size="19" font-weight="800">${labels[index]}</text>
      ${textLines(wrap(part, 35, 3), { x: x + 24, y: 510, size: 20, gap: 27, color: "#e2e8f0", weight: 600 })}`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#020617"/><stop offset=".55" stop-color="#172554"/><stop offset="1" stop-color="#3b0764"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#22d3ee" stop-opacity=".34"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/>
    <circle cx="1050" cy="110" r="250" fill="url(#glow)"/>
    <path d="M1010 70c-58 0-105 45-105 101 0 35 18 65 46 84v58h118v-58c28-19 46-49 46-84 0-56-47-101-105-101Z" fill="none" stroke="#67e8f9" stroke-width="7" stroke-opacity=".7"/>
    <path d="M963 149c26-27 69-27 95 0M968 194h84M982 238h56" fill="none" stroke="#fde68a" stroke-width="7" stroke-linecap="round"/>
    <rect x="68" y="55" width="250" height="48" rx="24" fill="#0891b2" fill-opacity=".22" stroke="#22d3ee" stroke-opacity=".6"/>
    <text x="92" y="87" fill="#a5f3fc" font-family="Arial, sans-serif" font-size="20" font-weight="800">CURRENTPULSE MEMORY MAP</text>
    ${textLines(titleLines, { x: 70, y: 160, size: 38, gap: 48, color: "#f8fafc", weight: 850 })}
    <text x="70" y="280" fill="#fcd34d" font-family="Arial, sans-serif" font-size="21" font-weight="850">MEMORY HOOK</text>
    ${textLines(memoryLines, { x: 70, y: 318, size: 24, gap: 34, color: "#f1f5f9", weight: 650 })}
    ${cards.join("")}
    <text x="70" y="642" fill="#94a3b8" font-family="Arial, sans-serif" font-size="18" font-weight="700">READ → CONNECT → RECALL</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
