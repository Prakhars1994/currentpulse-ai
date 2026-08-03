import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchIasBabaTopics() {
  return fetchDailyDigestTopics({
    sourceName: "IASbaba",
    baseUrl: "https://iasbaba.com",
    listUrl: "https://iasbaba.com/iasbabas-daily-current-affairs/",
    linkPattern: /iasbaba\.com\/20\d{2}\/\d{2}\/.*daily-current-affairs/i,
    rejectLinkPattern: /quiz|magazine|compilation/i,
    maxTopics: 16,
  });
}
