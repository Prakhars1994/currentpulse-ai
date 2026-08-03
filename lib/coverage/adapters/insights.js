import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchInsightsTopics() {
  return fetchDailyDigestTopics({
    sourceName: "Insights IAS",
    baseUrl: "https://www.insightsonindia.com",
    listUrl: "https://www.insightsonindia.com/current-affairs-upsc/",
    linkPattern: /insightsonindia\.com\/20\d{2}\/\d{2}\/\d{2}\/upsc-current-affairs-/i,
    maxTopics: 18,
  });
}
