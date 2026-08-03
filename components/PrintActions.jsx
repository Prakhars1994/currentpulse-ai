"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";

export default function PrintActions() {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950"
      >
        <Printer size={18} /> Print / Save as PDF
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? "Copied" : "Copy digest link"}
      </button>
    </div>
  );
}
