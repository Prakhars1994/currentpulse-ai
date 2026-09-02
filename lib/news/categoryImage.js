const IMAGE_BY_CATEGORY = {
  "polity & governance": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80",
  polity: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80",
  judiciary: "https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=1200&auto=format&fit=crop&q=80",
  economy: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80",
  "international relations": "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1200&auto=format&fit=crop&q=80",
  international: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1200&auto=format&fit=crop&q=80",
  "science & technology": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&auto=format&fit=crop&q=80",
  space: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
  environment: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop&q=80",
  "defence & security": "https://images.unsplash.com/photo-1569511166187-97eb6e387e19?w=1200&auto=format&fit=crop&q=80",
  "social issues": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&auto=format&fit=crop&q=80",
  geography: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80",
  "history & culture": "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=1200&auto=format&fit=crop&q=80",
  "government schemes": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&auto=format&fit=crop&q=80",
  sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop&q=80",
};

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
];

function stableIndex(value = "", length = 1) { const hash=[...String(value)].reduce((total,character)=>(total*31+character.charCodeAt(0))>>>0,7); return hash%Math.max(1,length); }
export function getCategoryFallbackImage(category="",seed=""){const categoryImage=IMAGE_BY_CATEGORY[String(category).trim().toLowerCase()];if(categoryImage)return categoryImage;return DEFAULT_IMAGES[stableIndex(seed,DEFAULT_IMAGES.length)];}
const GENERIC_IMAGE_URLS=new Set([...Object.values(IMAGE_BY_CATEGORY),...DEFAULT_IMAGES].map((url)=>url.split("?")[0]));
const GOVERNMENT_IMAGE_PROVIDERS=new Set(["isro","nasa","noaa","usgs","pib","usda_ars","nps","cdc_nih"]);
export function isGenericFallbackImage(value=""){return GENERIC_IMAGE_URLS.has(String(value||"").split("?")[0]);}
export function getArticleVisualUrl(article={}){const params=new URLSearchParams({title:article.title||"UPSC Current Affairs",category:article.category||"Current Affairs"});return `/api/article-visual?${params.toString()}`;}
function hostname(value=""){try{return new URL(value).hostname.toLowerCase();}catch{return "";}}
const IMAGE_STOP_WORDS=new Set(["about","after","against","amid","among","and","from","into","over","that","the","their","this","through","towards","under","with","will","india","indian","news","current","affairs","launches","launch","says","government","official","file","photo","image","commons","wikimedia"]);
function imageTokens(value=""){return String(value||"").toLowerCase().replace(/%[0-9a-f]{2}/gi," ").replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter((token)=>token.length>3&&!IMAGE_STOP_WORDS.has(token));}
export function isStoredImageSemanticallyRelevant(article={}){const descriptor=[article.image_caption,article.image_source_url].filter(Boolean).join(" ");if(!descriptor.trim())return false;const query=article.image_search_query||article.title||"";const queryTokens=[...new Set(imageTokens(query))].slice(0,12);const descriptorTokens=new Set(imageTokens(descriptor));if(!queryTokens.length)return false;const matches=queryTokens.filter((token)=>descriptorTokens.has(token)).length;const required=queryTokens.length<=3?1:2;return matches>=required&&matches/queryTokens.length>=0.2;}
export function isVerifiedReusableArticleImage(article={}){const storedImage=article.image||article.image_url||"";if(!storedImage||isGenericFallbackImage(storedImage))return false;if(String(storedImage).startsWith("/api/article-visual"))return false;const imageHost=hostname(storedImage);const sourceHost=hostname(article.image_source_url||"");const resolution=article.image_resolution||{};const governmentResolved=resolution.status==="resolved"&&GOVERNMENT_IMAGE_PROVIDERS.has(resolution.provider)&&Boolean(article.image_source_url)&&(imageHost.includes("supabase.co")||sourceHost);const sourcedGovernmentImage=Boolean(article.image_caption&&article.image_source_url)&&["nasa.gov","isro.gov.in","noaa.gov","usgs.gov","pib.gov.in","usda.gov","nps.gov","cdc.gov","nih.gov"].some((domain)=>sourceHost===domain||sourceHost.endsWith(`.${domain}`));const preservedExisting=resolution.status==="preserved_existing"&&Boolean(article.image_source_url||article.image_caption);const reusableHost=imageHost==="upload.wikimedia.org"||imageHost==="commons.wikimedia.org"||sourceHost==="commons.wikimedia.org"||sourceHost.endsWith(".commons.wikimedia.org");const unsplashImage=imageHost==="images.unsplash.com"&&sourceHost.includes("unsplash.com")&&Boolean(article.image_caption);return governmentResolved||sourcedGovernmentImage||preservedExisting||unsplashImage||(reusableHost&&isStoredImageSemanticallyRelevant(article));}

// Cards should only reserve visual space for a real, sourced article image.
// The title-derived SVG remains available to article pages, but no longer makes
// image-less archive cards huge.
export function resolveCardImage(article={}){const storedImage=article.image||article.image_url||"";return isVerifiedReusableArticleImage(article)?storedImage:"";}
export function resolveDisplayImage(article={}){const cardImage=resolveCardImage(article);return cardImage||getArticleVisualUrl(article);}
