import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchVajiramTopics() {
  return fetchDailyDigestTopics({
    sourceName: "Vajiram & Ravi",
    baseUrl: "https://vajiramandravi.com",
    listUrl: "https://vajiramandravi.com/current-affairs/",
    linkPattern: /vajiramandravi\.com\/current-affairs\/upsc-(?:prelims-)?current-affairs\/20\d{2}\/\d{2}\/\d{2}/i,
    maxTopics: 18,
  });
}
