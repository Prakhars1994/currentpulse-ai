export const NEWS_SOURCES = [


{
  id: "pib-direct",
  name: "Press Information Bureau",
  group: "official",
  domain: "pib.gov.in",
  region: "IN",
  rssUrl: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
},


  // Indian news publishers
  { id: "the-hindu", name: "The Hindu", group: "indian-news", domain: "thehindu.com", region: "IN" },
  { id: "indian-express", name: "The Indian Express", group: "indian-news", domain: "indianexpress.com", region: "IN" },
  { id: "business-standard", name: "Business Standard", group: "indian-news", domain: "business-standard.com", region: "IN" },
  { id: "livemint", name: "LiveMint", group: "indian-news", domain: "livemint.com", region: "IN" },
  { id: "reuters-india", name: "Reuters India", group: "indian-news", domain: "reuters.com", region: "IN", extraQuery: "India" },

  // Global news publishers
  { id: "reuters-world", name: "Reuters", group: "global-news", domain: "reuters.com", region: "WORLD", extraQuery: "world" },
  { id: "associated-press", name: "Associated Press", group: "global-news", domain: "apnews.com", region: "WORLD" },
  { id: "bbc-world", name: "BBC World", group: "global-news", domain: "bbc.com", region: "WORLD", extraQuery: "world" },
  { id: "financial-times", name: "Financial Times", group: "global-news", domain: "ft.com", region: "WORLD" },
  { id: "nikkei-asia", name: "Nikkei Asia", group: "global-news", domain: "asia.nikkei.com", region: "WORLD" },

  // Official sources (PIB is fetched by the existing dedicated PIB route)
  { id: "rbi", name: "Reserve Bank of India", group: "official", domain: "rbi.org.in", region: "IN" },
  { id: "isro", name: "ISRO", group: "official", domain: "isro.gov.in", region: "IN" },
  { id: "mea", name: "Ministry of External Affairs", group: "official", domain: "mea.gov.in", region: "IN" },
  { id: "who", name: "World Health Organization", group: "official", domain: "who.int", region: "WORLD" },
  { id: "un", name: "United Nations", group: "official", domain: "un.org", region: "WORLD" },
  { id: "world-bank", name: "World Bank", group: "official", domain: "worldbank.org", region: "WORLD" },
  { id: "imf", name: "International Monetary Fund", group: "official", domain: "imf.org", region: "WORLD" },
];

export const UPSC_QUERY_TERMS = [
  "policy OR government OR parliament OR court OR constitution",
  "economy OR inflation OR banking OR trade OR agriculture",
  "environment OR climate OR biodiversity OR disaster",
  "science OR technology OR space OR health",
  "international relations OR diplomacy OR security OR defence",
];
