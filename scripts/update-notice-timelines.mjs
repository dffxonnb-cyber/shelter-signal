import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const TIMELINE_SCHEMA_VERSION = "1.0.0";
const LATEST_EVENTS_PATH = "app/public/data/latest-events.json";
const TIMELINES_PATH = "app/public/data/notice-timelines.json";
const LATEST_META_PATH = "app/public/data/latest-notices.meta.json";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

if (args.get("self-test") === "true") {
  runSelfTest();
} else {
  main().catch((error) => {
    console.error("[notice-timelines] failed:", safeMessage(error));
    process.exitCode = 1;
  });
}

async function main() {
  const latestEvents = await readRequiredJson(LATEST_EVENTS_PATH);
  const dailyEvents = await readJsonIfExists(dailyEventsPath(latestEvents.observationDate));
  const eventSource = selectTimelineEventSource(latestEvents, dailyEvents);
  const existingTimelines = await readJsonIfExists(TIMELINES_PATH);
  const nextTimelines = mergeNoticeTimelines(existingTimelines, eventSource);

  await writeJson(TIMELINES_PATH, nextTimelines);
  await enrichMetadata(LATEST_META_PATH, latestEvents.snapshotId, nextTimelines);

  console.log("[notice-timelines] generated");
  console.log(
    JSON.stringify(
      {
        source: eventSource.sourceLabel,
        noticeCount: nextTimelines.noticeCount,
        eventCount: nextTimelines.eventCount,
        latestObservationDate: nextTimelines.latestObservationDate,
      },
      null,
      2,
    ),
  );
}

function selectTimelineEventSource(latestEvents, dailyEvents) {
  const canUseDailyEvents =
    dailyEvents &&
    Array.isArray(dailyEvents.events) &&
    nullableText(dailyEvents.observationDate) === nullableText(latestEvents?.observationDate);

  if (!canUseDailyEvents) {
    return { ...latestEvents, sourceLabel: "latest-events" };
  }

  return {
    ...latestEvents,
    generatedAt: dailyEvents.updatedAt || latestEvents.generatedAt,
    events: dailyEvents.events,
    sourceLabel: "daily-events",
  };
}

function mergeNoticeTimelines(existing, latestRun) {
  if (!latestRun || !Array.isArray(latestRun.events)) {
    throw new Error("timeline event source must contain an events array");
  }

  const records = normalizeTimelineRecords(existing?.timelines);

  for (const event of latestRun.events) {
    const noticeKey = nullableText(event?.noticeKey);
    const eventId = nullableText(event?.eventId);
    if (!noticeKey || !eventId) continue;

    const previous = records[noticeKey] || {
      noticeKey,
      notice: null,
      firstObservedAt: null,
      lastObservedAt: null,
      firstObservationDate: null,
      lastObservationDate: null,
      eventCount: 0,
      eventTypes: emptyTypeCounts(),
      events: [],
    };

    const eventMap = new Map(
      (Array.isArray(previous.events) ? previous.events : [])
        .filter((item) => nullableText(item?.eventId))
        .map((item) => [item.eventId, item]),
    );
    eventMap.set(eventId, event);

    const events = [...eventMap.values()].sort(compareEvents);
    const firstEvent = events[0] || null;
    const lastEvent = events.at(-1) || null;

    records[noticeKey] = {
      noticeKey,
      notice: lastEvent?.notice || previous.notice || null,
      firstObservedAt: firstEvent?.observedAt || null,
      lastObservedAt: lastEvent?.observedAt || null,
      firstObservationDate: firstEvent?.observationDate || null,
      lastObservationDate: lastEvent?.observationDate || null,
      eventCount: events.length,
      eventTypes: countEventTypes(events),
      events,
    };
  }

  const sortedRecords = sortObjectByKey(records);
  const timelines = Object.values(sortedRecords);

  return {
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    updatedAt: latestRun.generatedAt || new Date().toISOString(),
    latestObservationDate: latestRun.observationDate || null,
    noticeCount: timelines.length,
    eventCount: timelines.reduce((sum, timeline) => sum + timeline.eventCount, 0),
    timelines: sortedRecords,
    claimBoundary: [
      "collector-observed notice timeline",
      "missing observations do not prove a final animal outcome",
      "timeline starts when Shelter Signal V2 began preserving change events",
    ],
  };
}

async function enrichMetadata(latestMetaPath, snapshotId, timelinePayload) {
  const latestMeta = await readJsonIfExists(latestMetaPath);
  if (!latestMeta) return;

  const enrichedMeta = {
    ...latestMeta,
    counts: {
      ...(latestMeta.counts || {}),
      timelineNoticeCount: timelinePayload.noticeCount,
      timelineEventCount: timelinePayload.eventCount,
    },
    files: {
      ...(latestMeta.files || {}),
      noticeTimelinesJson: TIMELINES_PATH,
    },
    noticeTimelines: {
      schemaVersion: TIMELINE_SCHEMA_VERSION,
      updatedAt: timelinePayload.updatedAt,
      latestObservationDate: timelinePayload.latestObservationDate,
      noticeCount: timelinePayload.noticeCount,
      eventCount: timelinePayload.eventCount,
    },
  };

  await writeJson(latestMetaPath, enrichedMeta);

  const normalizedSnapshotId = nullableText(snapshotId);
  if (normalizedSnapshotId) {
    const monthlyMetaPath = `app/public/data/monthly-notices/${normalizedSnapshotId}.meta.json`;
    const monthlyMeta = await readJsonIfExists(monthlyMetaPath);
    if (monthlyMeta) {
      await writeJson(monthlyMetaPath, {
        ...monthlyMeta,
        counts: enrichedMeta.counts,
        files: enrichedMeta.files,
        noticeTimelines: enrichedMeta.noticeTimelines,
      });
    }
  }
}

function normalizeTimelineRecords(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function emptyTypeCounts() {
  return {
    NEW: 0,
    DEADLINE_CHANGED: 0,
    STATUS_CHANGED: 0,
    BECAME_URGENT: 0,
    NOT_OBSERVED: 0,
    DISAPPEARED: 0,
    RETURNED: 0,
  };
}

function countEventTypes(events) {
  const counts = emptyTypeCounts();
  for (const event of events) {
    if (event?.type in counts) counts[event.type] += 1;
  }
  return counts;
}

function compareEvents(left, right) {
  const observedAt = String(left?.observedAt || "").localeCompare(String(right?.observedAt || ""));
  if (observedAt !== 0) return observedAt;
  return String(left?.eventId || "").localeCompare(String(right?.eventId || ""));
}

function sortObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function dailyEventsPath(observationDate) {
  const normalizedDate = nullableText(observationDate);
  return normalizedDate ? `app/public/data/daily-events/${normalizedDate}.json` : null;
}

async function readRequiredJson(path) {
  const value = await readJsonIfExists(path);
  if (value === null) throw new Error(`Required JSON file is missing: ${path}`);
  return value;
}

async function readJsonIfExists(path) {
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Unable to read JSON file ${path}: ${safeMessage(error)}`);
  }
}

async function writeJson(path, value) {
  const parent = path.split("/").slice(0, -1).join("/");
  await mkdir(parent, { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function runSelfTest() {
  const firstRun = {
    generatedAt: "2026-07-14T01:00:00.000Z",
    observationDate: "2026-07-14",
    snapshotId: "2026-07",
    events: [
      {
        eventId: "event-a-new",
        type: "NEW",
        observedAt: "2026-07-14T01:00:00.000Z",
        observationDate: "2026-07-14",
        snapshotId: "2026-07",
        noticeKey: "desertion:A",
        notice: { notice_no: "서울-A", kind_full_nm: "[개] 믹스견" },
        changes: [],
      },
    ],
  };

  const secondRun = {
    generatedAt: "2026-07-15T01:00:00.000Z",
    observationDate: "2026-07-15",
    snapshotId: "2026-07",
    events: [
      {
        eventId: "event-a-status",
        type: "STATUS_CHANGED",
        observedAt: "2026-07-15T01:00:00.000Z",
        observationDate: "2026-07-15",
        snapshotId: "2026-07",
        noticeKey: "desertion:A",
        notice: {
          notice_no: "서울-A",
          kind_full_nm: "[개] 믹스견",
          process_state: "보호중(입양가능)",
        },
        changes: [{ field: "process_state", previous: "보호중", current: "보호중(입양가능)" }],
      },
      {
        eventId: "event-b-new",
        type: "NEW",
        observedAt: "2026-07-15T01:00:00.000Z",
        observationDate: "2026-07-15",
        snapshotId: "2026-07",
        noticeKey: "desertion:B",
        notice: { notice_no: "서울-B", kind_full_nm: "[고양이] 한국 고양이" },
        changes: [],
      },
    ],
  };

  const sameDayLatestRun = {
    generatedAt: "2026-07-15T02:00:00.000Z",
    observationDate: "2026-07-15",
    snapshotId: "2026-07",
    events: [],
  };
  const accumulatedDailyRun = {
    observationDate: "2026-07-15",
    updatedAt: "2026-07-15T02:00:00.000Z",
    events: secondRun.events,
  };

  const initial = mergeNoticeTimelines(null, firstRun);
  const merged = mergeNoticeTimelines(initial, secondRun);
  const duplicateSafe = mergeNoticeTimelines(merged, secondRun);
  const selectedSource = selectTimelineEventSource(sameDayLatestRun, accumulatedDailyRun);
  const bootstrapSafe = mergeNoticeTimelines(null, selectedSource);

  assert.equal(initial.noticeCount, 1);
  assert.equal(initial.eventCount, 1);
  assert.equal(merged.noticeCount, 2);
  assert.equal(merged.eventCount, 3);
  assert.equal(merged.timelines["desertion:A"].eventCount, 2);
  assert.equal(merged.timelines["desertion:A"].eventTypes.NEW, 1);
  assert.equal(merged.timelines["desertion:A"].eventTypes.STATUS_CHANGED, 1);
  assert.equal(
    merged.timelines["desertion:A"].notice.process_state,
    "보호중(입양가능)",
  );
  assert.equal(duplicateSafe.eventCount, 3);
  assert.equal(selectedSource.sourceLabel, "daily-events");
  assert.equal(bootstrapSafe.noticeCount, 2);
  assert.equal(bootstrapSafe.eventCount, 2);

  console.log("[notice-timelines] self-test passed");
}
