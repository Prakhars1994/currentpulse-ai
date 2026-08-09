import { fetchDailyDigestTopics } from "@/lib/coverage/adapters/dailyDigest";

export function fetchForumTopics() {
  return fetchDailyDigestTopics({
    sourceName: "ForumIAS",
    baseUrl: "https://forumias.com",
    listUrl: "https://forumias.com/blog/9pm/",
    linkPattern: /forumias\.com\/blog\/(?:9-pm|9pm).*current-affairs/i,
    rejectLinkPattern: /monthly|compilation/i,
    topicSelector: ".entry-content h2, .entry-content h3, article h2, article h3",
    boundarySelector: "h2, h3",
    maxDigestPages: 4,
    maxTopicsPerDigest: 70,
    maxTopicsTotal: 200,
  });
}
