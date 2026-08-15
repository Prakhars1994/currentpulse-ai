
import {
  absoluteUrl,
  cleanText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const SOURCE_CONFIG = {
  bankersadda: {
    sourceName: "BankersAdda",
    listUrl: "https://www.bankersadda.com/current-affairs/",
    baseUrl: "https://www.bankersadda.com/",
    exams: ["banking", "ssc", "railway"],
    accept: /daily-current-affairs|current-affairs-daily-gk-update/i,
  },
  oliveboard: {
    sourceName: "Oliveboard",
    listUrl: "https://www.oliveboard.in/daily-current-affairs/",
    baseUrl: "https://www.oliveboard.in/",
    exams: ["banking", "ssc", "railway", "state-pcs"],
    accept: /current-affairs/i,
  },
  affairscloud: {
    sourceName: "AffairsCloud",
    listUrl: "https://affairscloud.com/current-affairs/",
    baseUrl: "https://affairscloud.com/",
    exams: ["banking", "ssc", "railway", "state-pcs"],
    accept: /current-affairs-(?:\d|january|february|march|april|may|june|july|august|september|october|november|december)/i,
  },
  testbook: {
    sourceName: "Testbook",
    listUrl: "https://testbook.com/current-affairs",
    baseUrl: "https://testbook.com/",
    exams: ["upsc", "banking", "ssc", "railway", "state-pcs"],
    accept: /current-affairs/i,
  },
};

const REJECT = /\b(?:quiz|mock|pdf|course|subscription|login|sign up|monthly|yearly|last \d+ months|syllabus|exam pattern)\b/i;
const HEADING_REJECT = /^(?:current affairs|national affairs|international affairs|banking(?: & finance)?|sports|awards?(?: & recognitions)?|appointments?(?: & resignations)?|important days?|business|economy|environment|science(?: & technology)?|about|key details|highlights?|frequently asked questions?)$/i;

function publishedAt($) {
  return (
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) ||
    parseDate($("time").first().text()) ||
    null
  );
}

function sectionText($, heading) {
  const parts = [];
  let node = $(heading).next();
  while (node.length && !node.is("h1,h2,h3")) {
    const clone = node.clone();
    clone.find("script,style,nav,footer,form,button,iframe,noscript,.ads,.advertisement").remove();
    clone.find("li").each((_, item) => {
      const element = $(item);
      element.replaceWith(`\n- ${cleanText(element.text())}`);
    });
    clone.find("p,blockquote").each((_, item) => {
      const element = $(item);
      element.replaceWith(`\n${cleanText(element.text())}\n`);
    });
    const value = String(clone.text() || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (value) parts.push(value);
    node = node.next();
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6500);
}

async function extractDailyPage(pageUrl, config) {
  const html = await fetchHtml(pageUrl, 12000);
  const $ = loadHtml(html);
  const date = publishedAt($);
  const topics = [];

  $("article h2, article h3, main h2, main h3, .entry-content h2, .entry-content h3, .post-content h2, .post-content h3")
    .each((_, heading) => {
      const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
      if (title.length < 12 || title.length > 190 || HEADING_REJECT.test(title) || REJECT.test(title)) return;
      const summary = sectionText($, heading);
      if (summary.length < 110) return;
      const category = guessCategory(`${title} ${summary.slice(0, 1400)}`);
      topics.push({
        source: config.sourceName,
        title,
        summary,
        url: `${pageUrl.split("#")[0]}#${encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80))}`,
        publishedAt: date,
        category,
        paper: guessPaper(category),
        keywords: config.exams.map((exam) => `exam:${exam}`),
      });
    });

  return topics.slice(0, 80);
}

export async function fetchExamCoachingTopics(sourceId) {
  const config = SOURCE_CONFIG[sourceId];
  if (!config) throw new Error(`Unknown exam coaching source: ${sourceId}`);

  const html = await fetchHtml(config.listUrl, 12000);
  const $ = loadHtml(html);
  const links = [];

  $("a[href]").each((_, anchor) => {
    const text = cleanText($(anchor).text());
    const url = absoluteUrl(config.baseUrl, $(anchor).attr("href"));
    if (!url || !config.accept.test(`${url} ${text}`) || REJECT.test(`${url} ${text}`)) return;
    try {
      if (new URL(url).hostname !== new URL(config.baseUrl).hostname) return;
    } catch {
      return;
    }
    links.push({ url, title: text });
  });

  const recent = uniqueByUrl(links).slice(0, 5);
  const settled = await Promise.allSettled(recent.map((item) => extractDailyPage(item.url, config)));
  const topics = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!topics.length) throw new Error(`${config.sourceName} returned no usable public Current Affairs sections.`);
  return topics;
}

export const fetchBankersAddaTopics = () => fetchExamCoachingTopics("bankersadda");
export const fetchOliveboardTopics = () => fetchExamCoachingTopics("oliveboard");
export const fetchAffairsCloudTopics = () => fetchExamCoachingTopics("affairscloud");
export const fetchTestbookCurrentAffairsTopics = () => fetchExamCoachingTopics("testbook");
