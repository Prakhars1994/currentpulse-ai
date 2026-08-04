import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchNextIasTopics() {
  return fetchDailyDigestTopics({
    sourceName: "NEXT IAS",
    baseUrl: "https://www.nextias.com",
    listUrl: "https://www.nextias.com/ca/current-affairs",
    linkPattern: /nextias\.com\/ca\/current-affairs\/\d{2}-\d{2}-20\d{2}/i,
    followTopicLinks: true,
    detailSelectors: ["[itemprop='articleBody']", ".single-post-content", ".entry-content", "main article", "article", "main"],
    maxTopics: 14,
  });
}
