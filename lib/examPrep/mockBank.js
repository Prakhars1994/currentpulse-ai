import questions from "@/lib/examPrep/openQuestionBank.json";
import { GENERATED_FOUNDATION_QUESTIONS } from "@/lib/examPrep/generatedFoundationBank";
import { getExamVertical } from "@/lib/examPrep/sourceRegistry";

function hash(value = "") {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizedPrompt(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueQuestions(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizedPrompt(item.prompt);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function balancedOrder(pool, exam) {
  const bySubject = new Map();
  for (const item of pool) {
    const subject = item.subject || "General";
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(item);
  }
  const groups = [...bySubject.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,items]) => [...items].sort((a,b) => hash(`${exam}|${a.id}`) - hash(`${exam}|${b.id}`)));

  const ordered = [];
  let index = 0;
  while (groups.some((group) => index < group.length)) {
    for (const group of groups) if (group[index]) ordered.push(group[index]);
    index += 1;
  }
  return ordered;
}

function validPool(exam) {
  const vertical = getExamVertical(exam);
  return uniqueQuestions([...questions, ...GENERATED_FOUNDATION_QUESTIONS]).filter(
    (q) =>
      Array.isArray(q.exams) &&
      q.exams.includes(vertical.slug) &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      new Set(q.options.map(String)).size === 4 &&
      q.options.map(String).includes(String(q.answer))
  );
}

export function buildExamMock(exam = "upsc", testNumber = 1, count = 20) {
  const vertical = getExamVertical(exam);
  const test = Math.max(1, Math.min(Number(testNumber) || 1, 10));
  const ordered = balancedOrder(validPool(vertical.slug), vertical.slug);
  const needed = count * 10;
  if (ordered.length < needed) {
    throw new Error(`${vertical.label} mock bank has only ${ordered.length} valid unique questions; ${needed} are required for ten distinct mocks.`);
  }

  const start = (test - 1) * count;
  return ordered.slice(start, start + count);
}

export function examMockBankSize(exam = "upsc") {
  return validPool(exam).length;
}
