import { deadlineSignal, remainingDeadlineMs } from "@/lib/network/deadline";

export const TERMINAL_IMAGE_RESOLUTION_STATUSES = new Set(["resolved","no_safe_image","preserved_existing","rejected"]);
const PROVIDERS={
  wikimedia:{label:"Wikimedia Commons",usage:"wikimedia_commons_file_license",imageHosts:["upload.wikimedia.org","commons.wikimedia.org"]},
  openverse:{label:"Openverse",usage:"creative_commons_verified",imageHosts:["api.openverse.org","images.openverse.org"]},
  nasa:{label:"NASA",usage:"nasa_media_usage",search:(q)=>`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=10`,imageHosts:["images-assets.nasa.gov","nasa.gov"]},
};
function clean(value=""){return String(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();}
function hostname(value=""){try{return new URL(value).hostname.toLowerCase();}catch{return"";}}
function isProviderHost(url,provider){const host=hostname(url);return (PROVIDERS[provider]?.imageHosts||[]).some((allowed)=>host===allowed||host.endsWith(`.${allowed}`));}
function safeWikimediaLicense(value=""){const license=clean(value).toLowerCase();if(!license||/non.?commercial|no.?derivatives|all rights reserved|fair use/.test(license))return false;return /public domain|cc0|creative commons|cc by|cc-by|gfdl/.test(license);}
function safeOpenverseLicense(value=""){return /^(cc0|by|by-sa|pdm)$/i.test(clean(value));}
function unique(values=[]){return[...new Set(values.map(clean).filter(Boolean))];}
function datelinePlace(text=""){const raw=clean(text).match(/\b([A-Z][A-Z .'-]{2,30})\s*\|/)?.[1]?.trim()||"";return raw.split(/[-–]/)[0].trim().replace(/\bNEW DELHI\b/i,"New Delhi India").replace(/\bBISHKEK\b/i,"Bishkek Kyrgyzstan").replace(/\bKATHMANDU\b/i,"Kathmandu Nepal").replace(/\bKYIV\b/i,"Kyiv Ukraine").replace(/\bMUMBAI\b/i,"Mumbai India").replace(/\bPATNA\b/i,"Patna Bihar India").replace(/\bWASHINGTON\b/i,"Washington DC").replace(/\bBEIJING\b/i,"Beijing China");}
function imageQueries(article={}){
  const text=clean([article.title,article.why_news,article.content,article.static_foundation].filter(Boolean).join(" ")).slice(0,10000);const place=datelinePlace(text);let topic="";
  const rules=[
    [/Legal Metrology|Indian Standard Time|One Nation.One Time|NavIC/i,"NavIC Indian Regional Navigation Satellite System"],
    [/Access and Benefit.Sharing|Nagoya|biodiversity.*benefit/i,"biodiversity India conservation"],
    [/Rangeen Machhli|Lakshadweep.*fish|fisheries|Blue Economy/i,"Lakshadweep fisheries India"],
    [/Per Drop More Crop|micro.?irrigation|drip irrigation/i,"drip irrigation India agriculture"],
    [/higher education|universit|Gross Enrolment Ratio|NEP 2035/i,"Indian university students higher education"],
    [/nuclear energy|nuclear power|reactor|100 GW/i,"India nuclear power plant reactor"],
    [/Jan Dhan|financial inclusion|bank account|JAM architecture/i,"Pradhan Mantri Jan Dhan Yojana banking India"],
    [/Animal Disease Control|FMD vaccine|livestock biosecurity/i,"India livestock cattle vaccination"],
    [/e-Shram|unorganised worker|social.security architecture/i,"Indian workers labour"],
    [/Regenerative Agriculture|natural farmers|Soil Health Card/i,"natural farming India agriculture"],
    [/Makhana|fox nut/i,"makhana fox nuts Bihar India"],
    [/PM-AASHA|MSP reform|pulses.*oilseeds/i,"Indian farmers pulses procurement"],
    [/OBC Creamy Layer|creamy layer|substantive equality/i,"Supreme Court of India"],
    [/Typhoid|TCV|antimicrobial resistance/i,"typhoid vaccine"],
    [/treated wastewater|wastewater reuse|circular water/i,"wastewater treatment plant India"],
    [/Assam Flood|Brahmaputra.*flood/i,"Assam floods Brahmaputra"],
    [/Positive Indigenisation|defence items|military.industrial/i,"Indian defence manufacturing"],
    [/UNCCD|land degraded|drought resilience/i,"desertification drought land degradation"],
    [/Indo.German Environment Forum|India.Germany.*environment/i,"India Germany environment cooperation"],
    [/Shanghai Cooperation Organisation|\bSCO\b|Modi.*Putin|Putin.*Modi/i,"Shanghai Cooperation Organisation summit"],
    [/Hybrid Annuity Model|freight railway|Indian Railways/i,"Indian Railways freight train"],
    [/hanging glacier|Alaknanda|Himalayan glacier/i,"Himalayan glacier India"],
    [/Aditya.L1|solar flare|space weather/i,"Aditya L1 ISRO Sun"],
    [/Most.Favoured Nation|investment treat|investor protection/i,"India investment treaty"],
    [/Nistar|Nipun|Diving Support Vessel|deep-sea rescue/i,"Indian Navy diving support vessel"],
    [/Sone River|Son River|water sharing.*Bihar|Bihar.*Jharkhand.*river/i,"Son River Bihar India"],
    [/winter pollution|AI-enabled cameras|air quality|Delhi.*pollution/i,"Delhi air pollution smog"],
    [/Nepal.*hydropower|hydropower.*Nepal|Himalayan hydropower/i,"Nepal hydropower dam"],
    [/Ukraine.*air-defen|air-defen.*Ukraine|Russian air attacks.*Kyiv/i,"Kyiv Ukraine"],
    [/COSCO|shipping giant|signals intelligence.*shipping/i,"COSCO container ship"],
    [/critical minerals|G20 finance|trade.*China.*G20/i,"G20 finance meeting"],
    [/GDP|gross value added|manufacturing grew|economy expanded/i,"India manufacturing industry"],
    [/food-safety|expiry dates|Navi Mumbai industrial|packaged food/i,"Navi Mumbai Maharashtra"],
    [/cyclone|hurricane|typhoon/i,"tropical cyclone"],
    [/space|satellite|rocket|mission|ISRO/i,"ISRO space mission"]
  ];
  for(const[pattern,value]of rules){if(pattern.test(text)){topic=value;break;}}
  if(!topic){const title=clean(article.title).replace(/\b(2025|2026|2027)\b/g,"").replace(/[:;|].*$/,"").trim();topic=title||clean(article.category);}
  const fallback=place&& !topic.toLowerCase().includes(place.toLowerCase().split(" ")[0])?place:clean(article.category);
  return unique([topic,fallback]).slice(0,2).map((q)=>q.slice(0,110));
}
export function isTerminalImageResolution(value){return Boolean(value&&TERMINAL_IMAGE_RESOLUTION_STATUSES.has(value.status));}
export function governmentImageProviderPriority(category=""){const value=String(category).toLowerCase();if(/space|science/.test(value))return["wikimedia","nasa","openverse"];return["wikimedia","openverse"];}
function terminal(status,provider,requestsUsed,extra={}){return{status,provider:provider||"currentpulse_fallback",attempted_at:new Date().toISOString(),requests_used:requestsUsed,attribution:extra.attribution||"",license_or_usage:extra.license_or_usage||"",source_page_url:extra.source_page_url||"",search_query:extra.search_query||""};}
function tokenSet(value=""){return new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter((v)=>v.length>2&&!/^(india|indian|news|current|affairs|today|year)$/.test(v)));}
function relevanceScore(query,...values){const q=tokenSet(query);if(!q.size)return 0;const hay=tokenSet(values.join(" "));let score=0;for(const token of q)if(hay.has(token))score+=1;return score;}
function nasaCandidate(payload,query){let best=null;for(const item of payload?.collection?.items||[]){const link=(item.links||[]).find((candidate)=>candidate?.rel==="preview"&&isProviderHost(candidate.href,"nasa"));if(!link)continue;const data=item.data?.[0]||{};const title=clean(data.title);const description=clean(data.description);const score=relevanceScore(query,title,description);if(!best||score>best.score)best={score,url:link.href,sourcePageUrl:item.href||"",attribution:["NASA",title].filter(Boolean).join(" · ").slice(0,500),licenseOrUsage:PROVIDERS.nasa.usage,alt:title||description,storagePolicy:"hotlink"};}return best;}
function wikimediaCandidate(payload,query){let best=null;for(const page of Object.values(payload?.query?.pages||{})){const info=page?.imageinfo?.[0];const meta=info?.extmetadata||{};const url=info?.thumburl||info?.url||"";const sourcePageUrl=info?.descriptionurl||page?.canonicalurl||"";if(!url||!sourcePageUrl||!isProviderHost(url,"wikimedia")||!isProviderHost(sourcePageUrl,"wikimedia"))continue;const license=clean(meta.LicenseShortName?.value||meta.UsageTerms?.value||"");if(!safeWikimediaLicense(license))continue;const artist=clean(meta.Artist?.value||meta.Credit?.value||"");const title=clean(meta.ObjectName?.value||page?.title?.replace(/^File:/i,"")||"");const description=clean(meta.ImageDescription?.value||"");if(/logo|icon|coat of arms|flag of/i.test(`${title} ${description}`)&&!/flag|logo/i.test(query))continue;const score=relevanceScore(query,title,description)+(/\.jpe?g|\.png/i.test(url)?0.3:0);const candidate={score,url,sourcePageUrl,attribution:[title,artist,license,"Wikimedia Commons"].filter(Boolean).join(" · ").slice(0,700),licenseOrUsage:license,alt:description||title,storagePolicy:"hotlink"};if(!best||score>best.score)best=candidate;}return best;}
function openverseCandidate(payload,query){let best=null;for(const item of payload?.results||[]){const license=clean(item?.license||"");if(!safeOpenverseLicense(license))continue;const url=clean(item?.thumbnail||item?.url||"");const sourcePageUrl=clean(item?.foreign_landing_url||item?.detail_url||"");if(!url||!sourcePageUrl)continue;const title=clean(item?.title||"");const creator=clean(item?.creator||"");if(/logo|icon|illustration|vector/i.test(title)&&!/logo|illustration/i.test(query))continue;const score=relevanceScore(query,title,item?.tags?.map?.((t)=>t?.name).join(" ")||"");const licenseLabel=[license,item?.license_version].filter(Boolean).join(" ");const candidate={score,url,sourcePageUrl,attribution:[title,creator,licenseLabel,"via Openverse"].filter(Boolean).join(" · ").slice(0,700),licenseOrUsage:licenseLabel,alt:title||query,storagePolicy:"hotlink"};if(!best||score>best.score)best=candidate;}return best;}
async function searchWikimedia(query,options){const signal=deadlineSignal(options.deadlineAt,5500);if(!signal)return null;const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:"12",prop:"imageinfo|info",iiprop:"url|extmetadata",iiurlwidth:"1000",inprop:"url",format:"json",origin:"*"});const response=await(options.fetch||fetch)(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 Wikimedia image resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return wikimediaCandidate(await response.json(),query);}
async function searchOpenverse(query,options){const signal=deadlineSignal(options.deadlineAt,5500);if(!signal)return null;const params=new URLSearchParams({q:query,page_size:"12",mature:"false"});const response=await(options.fetch||fetch)(`https://api.openverse.org/v1/images/?${params}`,{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 free-media resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return openverseCandidate(await response.json(),query);}
async function searchNASA(query,options){const signal=deadlineSignal(options.deadlineAt,5500);if(!signal)return null;const response=await(options.fetch||fetch)(PROVIDERS.nasa.search(query),{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 NASA media resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return nasaCandidate(await response.json(),query);}
export async function resolveGovernmentArticleImage(article={},options={}){
  const existing=article.image_resolution;if(isTerminalImageResolution(existing))return{image:null,resolution:existing,searched:false};if(options.preserveExisting)return{image:null,resolution:terminal("preserved_existing","existing",0,{attribution:article.image_caption,source_page_url:article.image_source_url}),searched:false};
  const queries=imageQueries(article);const primary=queries[0]||clean(article.title);let requestsUsed=0;const attempts=[];
  const add=(provider,query,fn)=>attempts.push({provider,query,fn});
  add("wikimedia",primary,searchWikimedia);
  if(/space|science|nuclear|solar|satellite/i.test(`${article.category||""} ${primary}`))add("nasa",primary,searchNASA);else add("openverse",primary,searchOpenverse);
  if(queries[1])add("wikimedia",queries[1],searchWikimedia);else if(!attempts.some((a)=>a.provider==="openverse"))add("openverse",primary,searchOpenverse);
  for(const attempt of attempts.slice(0,3)){if(!remainingDeadlineMs(options.deadlineAt,900))break;requestsUsed+=1;try{const candidate=await attempt.fn(attempt.query,options);if(candidate&&candidate.score>=0.8)return{image:candidate,searched:true,query:attempt.query,resolution:terminal("resolved",attempt.provider,requestsUsed,{attribution:candidate.attribution,license_or_usage:candidate.licenseOrUsage,source_page_url:candidate.sourcePageUrl,search_query:attempt.query})};}catch(error){console.error(`[Image resolver] ${attempt.provider} request failed:`,error?.message||error);}}
  return{image:null,searched:requestsUsed>0,query:primary,resolution:terminal("no_safe_image","multi_source",requestsUsed,{license_or_usage:"no_verified_reusable_image",search_query:primary})};
}
