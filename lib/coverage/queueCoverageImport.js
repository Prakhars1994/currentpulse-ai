import { createServerSupabase } from "@/lib/supabase-server";
import { fetchVisionTopics } from "@/lib/coverage/adapters/vision";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";
import { fetchInsightsTopics } from "@/lib/coverage/adapters/insights";
import { fetchForumTopics } from "@/lib/coverage/adapters/forum";
import { fetchNextIasTopics } from "@/lib/coverage/adapters/nextias";
import { fetchVajiramTopics } from "@/lib/coverage/adapters/vajiram";
import { fetchIasBabaTopics } from "@/lib/coverage/adapters/iasbaba";
import { fetchGkTodayTopics } from "@/lib/coverage/adapters/gktoday";
import {
  fetchBankersAddaTopics,
  fetchOliveboardTopics,
  fetchAffairsCloudTopics,
  fetchTestbookCurrentAffairsTopics,
} from "@/lib/coverage/adapters/examCoaching";
import { mergeCoverageTopics } from "@/lib/coverage/duplicateDetector";
import {
  getCoverageSourceReferences,
  recordArticleSources,
} from "@/lib/coverage/sourceRegistry";
import {
  buildCoverageSummary,
  topicWithCoverageSources,
  toCoveragePublishingSource,
} from "@/lib/coverage/coveragePayload";
import {
  findDuplicateInArticles,
  loadRecentArticles,
} from "@/lib/news/duplicateRepository";
import { isCoverageNoiseTitle } from "@/lib/coverage/noiseFilter";
import { correctTaxonomy } from "@/lib/contentTaxonomy";
import { cleanTrustedCoverageText } from "@/lib/coverage/contentCleaner";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";
import {
  publishArticle,
  enrichPublishedArticle,
} from "@/lib/publisher/publishArticle";
import { isSameEvent } from "@/lib/news/eventCluster";

const SOURCE_ADAPTERS = {
  vision: fetchVisionTopics,
  drishti: fetchDrishtiTopics,
  insights: fetchInsightsTopics,
  forum: fetchForumTopics,
  nextias: fetchNextIasTopics,
  vajiram: fetchVajiramTopics,
  iasbaba: fetchIasBabaTopics,
  gktoday: fetchGkTodayTopics,
  bankersadda: fetchBankersAddaTopics,
  oliveboard: fetchOliveboardTopics,
  affairscloud: fetchAffairsCloudTopics,
  testbook: fetchTestbookCurrentAffairsTopics,
};

const IMMEDIATE_PUBLISH_CONCURRENCY = 2;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

const IMMEDIATE_PUBLISH_MAX_PER_RUN = boundedInteger(
  process.env.COVERAGE_IMMEDIATE_MAX_PER_RUN,
  10,
  1,
  20
);

const IMMEDIATE_PUBLISH_BUDGET_MS = boundedInteger(
  process.env.COVERAGE_IMMEDIATE_PUBLISH_BUDGET_MS,
  150000,
  60000,
  220000
);

export const COVERAGE_SOURCE_IDS = Object.freeze(Object.keys(SOURCE_ADAPTERS));

function interleaveTopics(...groups) {
  const output = [];
  const maximumLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maximumLength; index += 1) {
    for (const group of groups) {
      if (group[index]) output.push(group[index]);
    }
  }

  return output;
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await handler(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function fetchCoverageSources(requestedSourceIds) {
  const selectedIds = new Set(requestedSourceIds);
  const entries = Object.entries(SOURCE_ADAPTERS).filter(([sourceId]) =>
    selectedIds.has(sourceId)
  );
  const settled = await Promise.allSettled(
    entries.map(([, fetchTopics]) => fetchTopics())
  );
  const groups = [];
  const counts = {};
  const errors = {};

  settled.forEach((result, index) => {
    const sourceId = entries[index][0];

    if (result.status === "fulfilled") {
      const topics = Array.isArray(result.value) ? result.value : [];
      groups.push(topics);
      counts[sourceId] = topics.length;
      return;
    }

    groups.push([]);
    counts[sourceId] = 0;
    errors[sourceId] = result.reason?.message || "Source fetch failed.";
    console.error(`[Coverage queue] ${sourceId} failed:`, errors[sourceId]);
  });

  return { groups, counts, errors };
}

function mergeReferences(...groups) {
  return getCoverageSourceReferences({
    sourceInputs: groups.flat().filter(Boolean),
  });
}

function queuedTopicPayload(topic, references, duplicate) {
  const prepared = topicWithCoverageSources(topic, references);

  return {
    title: prepared.title,
    description: prepared.summary,
    url: references[0]?.sourceUrl || prepared.url,
    source: references.map((reference) => reference.sourceName).join(", "),
    source_domain: "trusted-coaching-coverage",
    image_url: prepared.imageUrl || null,
    published_at: prepared.publishedAt || null,
    importance: 10,
    category: prepared.category || "Polity & Governance",
    paper: prepared.paper || "Prelims",
    evaluation_reason: `Trusted coaching coverage from ${references.length} source${references.length === 1 ? "" : "s"}.`,
    keywords: Array.isArray(prepared.keywords) ? prepared.keywords : [],
    status: "pending",
    pipeline_kind: duplicate ? "coaching_enrichment" : "coaching",
    coverage_event_key: prepared.eventKey,
    coverage_sources: references,
    target_article_id: duplicate?.id || null,
    error: null,
    processing_started_at: null,
    processed_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function loadCoverageState(supabase, recentArticles) {
  const [sourceResult, queueResult] = await Promise.all([
    supabase
      .from("article_sources")
      .select("article_id,source_key")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("article_queue")
      .select(
        "id,title,description,published_at,pipeline_kind,status,attempts,coverage_event_key,coverage_sources,target_article_id"
      )
      .in("pipeline_kind", ["coaching", "coaching_enrichment"])
      .not("coverage_event_key", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (sourceResult.error) {
    throw new Error(
      `Coverage source lookup failed: ${sourceResult.error.message}. Run the CurrentPulse coverage queue migration in Supabase.`
    );
  }
  if (queueResult.error) {
    throw new Error(
      `Coverage queue lookup failed: ${queueResult.error.message}. Run the CurrentPulse coverage queue migration in Supabase.`
    );
  }

  const knownSourcesByArticle = new Map();
  for (const row of sourceResult.data || []) {
    if (!knownSourcesByArticle.has(row.article_id)) {
      knownSourcesByArticle.set(row.article_id, new Set());
    }
    knownSourcesByArticle.get(row.article_id).add(row.source_key);
  }

  const queueByEvent = new Map();
  for (const row of queueResult.data || []) {
    if (!queueByEvent.has(row.coverage_event_key)) {
      queueByEvent.set(row.coverage_event_key, row);
    }
  }

  return {
    recentArticles,
    knownSourcesByArticle,
    queueByEvent,
    queueRows: queueResult.data || [],
  };
}

async function persistCoverageCandidate(supabase, candidate, state) {
  const { queueByEvent, queueRows } = state;
  const existing = queueByEvent.get(candidate.topic.eventKey) || queueRows.find((row) =>
    isSameEvent(
      {
        title: candidate.topic.title,
        description: candidate.topic.summary,
        publishedAt: candidate.topic.publishedAt,
      },
      {
        title: row.title,
        description: row.description,
        publishedAt: row.published_at,
      }
    )
  );
  const existingReferences = Array.isArray(existing?.coverage_sources)
    ? existing.coverage_sources
    : [];
  const references = mergeReferences(existingReferences, candidate.references);

  if (existing) {
    const existingKeys = new Set(
      existingReferences.map((reference) => reference.sourceKey).filter(Boolean)
    );
    const hasNewSource = references.some(
      (reference) => !existingKeys.has(reference.sourceKey)
    );

    if (
      !hasNewSource &&
      ["pending", "processing"].includes(existing.status) &&
      Number(existing.target_article_id || 0) === Number(candidate.duplicate?.id || 0)
    ) {
      return {
        status: "already_queued",
        title: candidate.topic.title,
        queueId: existing.id,
      };
    }

    const payload = queuedTopicPayload(
      candidate.topic,
      references,
      candidate.duplicate
    );
    const values = existing.status === "processing"
      ? {
          description: buildCoverageSummary(references),
          source: payload.source,
          coverage_sources: references,
          target_article_id: payload.target_article_id,
          updated_at: payload.updated_at,
        }
      : {
          ...payload,
          attempts: 0,
        };
    const { error } = await supabase
      .from("article_queue")
      .update(values)
      .eq("id", existing.id);

    if (error) throw new Error(`Coverage queue update failed: ${error.message}`);
    queueByEvent.set(candidate.topic.eventKey, { ...existing, ...values });
    const rowIndex = queueRows.findIndex((row) => row.id === existing.id);
    if (rowIndex >= 0) queueRows[rowIndex] = { ...existing, ...values };
    return {
      status: "queue_updated",
      title: candidate.topic.title,
      queueId: existing.id,
      sourceCount: references.length,
    };
  }

  const payload = queuedTopicPayload(
    candidate.topic,
    candidate.references,
    candidate.duplicate
  );
  const { data, error } = await supabase
    .from("article_queue")
    .insert([payload])
    .select("id,status")
    .single();

  if (error?.code === "23505") {
    return {
      status: "already_queued",
      title: candidate.topic.title,
      reason: "Concurrent coverage collector already queued this event.",
    };
  }
  if (error) throw new Error(`Coverage queue insert failed: ${error.message}`);

  queueByEvent.set(candidate.topic.eventKey, {
    id: data.id,
    ...payload,
  });
  queueRows.unshift({ id: data.id, ...payload });
  return {
    status: "queued",
    title: candidate.topic.title,
    queueId: data.id,
    sourceCount: candidate.references.length,
    targetArticleId: candidate.duplicate?.id || null,
  };
}

function findCoverageQueueRow(candidate, state) {
  const { queueByEvent, queueRows } = state;

  return (
    queueByEvent.get(candidate.topic.eventKey) ||
    queueRows.find((row) =>
      isSameEvent(
        {
          title: candidate.topic.title,
          description: candidate.topic.summary,
          publishedAt: candidate.topic.publishedAt,
        },
        {
          title: row.title,
          description: row.description,
          publishedAt: row.published_at,
        }
      )
    ) ||
    null
  );
}

function immediateCoverageReferences(candidate, state) {
  const existing = findCoverageQueueRow(candidate, state);
  const queuedReferences = Array.isArray(existing?.coverage_sources)
    ? existing.coverage_sources
    : [];

  return mergeReferences(
    queuedReferences,
    candidate.references
  );
}

async function markCoverageQueuePublished(
  supabase,
  candidate,
  state,
  articleId,
  references
) {
  const existing = findCoverageQueueRow(candidate, state);

  if (!existing?.id) return;

  const now = new Date().toISOString();

  const values = {
    status: "published",
    article_id: articleId,
    target_article_id: articleId,
    coverage_sources: references,
    processing_started_at: null,
    processed_at: now,
    updated_at: now,
    error: null,
  };

  const { error } = await supabase
    .from("article_queue")
    .update(values)
    .eq("id", existing.id);

  if (error) {
    console.warn(
      `[Coverage immediate] Article ${articleId} published, but queue cleanup failed: ${error.message}`
    );
    return;
  }

  const nextRow = {
    ...existing,
    ...values,
  };

  state.queueByEvent.set(
    candidate.topic.eventKey,
    nextRow
  );

  const rowIndex = state.queueRows.findIndex(
    (row) => row.id === existing.id
  );

  if (rowIndex >= 0) {
    state.queueRows[rowIndex] = nextRow;
  }
}

async function publishCoverageCandidate(
  supabase,
  candidate,
  state
) {
  const references = immediateCoverageReferences(
    candidate,
    state
  );

  const preparedTopic = topicWithCoverageSources(
    candidate.topic,
    references
  );

  const sourceItem = toCoveragePublishingSource(
    preparedTopic
  );

  let publication;
  let enrichedExisting = false;

  if (candidate.duplicate?.id) {
    publication = await enrichPublishedArticle(
      supabase,
      candidate.duplicate.id,
      sourceItem
    );

    enrichedExisting = true;
  } else {
    publication = await publishArticle(
      supabase,
      sourceItem
    );

    if (publication.status === "duplicate") {
      publication = await enrichPublishedArticle(
        supabase,
        publication.articleId,
        sourceItem
      );

      enrichedExisting = true;
    }
  }

  await recordArticleSources(
    supabase,
    publication.articleId,
    preparedTopic
  );

  await markCoverageQueuePublished(
    supabase,
    candidate,
    state,
    publication.articleId,
    references
  );

  return {
    status: enrichedExisting
      ? "enriched_immediate"
      : "published_immediate",
    publisherStatus: publication.status,
    title: publication.title || candidate.topic.title,
    articleId: publication.articleId,
    slug: publication.slug || null,
    sourceCount: references.length,
  };
}

export async function queueCoverageImport({
  requestedSource = "all",
  requestedSources = null,
  maxCandidates = null,
} = {}) {
  const startedAt = Date.now();

  const selectedSourceIds = Array.isArray(requestedSources) && requestedSources.length
    ? [...new Set(requestedSources.map((value) => String(value || "").trim()).filter(Boolean))]
    : requestedSource === "all"
      ? [...COVERAGE_SOURCE_IDS]
      : [requestedSource];
  const invalidSource = selectedSourceIds.find((sourceId) => !SOURCE_ADAPTERS[sourceId]);
  if (invalidSource || selectedSourceIds.length === 0) {
    throw new Error(
      `Invalid source. Use all or one of: ${COVERAGE_SOURCE_IDS.join(", ")}.`
    );
  }

  const supabase = createServerSupabase();
  const [coverage, recentArticles] = await Promise.all([
    fetchCoverageSources(selectedSourceIds),
    loadRecentArticles(supabase, { lookbackDays: 21, limit: 500 }),
  ]);
  const sourceTopics = interleaveTopics(...coverage.groups);
  const sanitizedTopics = [];
  const results = [];

  for (const sourceTopic of sourceTopics) {
    const cleanedTopic = {
      ...sourceTopic,
      summary: cleanTrustedCoverageText(
        sourceTopic.summary || sourceTopic.description || sourceTopic.content || ""
      ),
    };
    const sourceInspection = inspectCoverageCandidate(cleanedTopic);
    if (!sourceInspection.accepted) {
      results.push({
        status: "noise_rejected",
        title: cleanedTopic.title,
        reason: sourceInspection.reason,
        sourceFlags: sourceInspection.flags,
        eventness: 0,
      });
      continue;
    }
    if (isCoverageNoiseTitle(cleanedTopic.title)) {
      results.push({
        status: "noise_rejected",
        title: cleanedTopic.title,
        reason: "Publisher navigation, generic taxonomy wrapper or non-article page.",
        eventness: 0,
      });
      continue;
    }
    const taxonomy = correctTaxonomy(
      `${cleanedTopic.title || ""} ${cleanedTopic.summary || ""}`,
      cleanedTopic.category,
      cleanedTopic.paper
    );
    sanitizedTopics.push({
      ...cleanedTopic,
      category: taxonomy.category,
      paper: taxonomy.paper,
    });
  }

  const topics = mergeCoverageTopics(sanitizedTopics);
  const state = await loadCoverageState(supabase, recentArticles);
  const candidates = [];
  const candidateTopics = Number.isFinite(Number(maxCandidates)) && Number(maxCandidates) > 0
    ? topics.slice(0, Number(maxCandidates))
    : topics;

  for (const originalTopic of candidateTopics) {
    const sourceInspection = inspectCoverageCandidate(originalTopic);
    if (!sourceInspection.accepted) {
      results.push({
        status: "noise_rejected",
        title: originalTopic.title,
        reason: sourceInspection.reason,
        sourceFlags: sourceInspection.flags,
        eventness: 0,
      });
      continue;
    }
    if (isCoverageNoiseTitle(originalTopic.title)) {
      results.push({
        status: "noise_rejected",
        title: originalTopic.title,
        reason: "Publisher navigation, generic wrapper or non-article page.",
      });
      continue;
    }
    const duplicate = findDuplicateInArticles(
      {
        title: originalTopic.title,
        description: originalTopic.summary,
        publishedAt: originalTopic.publishedAt,
      },
      state.recentArticles
    );
    const knownKeys = duplicate
      ? state.knownSourcesByArticle.get(duplicate.id) || new Set()
      : new Set();
    const references = getCoverageSourceReferences(originalTopic).filter(
      (reference) => !knownKeys.has(reference.sourceKey)
    );

    if (references.length === 0) {
      results.push({
        status: "already_merged",
        title: originalTopic.title,
        articleId: duplicate?.id || null,
      });
      continue;
    }

    candidates.push({
      topic: topicWithCoverageSources(originalTopic, references),
      references,
      duplicate,
    });
  }

  const processedResults = await mapWithConcurrency(
    candidates,
    IMMEDIATE_PUBLISH_CONCURRENCY,
    async (candidate, index) => {
      const withinTimeBudget =
        Date.now() - startedAt < IMMEDIATE_PUBLISH_BUDGET_MS;

      const shouldPublishImmediately = withinTimeBudget;

      let immediateError = "";

      if (shouldPublishImmediately) {
        try {
          const published = await publishCoverageCandidate(
            supabase,
            candidate,
            state
          );

          return {
            ...published,
            immediateAttempted: true,
          };
        } catch (error) {
          immediateError =
            error?.message ||
            "Immediate trusted Current Affairs processing failed.";

          console.warn(
            `[Coverage immediate] "${candidate.topic.title}" deferred to queue:`,
            immediateError
          );
        }
      }

      try {
        const fallback = await persistCoverageCandidate(
          supabase,
          candidate,
          state
        );

        return {
          ...fallback,
          immediateAttempted: shouldPublishImmediately,
          ...(immediateError
            ? { immediateError }
            : {}),
          ...(!shouldPublishImmediately
            ? {
                deferredReason: "Immediate publishing time budget reached.",
              }
            : {}),
        };
      } catch (error) {
        console.error(
          `[Coverage fallback queue] Failed for "${candidate.topic.title}":`,
          error?.message || error
        );

        return {
          status: "failed",
          title: candidate.topic.title,
          immediateAttempted: shouldPublishImmediately,
          immediateError: immediateError || null,
          error:
            error?.message ||
            "Coverage fallback queue write failed.",
        };
      }
    }
  );

  results.push(...processedResults);
  const countStatus = (status) =>
    results.filter((result) => result.status === status).length;

  return {
    success: true,
    requestedSource: selectedSourceIds.length === COVERAGE_SOURCE_IDS.length
      ? "all"
      : selectedSourceIds.join(","),
    requestedSources: selectedSourceIds,
    sources: coverage.counts,
    sourceErrors: coverage.errors,
    fetched: Object.values(coverage.counts).reduce(
      (total, count) => total + count,
      0
    ),
    hybridEvents: topics.length,
    considered: candidateTopics.length,
    immediatePublished: countStatus("published_immediate"),
    immediateEnriched: countStatus("enriched_immediate"),
    immediateProcessed:
      countStatus("published_immediate") +
      countStatus("enriched_immediate"),
    immediateFailures: results.filter(
      (result) => Boolean(result.immediateError)
    ).length,
    deferredToQueue: results.filter(
      (result) =>
        ["queued", "queue_updated", "already_queued"].includes(
          result.status
        )
    ).length,
    queued: countStatus("queued"),
    queueUpdated: countStatus("queue_updated"),
    alreadyQueued: countStatus("already_queued"),
    alreadyMerged: countStatus("already_merged"),
    noiseRejected: countStatus("noise_rejected"),
    sanitationAccepted: sanitizedTopics.length,
    failed: countStatus("failed"),
    durationMs: Date.now() - startedAt,
    results,
  };
}
