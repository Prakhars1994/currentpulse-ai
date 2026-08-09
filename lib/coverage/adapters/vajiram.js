import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchVajiramTopics() {
  return fetchDailyDigestTopics({
    sourceName: "Vajiram & Ravi",
    baseUrl: "https://vajiramandravi.com",
    listUrl: "https://vajiramandravi.com/current-affairs/",
    linkPattern: /vajiramandravi\.com\/current-affairs\/upsc-(?:prelims-|mains-)?current-affairs\/20\d{2}\/\d{2}\/\d{2}/i,
    // Vajiram daily pages already contain full topic bodies. Avoid dozens of
    // unnecessary detail requests and collect both Prelims + Mains streams.
    followTopicLinks: false,
    digestGroups: [
      { pattern: /\/upsc-prelims-current-affairs\//i, limit: 2 },
      { pattern: /\/upsc-mains-current-affairs\//i, limit: 2 },
    ],
    maxDigestPages: 4,
    maxTopicsPerDigest: 80,
    maxTopicsTotal: 220,
  });
}
