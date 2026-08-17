import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";
import { historyDateParts } from "@/lib/automation/history";

export function fetchNextIasTopics({ historyDate = "" } = {}) {
  const history = historyDateParts(historyDate);
  return fetchDailyDigestTopics({
    sourceName: "NEXT IAS",
    baseUrl: "https://www.nextias.com",
    listUrl: "https://www.nextias.com/ca/current-affairs",
    linkPattern: /nextias\.com\/ca\/current-affairs\/\d{2}-\d{2}-20\d{2}/i,
    followTopicLinks: true,
    detailSelectors: [
      "[itemprop='articleBody']",
      ".single-post-content",
      ".entry-content",
      "main article",
      "article",
      "main",
    ],
    maxDigestPages: 4,
    maxTopicsPerDigest: 60,
    maxTopicsTotal: 180,
    pageUrls: history
      ? [`https://www.nextias.com/ca/current-affairs/${history.day}-${history.month}-${history.year}`]
      : null,
  });
}
