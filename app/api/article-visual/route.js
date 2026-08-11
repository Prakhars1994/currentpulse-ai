const palette = {
  "Polity & Governance": ["#0f766e", "#155e75"],
  Economy: ["#075985", "#3730a3"],
  "International Relations": ["#1d4ed8", "#6d28d9"],
  "Science & Technology": ["#4338ca", "#7e22ce"],
  Environment: ["#166534", "#0f766e"],
  "Defence & Security": ["#334155", "#991b1b"],
  "History & Culture": ["#92400e", "#9f1239"],
  "Social Issues": ["#9f1239", "#6d28d9"],
  Geography: ["#0369a1", "#0f766e"],
  "Government Schemes": ["#7c2d12", "#b45309"],
  Sports: ["#166534", "#1d4ed8"],
};

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title, maximum = 34) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maximum && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const title = String(params.get("title") || "UPSC Current Affairs").slice(0, 150);
  const category = String(params.get("category") || "Current Affairs").slice(0, 60);
  const [from, to] = palette[category] || ["#0f172a", "#0e7490"];
  const lines = wrapTitle(title).map(
    (line, index) => `<text x="76" y="${238 + index * 72}" fill="#f8fafc" font-family="Arial, sans-serif" font-size="52" font-weight="800">${escapeXml(line)}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#fff" stroke-opacity=".08"/></pattern>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/><rect width="1200" height="675" fill="url(#grid)"/>
    <circle cx="1010" cy="150" r="190" fill="none" stroke="#67e8f9" stroke-opacity=".22" stroke-width="3"/>
    <circle cx="1010" cy="150" r="126" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2"/>
    <path d="M840 488C920 402 980 430 1035 345c33-50 39-103 67-137" fill="none" stroke="#67e8f9" stroke-width="9" stroke-linecap="round"/>
    <circle cx="840" cy="488" r="15" fill="#fbbf24"/><circle cx="1035" cy="345" r="15" fill="#fbbf24"/><circle cx="1102" cy="208" r="15" fill="#fbbf24"/>
    <rect x="74" y="70" rx="23" width="${Math.min(480, 180 + category.length * 13)}" height="56" fill="#020617" fill-opacity=".55" stroke="#67e8f9" stroke-opacity=".6"/>
    <text x="102" y="108" fill="#a5f3fc" font-family="Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(category.toUpperCase())}</text>
    ${lines.join("")}
    <text x="76" y="612" fill="#cffafe" font-family="Arial, sans-serif" font-size="25" font-weight="700">CURRENTPULSE AI  •  QUICK VISUAL BRIEF</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
