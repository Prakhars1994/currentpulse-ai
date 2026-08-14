export const CATEGORY_ROUTES = [
  {
    slug: "general-news",
    name: "General News",
    icon: "NEW",
    aliases: ["General News"],
  },
  {
    slug: "polity",
    name: "Polity & Governance",
    shortName: "Polity",
    icon: "🏛️",
    aliases: ["Polity & Governance", "Polity", "Governance"],
  },
  {
    slug: "economy",
    name: "Economy",
    icon: "💰",
    aliases: ["Economy", "Economics", "Indian Economy", "Agriculture"],
  },
  {
    slug: "international",
    name: "International Relations",
    shortName: "International",
    icon: "🌍",
    aliases: ["International Relations", "International", "World Affairs"],
  },
  {
    slug: "science-tech",
    name: "Science & Technology",
    shortName: "Science & Tech",
    icon: "🔬",
    aliases: [
      "Science & Technology",
      "Science and Technology",
      "Science & Tech",
      "Technology",
    ],
  },
  {
    slug: "environment",
    name: "Environment",
    icon: "🌱",
    aliases: ["Environment", "Ecology", "Climate Change"],
  },
  {
    slug: "defence-security",
    name: "Defence & Security",
    shortName: "Defence",
    icon: "🛡️",
    aliases: ["Defence & Security", "Defence", "Defense", "Security"],
  },
  {
    slug: "social-issues",
    name: "Social Issues",
    icon: "👥",
    aliases: ["Social Issues", "Society", "Health", "Education"],
  },
  {
    slug: "government-schemes",
    name: "Government Schemes",
    shortName: "Schemes",
    icon: "📜",
    aliases: ["Government Schemes", "Schemes", "Government Scheme"],
  },
  {
    slug: "history-culture",
    name: "History & Culture",
    shortName: "History & Culture",
    icon: "🏺",
    aliases: ["History & Culture", "History", "Art & Culture", "Culture"],
  },
  {
    slug: "geography",
    name: "Geography",
    icon: "🗺️",
    aliases: ["Geography", "Physical Geography"],
  },
  {
    slug: "sports",
    name: "Sports",
    icon: "🏅",
    aliases: ["Sports", "Sport"],
  },
  {
    slug: "space",
    name: "Space",
    icon: "🛰️",
    aliases: ["Space"],
    parentAliases: ["Science & Technology", "Science and Technology"],
    keywords: ["space", "isro", "satellite", "orbital", "launch vehicle"],
  },
  {
    slug: "judiciary",
    name: "Judiciary",
    icon: "⚖️",
    aliases: ["Judiciary"],
    parentAliases: ["Polity & Governance", "Polity", "Governance"],
    keywords: ["judiciary", "supreme court", "high court", "judge", "judicial"],
  },
];

function clean(value = "") {
  return String(value).trim().toLowerCase();
}

export function resolveCategoryRoute(slug = "") {
  const value = clean(decodeURIComponent(slug));

  return (
    CATEGORY_ROUTES.find((route) => {
      if (route.slug === value) return true;
      return route.aliases.some(
        (alias) => createCategorySlug(alias) === value || clean(alias) === value
      );
    }) || null
  );
}

export function createCategorySlug(category = "") {
  const value = clean(category);
  const matched = CATEGORY_ROUTES.find((route) =>
    route.aliases.some((alias) => clean(alias) === value)
  );

  if (matched) return matched.slug;

  return value
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function articleMatchesCategory(article, route) {
  if (!route) return false;

  const category = clean(article?.category);
  if (route.aliases.some((alias) => clean(alias) === category)) return true;

  if (!route.parentAliases?.some((alias) => clean(alias) === category)) {
    return false;
  }

  const searchable = clean(
    [article?.title, article?.why_news, article?.prelims, article?.mains]
      .filter(Boolean)
      .join(" ")
  );

  return (route.keywords || []).some((keyword) =>
    searchable.includes(clean(keyword))
  );
}
