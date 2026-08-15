
import questions from "@/lib/examPrep/openQuestionBank.json";
import { getExamVertical } from "@/lib/examPrep/sourceRegistry";

function hash(value = "") {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function buildExamMock(exam = "upsc", testNumber = 1, count = 20) {
  const vertical = getExamVertical(exam);
  const test = Math.max(1, Math.min(Number(testNumber) || 1, 10));
  const pool = questions.filter((q) => Array.isArray(q.exams) && q.exams.includes(vertical.slug));
  return [...pool]
    .sort((a, b) => hash(`${vertical.slug}|${test}|${a.id}`) - hash(`${vertical.slug}|${test}|${b.id}`))
    .slice(0, Math.min(count, pool.length));
}
