function stripMarkup(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value = "") {
  return [...String(value)].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    2166136261
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeOptions(correct, pool, seed) {
  const distractors = unique(pool)
    .filter((value) => value !== correct)
    .sort((a, b) => hash(`${seed}-${a}`) - hash(`${seed}-${b}`))
    .slice(0, 3);

  if (distractors.length < 3) return null;

  return [correct, ...distractors].sort(
    (a, b) => hash(`${seed}-option-${a}`) - hash(`${seed}-option-${b}`)
  );
}

export function buildQuiz(articles = [], maximumQuestions = 12) {
  const usable = articles.filter((article) => article?.title && article?.slug);
  const titlePool = usable.map((article) => article.title);
  const categoryPool = unique(usable.map((article) => article.category));
  const paperPool = unique([
    ...usable.map((article) => article.paper),
    "Prelims",
    "GS-1",
    "GS-2",
    "GS-3",
    "GS-4",
  ]);
  const questions = [];

  for (let index = 0; index < usable.length && questions.length < maximumQuestions; index += 1) {
    const article = usable[index];
    const seed = `${article.id || index}-${article.slug}`;
    const mode = index % 3;

    if (mode === 0 && article.why_news) {
      const clue = stripMarkup(article.why_news).slice(0, 210);
      const options = makeOptions(article.title, titlePool, seed);
      if (clue.length >= 70 && options) {
        questions.push({
          id: `event-${seed}`,
          type: "Current event",
          prompt: `Which recent development is described below?\n\n“${clue}${clue.length >= 210 ? "…" : ""}”`,
          options,
          answer: article.title,
          explanation: `The description refers to “${article.title}”. Read the linked analysis for its prelims facts and mains significance.`,
          articleUrl: `/current-affairs/${article.slug}`,
          articleTitle: article.title,
        });
        continue;
      }
    }

    if (mode === 1 && article.category) {
      const options = makeOptions(article.category, categoryPool, seed);
      if (options) {
        questions.push({
          id: `category-${seed}`,
          type: "Syllabus mapping",
          prompt: `“${article.title}” is primarily mapped to which CurrentPulse UPSC category?`,
          options,
          answer: article.category,
          explanation: `This development is classified under ${article.category}${article.paper ? ` and mapped to ${article.paper}` : ""}.`,
          articleUrl: `/current-affairs/${article.slug}`,
          articleTitle: article.title,
        });
        continue;
      }
    }

    if (article.paper) {
      const options = makeOptions(article.paper, paperPool, seed);
      if (options) {
        questions.push({
          id: `paper-${seed}`,
          type: "GS paper",
          prompt: `Which paper is the primary syllabus mapping for “${article.title}”?`,
          options,
          answer: article.paper,
          explanation: `CurrentPulse maps this topic primarily to ${article.paper}${article.category ? ` under ${article.category}` : ""}.`,
          articleUrl: `/current-affairs/${article.slug}`,
          articleTitle: article.title,
        });
      }
    }
  }

  return questions;
}
