import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchForumTopics() {
  return fetchDailyDigestTopics({
    sourceName: "ForumIAS",
    baseUrl: "https://forumias.com",
    listUrl: "https://forumias.com/blog/9pm/",
    linkPattern: /forumias\.com\/blog\/(?:9-pm|9pm).*current-affairs/i,
    rejectLinkPattern: /monthly|compilation/i,
    maxTopics: 16,
  });
}
