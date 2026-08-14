import { EXAM_TYPE_META } from "@/lib/exams/constants";

export function getExamUpdateDisplayType(item = {}) {
  const title = String(item.title || "").toLowerCase();

  if (
    /\b(?:advance\s+intimation\b[\s\S]{0,90}\bexamination\s+city|city\s+intimation|exam(?:ination)?\s+city)\b/.test(title)
  ) {
    return "City Intimation";
  }

  if (
    /\b(?:internship|eligibility|qualification|experience|age)\b[\s\S]{0,100}\b(?:cut[- ]?off|cutoff|completion date|last date|deadline)\b/.test(title)
  ) {
    return "Eligibility Deadline";
  }

  if (item.update_type === "cut-off") return "Score Cut-off";

  if (
    item.update_type === "deadline" &&
    /\b(?:application|apply|registration)\b/.test(title)
  ) {
    return "Application Deadline";
  }

  return EXAM_TYPE_META[item.update_type]?.label || "Update";
}
