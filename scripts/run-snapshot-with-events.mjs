import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const EVENT_SCHEMA_VERSION = "1.0.0";
const EVENT_TYPES = [
  "NEW",
  "DEADLINE_CHANGED",
  "STATUS_CHANGED",
  "BECAME_URGENT",
  "NOT_OBSERVED",
  "DISAPPEARED",
  "RETURNED",
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const selfTest = args.get("self-test") === "true";
const month = args.get("month") || currentMonthInSeoul();

if (selfTest) {
  runSelfTest();
} else {
  main().catch((error) => {
    console.error("[notice-events] failed:", safeMessage(error));
    process.exitCode = 1;
  });
}

async function main() {
  const observationDate = todayInSeoul();
  const files = eventFiles(month, observationDate);

  const [previousPayload, existingDailyEvents, existingMissingState] = await Promise.all([
    readJsonIfExists(files.latestNoticesJson),
    readJsonIfExists(files.dailyEventsJson),
    readJsonIfExists(files.missingNoticesJson),
  ]);

  runSnapshotCollector(month);

  const [currentPayload, latestMeta] = await Promise.all([
    readRequiredJson(files.latestNoticesJson),
    readRequiredJson(files.latestNoticesMetaJson),
  ]);

  const generatedAt = currentPayload.generatedAt || new Date().toISOString();
  const generatedAtKst = currentPayload.generatedAtKst || formatKst(generatedAt);

  const changeResult = buildChangeEvents({
    previousPayload,
    currentPayload,
    missingState: existingMissingState,
    generatedAt,
    observationDate,
  });

  const latestEvents = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    generatedAt,
    generatedAtKst,
    observationDate,
    snapshotId: currentPayload.snapshotId || month,
    previousSnapshot: previousPayload
      ? {
          snapshotId: previousPayload.snapshotId || null,
          generatedAt: previousPayload.generatedAt || null,
        }
      : null,
    baseline: changeResult.baseline,
    observationWindowChanged: changeResult.observationWindowChanged,
    summary: countEvents(changeResult.events),
    diagnostics: changeResult.diagnostics,
    events: changeResult.events,
  };

  const dailyEvents = mergeDailyEventFile(existingDailyEvents, latestEvents);
  const missingState = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    updatedAt: generatedAt,
    observationDate,
    recordCount: Object.keys(changeResult.missingRecords).length,
    records: sortObjectByKey(changeResult.missingRecords),
  };

  const eventSummary = countEvents(changeResult.events);
  const enrichedMeta = {
    ...latestMeta,
    counts: {
      ...(latestMeta.counts || {}),
      eventCount: eventSummary.total,
      missingRecordCount: missingState.recordCount,
    },
    changeEvents: {
      schemaVersion: EVENT_SCHEMA_VERSION,
      observationDate,
      baseline: changeResult.baseline,
      observationWindowChanged: changeResult.observationWindowChanged,
      summary: eventSummary,
    },
    files: {
      ...(latestMeta.files || {}),
      dailyEventsJson: files.dailyEventsJson,
      latestEventsJson: files.latestEventsJson,
      missingNoticesJson: files.missingNoticesJson,
    },
    warnings: [
      ...(Array.isArray(latestMeta.warnings) ? latestMeta.warnings : []),
      ...changeResult.diagnostics.warnings,
    ],
    claimBoundary: uniqueStrings([
      ...(Array.isArray(latestMeta.claimBoundary) ? latestMeta.claimBoundary : []),
      "collector-observed change events",
      "missing observations do not prove a final animal outcome",
    ]),
  };

  await Promise.all([
    writeJson(files.dailyEventsJson, dailyEvents),
    writeJson(files.latestEventsJson, latestEvents),
    writeJson(files.missingNoticesJson, missingState),
    writeJson(files.latestNoticesMetaJson, enrichedMeta),
    writeJson(files.monthlyNoticesMetaJson, enrichedMeta),
  ]);

  console.log("[notice-events] generated");
  console.log(JSON.stringify(enrichedMeta.changeEvents, null, 2));
}

function runSnapshotCollector(snapshotMonth) {
  const child = spawnSync(
    process.execPath,
    ["scripts/fetch-monthly-notices.mjs", `--month=${snapshotMonth}`],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);

  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Snapshot collector exited with status ${child.status}`);
  }
}

function buildChangeEvents({
  previousPayload,
  currentPayload,
  missingState,
  generatedAt,
  observationDate,
}) {
  const previousIndex = indexNotices(previousPayload?.notices);
  const currentIndex = indexNotices(currentPayload?.notices);
  const missingRecords = normalizeMissingRecords(missingState?.records);
  const events = [];
  const returnedKeys = new Set();
  const warnings = [];

  if (previousIndex.skipped > 0 || currentIndex.skipped > 0) {
    warnings.push(
      `Skipped notices without a stable identifier: previous=${previousIndex.skipped}, current=${currentIndex.skipped}`,
    );
  }

  if (previousIndex.duplicates > 0 || currentIndex.duplicates > 0) {
    warnings.push(
      `Duplicate stable identifiers were collapsed: previous=${previousIndex.duplicates}, current=${currentIndex.duplicates}`,
    );
  }

  for (const [noticeKey, currentNotice] of currentIndex.map) {
    const missingRecord = missingRecords[noticeKey];
    if (!missingRecord) continue;

    events.push(
      createChangeEvent({
        type: "RETURNED",
        noticeKey,
        generatedAt,
        observationDate,
        snapshotId: currentPayload.snapshotId,
        previousNotice: missingRecord.notice || null,
        currentNotice,
        changes: [],
      }),
    );
    returnedKeys.add(noticeKey);
    delete missingRecords[noticeKey];
  }

  for (const [noticeKey, record] of Object.entries(missingRecords)) {
    if (!isLaterDate(observationDate, record.lastMissingDate)) continue;

    record.missingRuns = Number(record.missingRuns || 1) + 1;
    record.lastMissingDate = observationDate;
    record.lastMissingAt = generatedAt;

    if (record.missingRuns >= 2 && record.status !== "DISAPPEARED") {
      record.status = "DISAPPEARED";
      record.disappearedAt = generatedAt;
      events.push(
        createChangeEvent({
          type: "DISAPPEARED",
          noticeKey,
          generatedAt,
          observationDate,
          snapshotId: currentPayload.snapshotId,
          previousNotice: record.notice || null,
          currentNotice: null,
          changes: [],
        }),
      );
    }
  }

  const baseline = !previousPayload || !Array.isArray(previousPayload.notices);
  const observationWindowChanged =
    !baseline &&
    Boolean(previousPayload.snapshotId) &&
    previousPayload.snapshotId !== currentPayload.snapshotId;

  if (!baseline) {
    for (const [noticeKey, currentNotice] of currentIndex.map) {
      const previousNotice = previousIndex.map.get(noticeKey);

      if (!previousNotice) {
        if (!returnedKeys.has(noticeKey)) {
          events.push(
            createChangeEvent({
              type: "NEW",
              noticeKey,
              generatedAt,
              observationDate,
              snapshotId: currentPayload.snapshotId,
              previousNotice: null,
              currentNotice,
              changes: [],
            }),
          );
        }
        continue;
      }

      if (previousNotice.notice_edt !== currentNotice.notice_edt) {
        events.push(
          createChangeEvent({
            type: "DEADLINE_CHANGED",
            noticeKey,
            generatedAt,
            observationDate,
            snapshotId: currentPayload.snapshotId,
            previousNotice,
            currentNotice,
            changes: [
              {
                field: "notice_edt",
                previous: previousNotice.notice_edt ?? null,
                current: currentNotice.notice_edt ?? null,
              },
            ],
          }),
        );
      }

      if (previousNotice.process_state !== currentNotice.process_state) {
        events.push(
          createChangeEvent({
            type: "STATUS_CHANGED",
            noticeKey,
            generatedAt,
            observationDate,
            snapshotId: currentPayload.snapshotId,
            previousNotice,
            currentNotice,
            changes: [
              {
                field: "process_state",
                previous: previousNotice.process_state ?? null,
                current: currentNotice.process_state ?? null,
              },
            ],
          }),
        );
      }

      if (
        Number(previousNotice.days_left) > 3 &&
        Number(currentNotice.days_left) >= 0 &&
        Number(currentNotice.days_left) <= 3
      ) {
        events.push(
          createChangeEvent({
            type: "BECAME_URGENT",
            noticeKey,
            generatedAt,
            observationDate,
            snapshotId: currentPayload.snapshotId,
            previousNotice,
            currentNotice,
            changes: [
              {
                field: "days_left",
                previous: previousNotice.days_left ?? null,
                current: currentNotice.days_left ?? null,
              },
            ],
          }),
        );
      }
    }

    if (!observationWindowChanged) {
      for (const [noticeKey, previousNotice] of previousIndex.map) {
        if (currentIndex.map.has(noticeKey) || missingRecords[noticeKey]) continue;

        missingRecords[noticeKey] = {
          noticeKey,
          status: "NOT_OBSERVED",
          firstMissingAt: generatedAt,
          firstMissingDate: observationDate,
          lastMissingAt: generatedAt,
          lastMissingDate: observationDate,
          missingRuns: 1,
          lastSeenAt: previousPayload.generatedAt || null,
          lastSeenSnapshotId: previousPayload.snapshotId || null,
          notice: noticeSummary(previousNotice),
        };

        events.push(
          createChangeEvent({
            type: "NOT_OBSERVED",
            noticeKey,
            generatedAt,
            observationDate,
            snapshotId: currentPayload.snapshotId,
            previousNotice,
            currentNotice: null,
            changes: [],
          }),
        );
      }
    }
  }

  return {
    baseline,
    observationWindowChanged,
    events: sortEvents(events),
    missingRecords,
    diagnostics: {
      previousNoticeCount: previousIndex.map.size,
      currentNoticeCount: currentIndex.map.size,
      skippedPreviousNotices: previousIndex.skipped,
      skippedCurrentNotices: currentIndex.skipped,
      duplicatePreviousIdentifiers: previousIndex.duplicates,
      duplicateCurrentIdentifiers: currentIndex.duplicates,
      warnings,
    },
  };
}

function createChangeEvent({
  type,
  noticeKey,
  generatedAt,
  observationDate,
  snapshotId,
  previousNotice,
  currentNotice,
  changes,
}) {
  if (!EVENT_TYPES.includes(type)) throw new Error(`Unsupported event type: ${type}`);

  const previous = previousNotice ? noticeSummary(previousNotice) : null;
  const current = currentNotice ? noticeSummary(currentNotice) : null;
  const fingerprint = JSON.stringify({
    type,
    noticeKey,
    observationDate,
    changes,
    previous,
    current,
  });

  return {
    eventId: createHash("sha256").update(fingerprint).digest("hex").slice(0, 24),
    type,
    observedAt: generatedAt,
    observationDate,
    snapshotId,
    noticeKey,
    notice: current || previous,
    changes,
  };
}

function mergeDailyEventFile(existing, latestRun) {
  const canReuseExisting =
    existing &&
    existing.schemaVersion === EVENT_SCHEMA_VERSION &&
    existing.observationDate === latestRun.observationDate;

  const eventMap = new Map();
  if (canReuseExisting && Array.isArray(existing.events)) {
    for (const event of existing.events) {
      if (event?.eventId) eventMap.set(event.eventId, event);
    }
  }
  for (const event of latestRun.events) eventMap.set(event.eventId, event);

  const runMap = new Map();
  if (canReuseExisting && Array.isArray(existing.runs)) {
    for (const run of existing.runs) {
      if (run?.generatedAt) runMap.set(run.generatedAt, run);
    }
  }
  runMap.set(latestRun.generatedAt, {
    generatedAt: latestRun.generatedAt,
    snapshotId: latestRun.snapshotId,
    baseline: latestRun.baseline,
    observationWindowChanged: latestRun.observationWindowChanged,
    summary: latestRun.summary,
    diagnostics: latestRun.diagnostics,
  });

  const events = sortEvents([...eventMap.values()]);
  const runs = [...runMap.values()].sort((a, b) =>
    String(a.generatedAt).localeCompare(String(b.generatedAt)),
  );

  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    observationDate: latestRun.observationDate,
    updatedAt: latestRun.generatedAt,
    runCount: runs.length,
    summary: countEvents(events),
    runs,
    events,
  };
}

function indexNotices(notices) {
  const map = new Map();
  let skipped = 0;
  let duplicates = 0;

  for (const notice of Array.isArray(notices) ? notices : []) {
    const key = stableNoticeKey(notice);
    if (!key) {
      skipped += 1;
      continue;
    }
    if (map.has(key)) duplicates += 1;
    map.set(key, notice);
  }

  return { map, skipped, duplicates };
}

function stableNoticeKey(notice) {
  const desertionNo = nullableText(notice?.desertion_no);
  if (desertionNo) return `desertion:${desertionNo}`;

  const noticeNo = nullableText(notice?.notice_no);
  if (noticeNo) return `notice:${noticeNo}`;

  return null;
}

function noticeSummary(notice) {
  return {
    desertion_no: notice?.desertion_no ?? null,
    notice_no: notice?.notice_no ?? null,
    happen_dt: notice?.happen_dt ?? null,
    notice_sdt: notice?.notice_sdt ?? null,
    notice_edt: notice?.notice_edt ?? null,
    kind_full_nm: notice?.kind_full_nm ?? null,
    process_state: notice?.process_state ?? null,
    care_nm: notice?.care_nm ?? null,
    org_nm: notice?.org_nm ?? null,
    days_left: notice?.days_left ?? null,
    deadline_status: notice?.deadline_status ?? null,
  };
}

function countEvents(events) {
  const counts = Object.fromEntries(EVENT_TYPES.map((type) => [type, 0]));
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type in counts) counts[event.type] += 1;
  }
  counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return counts;
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const time = String(a.observedAt).localeCompare(String(b.observedAt));
    if (time !== 0) return time;
    const type = String(a.type).localeCompare(String(b.type));
    if (type !== 0) return type;
    return String(a.noticeKey).localeCompare(String(b.noticeKey));
  });
}

function normalizeMissingRecords(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) return {};
  return JSON.parse(JSON.stringify(records));
}

function sortObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function isLaterDate(currentDate, previousDate) {
  if (!previousDate) return true;
  return String(currentDate).localeCompare(String(previousDate)) > 0;
}

function eventFiles(snapshotMonth, observationDate) {
  return {
    latestNoticesJson: "app/public/data/latest-notices.json",
    latestNoticesMetaJson: "app/public/data/latest-notices.meta.json",
    monthlyNoticesMetaJson: `app/public/data/monthly-notices/${snapshotMonth}.meta.json`,
    dailyEventsJson: `app/public/data/daily-events/${observationDate}.json`,
    latestEventsJson: "app/public/data/latest-events.json",
    missingNoticesJson: "app/public/data/missing-notices.json",
  };
}

async function readRequiredJson(path) {
  const value = await readJsonIfExists(path);
  if (value === null) throw new Error(`Required JSON file is missing: ${path}`);
  return value;
}

async function readJsonIfExists(path) {
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

function currentMonthInSeoul() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year").value;
  const monthValue = parts.find((part) => part.type === "month").value;
  return `${year}-${monthValue}`;
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatKst(isoTimestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(isoTimestamp));
}

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function runSelfTest() {
  const generatedAt = "2026-07-14T00:00:00.000Z";
  const observationDate = "2026-07-14";
  const baseNotice = {
    happen_dt: "2026-07-10",
    notice_sdt: "2026-07-11",
    kind_full_nm: "[개] 믹스견",
    process_state: "보호중",
    care_nm: "테스트 보호소",
    org_nm: "서울특별시",
    deadline_status: "active",
  };

  const previousPayload = {
    snapshotId: "2026-07",
    generatedAt: "2026-07-13T00:00:00.000Z",
    notices: [
      { ...baseNotice, desertion_no: "A", notice_edt: "2026-07-17", days_left: 4 },
      { ...baseNotice, desertion_no: "B", notice_edt: "2026-07-20", days_left: 7 },
      { ...baseNotice, desertion_no: "C", notice_edt: "2026-07-20", days_left: 7 },
      { ...baseNotice, desertion_no: "U", notice_edt: "2026-07-18", days_left: 4 },
    ],
  };

  const currentPayload = {
    snapshotId: "2026-07",
    generatedAt,
    notices: [
      { ...baseNotice, desertion_no: "A", notice_edt: "2026-07-18", days_left: 5 },
      {
        ...baseNotice,
        desertion_no: "B",
        notice_edt: "2026-07-20",
        days_left: 6,
        process_state: "보호중(입양가능)",
      },
      { ...baseNotice, desertion_no: "U", notice_edt: "2026-07-18", days_left: 3 },
      { ...baseNotice, desertion_no: "D", notice_edt: "2026-07-19", days_left: 5 },
      { ...baseNotice, desertion_no: "R", notice_edt: "2026-07-19", days_left: 5 },
    ],
  };

  const missingState = {
    records: {
      "desertion:R": {
        noticeKey: "desertion:R",
        status: "NOT_OBSERVED",
        lastMissingDate: "2026-07-13",
        missingRuns: 1,
        notice: { ...baseNotice, desertion_no: "R" },
      },
      "desertion:X": {
        noticeKey: "desertion:X",
        status: "NOT_OBSERVED",
        lastMissingDate: "2026-07-13",
        missingRuns: 1,
        notice: { ...baseNotice, desertion_no: "X" },
      },
    },
  };

  const result = buildChangeEvents({
    previousPayload,
    currentPayload,
    missingState,
    generatedAt,
    observationDate,
  });

  const summary = countEvents(result.events);
  assert.deepEqual(
    {
      NEW: summary.NEW,
      DEADLINE_CHANGED: summary.DEADLINE_CHANGED,
      STATUS_CHANGED: summary.STATUS_CHANGED,
      BECAME_URGENT: summary.BECAME_URGENT,
      NOT_OBSERVED: summary.NOT_OBSERVED,
      DISAPPEARED: summary.DISAPPEARED,
      RETURNED: summary.RETURNED,
      total: summary.total,
    },
    {
      NEW: 1,
      DEADLINE_CHANGED: 1,
      STATUS_CHANGED: 1,
      BECAME_URGENT: 1,
      NOT_OBSERVED: 1,
      DISAPPEARED: 1,
      RETURNED: 1,
      total: 7,
    },
  );
  assert.equal(result.missingRecords["desertion:R"], undefined);
  assert.equal(result.missingRecords["desertion:X"].status, "DISAPPEARED");
  assert.equal(result.missingRecords["desertion:C"].status, "NOT_OBSERVED");

  const merged = mergeDailyEventFile(
    {
      schemaVersion: EVENT_SCHEMA_VERSION,
      observationDate,
      runs: [],
      events: [result.events[0]],
    },
    {
      schemaVersion: EVENT_SCHEMA_VERSION,
      generatedAt,
      observationDate,
      snapshotId: "2026-07",
      baseline: false,
      observationWindowChanged: false,
      summary,
      diagnostics: result.diagnostics,
      events: result.events,
    },
  );

  assert.equal(merged.summary.total, 7);
  assert.equal(merged.events.length, 7);
  assert.equal(merged.runCount, 1);

  const monthResetResult = buildChangeEvents({
    previousPayload,
    currentPayload: { ...currentPayload, snapshotId: "2026-08", notices: [] },
    missingState: null,
    generatedAt,
    observationDate,
  });
  assert.equal(monthResetResult.observationWindowChanged, true);
  assert.equal(countEvents(monthResetResult.events).NOT_OBSERVED, 0);

  console.log("[notice-events] self-test passed");
}

function safeMessage(error) {
  if (error instanceof Error) {
    return error.message.replace(/serviceKey=[^&\s]+/gi, "serviceKey=[redacted]");
  }

  return String(error).replace(/serviceKey=[^&\s]+/gi, "serviceKey=[redacted]");
}
