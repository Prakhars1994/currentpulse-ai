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
function imageQueries(article={}){
  const title=clean(article.title);const body=clean([article.why_news,article.content].filter(Boolean).join(" ")).slice(0,5000);let topic="";
  const rules=[
    [/Legal Metrology|Indian Standard Time|One Nation.One Time|NavIC/i,"NavIC satellite navigation India"],
    [/Access and Benefit.Sharing|Nagoya|biodiversity/i,"biodiversity conservation India"],
    [/Rangeen Machhli|Lakshadweep.*fish|fisheries|Blue Economy/i,"Lakshadweep fisheries fish India"],
    [/Per Drop More Crop|micro.?irrigation|drip irrigation/i,"drip irrigation agriculture India"],
    [/higher education|universit|Gross Enrolment Ratio|NEP 2035/i,"university students India higher education"],
    [/nuclear energy|nuclear power|reactor|100 GW/i,"nuclear power plant India"],
    [/Jan Dhan|financial inclusion|JAM architecture/i,"Pradhan Mantri Jan Dhan Yojana bank India"],
    [/Animal Disease Control|FMD vaccine|livestock biosecurity/i,"cattle vaccination livestock India"],
    [/e-Shram|unorganised worker|social.security architecture/i,"workers labour India"],
    [/Regenerative Agriculture|natural farmers|Soil Health Card/i,"natural farming agriculture India"],
    [/Makhana|fox nut/i,"Euryale ferox makhana fox nut"],
    [/PM-AASHA|MSP reform|pulses.*oilseeds/i,"pulses farmers agriculture India"],
    [/OBC Creamy Layer|creamy layer|substantive equality/i,"Supreme Court India building"],
    [/Typhoid|TCV|antimicrobial resistance/i,"typhoid vaccine vaccination"],
    [/treated wastewater|wastewater reuse|circular water/i,"wastewater treatment plant"],
    [/Assam Flood|Brahmaputra.*flood/i,"Brahmaputra Assam flood"],
    [/Positive Indigenisation|defence items|military.industrial/i,"defence manufacturing India"],
    [/UNCCD|land degraded|drought resilience/i,"land degradation drought desertification"],
    [/Indo.German Environment Forum|India.Germany.*environment/i,"India Germany environment meeting"],
    [/Shanghai Cooperation Organisation|\bSCO\b|Modi.*Putin|Putin.*Modi/i,"Shanghai Cooperation Organisation summit"],
    [/Hybrid Annuity Model|freight railway|Indian Railways/i,"Indian Railways freight train"],
    [/hanging glacier|Alaknanda|Himalayan glacier/i,"Himalayan glacier Alaknanda"],
    [/Aditya.L1|solar flare|space weather/i,"Aditya L1 ISRO Sun"],
    [/Most.Favoured Nation|investment treat|investor protection/i,"India international investment treaty"],
    [/Fasal Bima|crop insurance/i,"crop insurance farmers India"],
    [/India.Japan|Japan.*India|semiconductor.*Japan/i,"India Japan leaders meeting"],
    [/India.Chile|Chile.*India|copper.*lithium/i,"India Chile diplomacy"],
    [/fertilizer|AgriStack|DBT.*buyers/i,"fertilizer agriculture India"],
    [/GDP|manufacturing recovery|economy.*7\.8/i,"manufacturing industry India"],
    [/ONGC|deepwater|petroleum reserve/i,"ONGC offshore oil India"],
    [/Foreign Portfolio|portfolio flow|rupee support/i,"Bombay Stock Exchange India"],
    [/Magnetar|quantum nature.*space/i,"magnetar neutron star"],
    [/Nistar|Nipun|Diving Support Vessel|deep-sea rescue/i,"Indian Navy diving support vessel"],
    [/Sone River|Son River|water sharing.*Bihar/i,"Son River Bihar India"],
    [/winter pollution|AI cameras|Delhi.*pollution/i,"Delhi air pollution smog"],
    [/Nepal.*hydropower|hydropower.*Nepal/i,"Nepal hydropower dam"],
    [/Ukraine.*air.defen|Russian air strikes.*Kyiv/i,"Kyiv Ukraine"],
    [/COSCO|signals intelligence.*shipping/i,"COSCO container ship"],
    [/critical minerals|G20 finance|trade.*China.*G20/i,"G20 finance meeting"],
    [/food.safety|expiry dates|Navi Mumbai/i,"Navi Mumbai Maharashtra"],
  ];
  for(const[pattern,value]of rules){if(pattern.test(title)){topic=value;break;}}
  if(!topic){for(const[pattern,value]of rules){if(pattern.test(body)){topic=value;break;}}}
  if(!topic)topic=title.replace(/\b(2025|2026|2027)\b/g,"").replace(/[:;|].*$/,"").trim();
  return [topic.slice(0,110)].filter(Boolean);
}
export function isTerminalImageResolution(value){return Boolean(value&&TERMINAL_IMAGE_RESOLUTION_STATUSES.has(value.status));}
export function governmentImageProviderPriority(category=""){const value=String(category).toLowerCase();if(/space|astronomy/.test(value))return["wikimedia","nasa"];return["wikimedia","openverse"];}
function terminal(status,provider,requestsUsed,extra={}){return{status,provider:provider||"currentpulse_fallback",attempted_at:new Date().toISOString(),requests_used:requestsUsed,attribution:extra.attribution||"",license_or_usage:extra.license_or_usage||"",source_page_url:extra.source_page_url||"",search_query:extra.search_query||""};}
function tokenSet(value=""){return new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter((v)=>v.length>2&&!/^(india|indian|news|current|affairs|today|year)$/.test(v)));}
function relevanceScore(query,...values){const q=tokenSet(query);if(!q.size)return 0;const hay=tokenSet(values.join(" "));let score=0;for(const token of q)if(hay.has(token))score+=1;return score;}
function nasaCandidate(payload,query){let best=null;for(const item of payload?.collection?.items||[]){const link=(item.links||[]).find((candidate)=>candidate?.rel==="preview"&&isProviderHost(candidate.href,"nasa"));if(!link)continue;const data=item.data?.[0]||{};const title=clean(data.title);const description=clean(data.description);const score=relevanceScore(query,title,description);if(!best||score>best.score)best={score,url:link.href,sourcePageUrl:item.href||"",attribution:["NASA",title].filter(Boolean).join(" · ").slice(0,500),licenseOrUsage:PROVIDERS.nasa.usage,alt:title||description,storagePolicy:"hotlink"};}return best;}
function wikimediaCandidate(payload,query){let best=null;for(const page of Object.values(payload?.query?.pages||{})){const info=page?.imageinfo?.[0];const meta=info?.extmetadata||{};const url=info?.thumburl||info?.url||"";const sourcePageUrl=info?.descriptionurl||page?.canonicalurl||"";if(!url||!sourcePageUrl||!isProviderHost(url,"wikimedia")||!isProviderHost(sourcePageUrl,"wikimedia"))continue;const license=clean(meta.LicenseShortName?.value||meta.UsageTerms?.value||"");if(!safeWikimediaLicense(license))continue;const artist=clean(meta.Artist?.value||meta.Credit?.value||"");const title=clean(meta.ObjectName?.value||page?.title?.replace(/^File:/i,"")||"");const description=clean(meta.ImageDescription?.value||"");if(/logo|icon|coat of arms|flag of/i.test(`${title} ${description}`)&&!/flag|logo/i.test(query))continue;const score=relevanceScore(query,title,description)+(/\.jpe?g|\.png/i.test(url)?0.3:0);const candidate={score,url,sourcePageUrl,attribution:[title,artist,license,"Wikimedia Commons"].filter(Boolean).join(" · ").slice(0,700),licenseOrUsage:license,alt:description||title,storagePolicy:"hotlink"};if(!best||score>best.score)best=candidate;}return best;}
function openverseCandidate(payload,query){let best=null;for(const item of payload?.results||[]){const license=clean(item?.license||"");if(!safeOpenverseLicense(license))continue;const url=clean(item?.thumbnail||item?.url||"");const sourcePageUrl=clean(item?.foreign_landing_url||item?.detail_url||"");if(!url||!sourcePageUrl)continue;const title=clean(item?.title||"");const creator=clean(item?.creator||"");if(/logo|icon|illustration|vector/i.test(title)&&!/logo|illustration/i.test(query))continue;const score=relevanceScore(query,title,item?.tags?.map?.((t)=>t?.name).join(" ")||"");const licenseLabel=[license,item?.license_version].filter(Boolean).join(" ");const candidate={score,url,sourcePageUrl,attribution:[title,creator,licenseLabel,"via Openverse"].filter(Boolean).join(" · ").slice(0,700),licenseOrUsage:licenseLabel,alt:title||query,storagePolicy:"hotlink"};if(!best||score>best.score)best=candidate;}return best;}
async function searchWikimedia(query,options){const signal=deadlineSignal(options.deadlineAt,5000);if(!signal)return null;const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:"12",prop:"imageinfo|info",iiprop:"url|extmetadata",iiurlwidth:"1000",inprop:"url",format:"json",origin:"*"});const response=await(options.fetch||fetch)(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 Wikimedia image resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return wikimediaCandidate(await response.json(),query);}
async function searchOpenverse(query,options){const signal=deadlineSignal(options.deadlineAt,5000);if(!signal)return null;const params=new URLSearchParams({q:query,page_size:"12",mature:"false"});const response=await(options.fetch||fetch)(`https://api.openverse.org/v1/images/?${params}`,{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 free-media resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return openverseCandidate(await response.json(),query);}
async function searchNASA(query,options){const signal=deadlineSignal(options.deadlineAt,5000);if(!signal)return null;const response=await(options.fetch||fetch)(PROVIDERS.nasa.search(query),{headers:{Accept:"application/json","User-Agent":"CurrentPulse/1.0 NASA media resolver"},cache:"force-cache",next:{revalidate:604800},signal});if(!response.ok)return null;return nasaCandidate(await response.json(),query);}
export async function resolveGovernmentArticleImage(article={},options={}){
  const existing=article.image_resolution;if(isTerminalImageResolution(existing))return{image:null,resolution:existing,searched:false};if(options.preserveExisting)return{image:null,resolution:terminal("preserved_existing","existing",0,{attribution:article.image_caption,source_page_url:article.image_source_url}),searched:false};
  const primary=imageQueries(article)[0]||clean(article.title);let requestsUsed=0;
  const attempts=[{provider:"wikimedia",fn:searchWikimedia}];
  if(/space|astronomy|aditya|magnetar|satellite/i.test(`${article.category||""} ${primary}`))attempts.push({provider:"nasa",fn:searchNASA});else attempts.push({provider:"openverse",fn:searchOpenverse});
  for(const attempt of attempts){if(!remainingDeadlineMs(options.deadlineAt,900))break;requestsUsed+=1;try{const candidate=await attempt.fn(primary,options);if(candidate&&candidate.score>=0.8)return{image:candidate,searched:true,query:primary,resolution:terminal("resolved",attempt.provider,requestsUsed,{attribution:candidate.attribution,license_or_usage:candidate.licenseOrUsage,source_page_url:candidate.sourcePageUrl,search_query:primary})};}catch(error){console.error(`[Image resolver] ${attempt.provider} request failed:`,error?.message||error);}}
  return{image:null,searched:requestsUsed>0,query:primary,resolution:terminal("no_safe_image","multi_source",requestsUsed,{license_or_usage:"no_verified_reusable_image",search_query:primary})};
}
