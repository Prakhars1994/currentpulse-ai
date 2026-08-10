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
  { id: "the-hindu", name: "The Hindu", group: "indian-news", domain: "thehindu.com", region: "IN", newsAgenda: true },
  { id: "indian-express", name: "The Indian Express", group: "indian-news", domain: "indianexpress.com", region: "IN", newsAgenda: true },
  { id: "business-standard", name: "Business Standard", group: "indian-news", domain: "business-standard.com", region: "IN" },
  { id: "livemint", name: "LiveMint", group: "indian-news", domain: "livemint.com", region: "IN" },
  { id: "reuters-india", name: "Reuters India", group: "indian-news", domain: "reuters.com", region: "IN", extraQuery: "India" },
  { id: "hindustan-times", name: "Hindustan Times", group: "indian-news", domain: "hindustantimes.com", region: "IN", newsAgenda: true },
  { id: "times-of-india", name: "The Times of India", group: "indian-news", domain: "timesofindia.indiatimes.com", region: "IN", newsAgenda: true },
  { id: "new-indian-express", name: "The New Indian Express", group: "state-news", domain: "newindianexpress.com", region: "IN", newsAgenda: true },
  { id: "deccan-herald", name: "Deccan Herald", group: "state-news", domain: "deccanherald.com", region: "IN", queryTerms: ["Karnataka South India national news when:2d"] },
  { id: "telegraph-india", name: "The Telegraph India", group: "state-news", domain: "telegraphindia.com", region: "IN", queryTerms: ["West Bengal east India national news when:2d"] },
  { id: "tribune-india", name: "The Tribune", group: "state-news", domain: "tribuneindia.com", region: "IN", queryTerms: ["Punjab Haryana Himachal Chandigarh national news when:2d"] },
  { id: "assam-tribune", name: "The Assam Tribune", group: "state-news", domain: "assamtribune.com", region: "IN", queryTerms: ["Assam Northeast India news when:2d"] },

  // Global news publishers
  { id: "reuters-world", name: "Reuters", group: "global-news", domain: "reuters.com", region: "WORLD", extraQuery: "world", newsAgenda: true },
  { id: "associated-press", name: "Associated Press", group: "global-news", domain: "apnews.com", region: "WORLD", newsAgenda: true },
  { id: "bbc-world", name: "BBC World", group: "global-news", domain: "bbc.com", region: "WORLD", extraQuery: "world", newsAgenda: true },
  { id: "financial-times", name: "Financial Times", group: "global-news", domain: "ft.com", region: "WORLD" },
  { id: "nikkei-asia", name: "Nikkei Asia", group: "global-news", domain: "asia.nikkei.com", region: "WORLD" },
  { id: "al-jazeera", name: "Al Jazeera", group: "global-news", domain: "aljazeera.com", region: "WORLD", newsAgenda: true },
  { id: "guardian-world", name: "The Guardian", group: "global-news", domain: "theguardian.com", region: "WORLD", newsAgenda: true },
  { id: "dw-world", name: "DW", group: "global-news", domain: "dw.com", region: "WORLD" },

  // Official sources (PIB is fetched by the existing dedicated PIB route)
  { id: "rbi", name: "Reserve Bank of India", group: "official", domain: "rbi.org.in", region: "IN" },
  { id: "isro", name: "ISRO", group: "official", domain: "isro.gov.in", region: "IN" },
  { id: "mea", name: "Ministry of External Affairs", group: "official", domain: "mea.gov.in", region: "IN" },
  { id: "who", name: "World Health Organization", group: "official", domain: "who.int", region: "WORLD" },
  { id: "un", name: "United Nations", group: "official", domain: "un.org", region: "WORLD" },
  { id: "world-bank", name: "World Bank", group: "official", domain: "worldbank.org", region: "WORLD" },
  { id: "imf", name: "International Monetary Fund", group: "official", domain: "imf.org", region: "WORLD" },
];

export const GENERAL_NEWS_QUERY_TERMS = [
  "",
];
