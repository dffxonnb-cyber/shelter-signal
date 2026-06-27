const PUBLIC_API_URL =
  "https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const DEFAULT_STATE = "notice";
const DEFAULT_NUM_OF_ROWS = 1000;
const MAX_PAGES = 10;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const dryRun = args.get("dry-run") === "true";
const month = args.get("month") || currentMonthInSeoul();

main().catch((error) => {
  console.error("[monthly-snapshot] failed:", safeMessage(error));
  process.exitCode = 1;
});

async function main() {
  const period = monthPeriod(month);
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY || process.env.ANIMAL_API_KEY;

  const output = {
    snapshotId: month,
    period,
    files: snapshotFiles(month),
  };

  if (dryRun) {
    console.log("[monthly-snapshot] dry run");
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (!serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY or ANIMAL_API_KEY is required");
  }

  const startedAt = Date.now();
  const upstream = await fetchPublicNotices(serviceKey, period);
  const today = todayInSeoul();
  const normalized = upstream.items.map(normalizePublicNotice).map((record) =>
    decorateNotice(record, today),
  );

  const current = normalized.filter((notice) => {
    return notice.notice_edt && notice.days_left >= 0 && !startsWithEndState(notice.process_state);
  });

  const urgent = current.filter((notice) => notice.days_left >= 0 && notice.days_left <= 3);

  const protectedNotices = current.filter((notice) => {
    return String(notice.process_state || "").includes("보호");
  });

  const archive = normalized.filter((notice) => {
    return !notice.notice_edt || notice.days_left < 0 || startsWithEndState(notice.process_state);
  });

  const generatedAt = new Date().toISOString();
  const generatedAtKst = formatKst(generatedAt);
  const files = snapshotFiles(month);

  const payload = {
    ok: true,
    snapshotId: month,
    generatedAt,
    generatedAtKst,
    period,
    notices: normalized,
    views: {
      current,
      urgent,
      protected: protectedNotices,
      archive,
    },
  };

  const meta = {
    schemaVersion: "1.0.0",
    snapshotId: month,
    generatedAt,
    generatedAtKst,
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
      timezone: SEOUL_TIME_ZONE,
    },
    source: {
      provider: "data.go.kr",
      apiName: "abandonmentPublicService_v2",
      sourceType: "public-data-api",
    },
    dataBoundary: {
      isLiveData: false,
      isPublicSafe: true,
      containsSecrets: false,
      containsFullUpstreamUrl: false,
    },
    collection: {
      state: DEFAULT_STATE,
      numOfRows: DEFAULT_NUM_OF_ROWS,
      maxPages: MAX_PAGES,
      pagesFetched: upstream.pagesFetched,
      upstreamTotalCount: upstream.totalCount,
      truncated: upstream.truncated,
      responseFormat: upstream.responseFormat,
    },
    counts: {
      itemCount: upstream.items.length,
      normalizedItemCount: normalized.length,
      currentCount: current.length,
      urgentCount: urgent.length,
      protectedCount: protectedNotices.length,
      archiveCount: archive.length,
    },
    freshnessRules: {
      dateField: "noticeEdt",
      currentRule: "noticeEdt is valid and not expired at Asia/Seoul date",
      urgentRule: "days_left is between 0 and 3",
      timezone: SEOUL_TIME_ZONE,
    },
    files,
    warnings: upstream.warnings,
    claimBoundary: [
      "monthly public-data snapshot",
      "not real-time notice service",
      "not complete upstream-data guarantee",
      "not shelter operation data",
      "not adoption outcome tracking",
    ],
    runtime: {
      durationMs: Date.now() - startedAt,
    },
  };

  await writeJson(files.snapshotJson, payload);
  await writeJson(files.snapshotMetaJson, meta);
  await writeJson(files.latestJson, payload);
  await writeJson(files.latestMetaJson, meta);

  console.log("[monthly-snapshot] generated");
  console.log(JSON.stringify(meta.counts, null, 2));
}

async function fetchPublicNotices(serviceKey, period) {
  const firstPage = await fetchPublicNoticePage(serviceKey, period, 1);

  if (firstPage.errorMessage) {
    throw new Error(firstPage.errorMessage);
  }

  const totalPages = Math.ceil(firstPage.totalCount / DEFAULT_NUM_OF_ROWS);
  const lastPage = Math.min(totalPages || 1, MAX_PAGES);
  const items = [...firstPage.items];
  const warnings = [];
  let pagesFetched = 1;

  for (let pageNo = 2; pageNo <= lastPage; pageNo += 1) {
    const page = await fetchPublicNoticePage(serviceKey, period, pageNo);

    if (page.errorMessage) {
      warnings.push(`Stopped at page ${pageNo}: ${page.errorMessage}`);
      break;
    }

    items.push(...page.items);
    pagesFetched += 1;
  }

  return {
    items,
    totalCount: firstPage.totalCount,
    pagesFetched,
    truncated: totalPages > lastPage || items.length < firstPage.totalCount,
    responseFormat: firstPage.responseFormat,
    warnings,
  };
}

async function fetchPublicNoticePage(serviceKey, period, pageNo) {
  const url = new URL(PUBLIC_API_URL);
  url.searchParams.set("serviceKey", normalizeServiceKeyForQuery(serviceKey));
  url.searchParams.set("bgnde", compactDate(period.startDate));
  url.searchParams.set("endde", compactDate(period.endDate));
  url.searchParams.set("state", DEFAULT_STATE);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(DEFAULT_NUM_OF_ROWS));
  url.searchParams.set("_type", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "shelter-signal-monthly-snapshot/0.1",
    },
  });

  const text = await response.text();
  const parsed = parsePublicApiPayload(text);

  if (response.status < 200 || response.status >= 300) {
    return {
      ...parsed,
      errorMessage: parsed.errorMessage || `Public data API returned ${response.status}`,
    };
  }

  return parsed;
}

function parsePublicApiPayload(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      items: [],
      totalCount: 0,
      responseFormat: "empty",
      errorMessage: "Public data API returned an empty response",
    };
  }

  try {
    const payload = JSON.parse(trimmed);
    const resultCode =
      readNestedText(payload, ["response", "header", "resultCode"]) ||
      readNestedText(payload, ["header", "resultCode"]) ||
      readNestedText(payload, ["resultCode"]);

    const resultMessage =
      readNestedText(payload, ["response", "header", "resultMsg"]) ||
      readNestedText(payload, ["header", "resultMsg"]) ||
      readNestedText(payload, ["resultMsg"]);

    if (resultCode && !["0", "00", "INFO-000"].includes(resultCode)) {
      return {
        items: [],
        totalCount: 0,
        responseFormat: "json",
        errorMessage: resultMessage || resultCode,
      };
    }

    const items = extractJsonItems(payload);
    const totalCount =
      readNestedNumber(payload, ["response", "body", "totalCount"]) ??
      readNestedNumber(payload, ["body", "totalCount"]) ??
      readNestedNumber(payload, ["totalCount"]) ??
      items.length;

    return {
      items,
      totalCount,
      responseFormat: "json",
    };
  } catch {
    return {
      items: [],
      totalCount: 0,
      responseFormat: "xml",
      errorMessage: "Public data API did not return JSON",
    };
  }
}

function extractJsonItems(payload) {
  const item =
    readNestedValue(payload, ["response", "body", "items", "item"]) ??
    readNestedValue(payload, ["body", "items", "item"]) ??
    readNestedValue(payload, ["items", "item"]) ??
    readNestedValue(payload, ["item"]) ??
    [];

  if (Array.isArray(item)) {
    return item.filter((value) => value && typeof value === "object");
  }

  if (item && typeof item === "object") {
    return [item];
  }

  return [];
}

function normalizePublicNotice(item) {
  const upKindName = nullableText(item.upKindNm);
  const kindName = nullableText(item.kindNm);
  const popfile1 = nullableText(item.popfile1);
  const popfile2 = nullableText(item.popfile2);
  const careTel = nullableText(item.careTel);

  return {
    desertion_no: nullableText(item.desertionNo),
    notice_no: nullableText(item.noticeNo),
    happen_dt: normalizeDate(item.happenDt),
    happen_place: nullableText(item.happenPlace),
    notice_sdt: normalizeDate(item.noticeSdt),
    notice_edt: normalizeDate(item.noticeEdt),
    kind_full_nm:
      nullableText(item.kindFullNm) ||
      [upKindName ? `[${upKindName}]` : "", kindName].filter(Boolean).join(" ") ||
      null,
    up_kind_nm: upKindName,
    kind_nm: kindName,
    color_cd: nullableText(item.colorCd),
    age: nullableText(item.age),
    weight: nullableText(item.weight),
    popfile1,
    popfile2,
    process_state: nullableText(item.processState),
    sex_cd: nullableText(item.sexCd),
    neuter_yn: nullableText(item.neuterYn),
    special_mark: nullableText(item.specialMark),
    care_nm: nullableText(item.careNm),
    care_tel: careTel,
    care_addr: nullableText(item.careAddr),
    org_nm: nullableText(item.orgNm),
    has_photo: Boolean(popfile1 || popfile2),
    has_care_tel: Boolean(careTel),
  };
}

function decorateNotice(record, today) {
  const noticeEndDate = normalizeDate(record.notice_edt);
  const daysLeft = noticeEndDate ? differenceInDays(today, noticeEndDate) : -1;

  return {
    ...record,
    notice_edt: noticeEndDate,
    days_left: daysLeft,
    days_until_notice_end: daysLeft,
    deadline_status: deadlineStatusFor(daysLeft),
  };
}

function snapshotFiles(snapshotId) {
  return {
    snapshotJson: `app/public/data/monthly-notices/${snapshotId}.json`,
    snapshotMetaJson: `app/public/data/monthly-notices/${snapshotId}.meta.json`,
    latestJson: "app/public/data/latest-notices.json",
    latestMetaJson: "app/public/data/latest-notices.meta.json",
  };
}

async function writeJson(path, value) {
  const fs = await import("node:fs/promises");
  const parent = path.split("/").slice(0, -1).join("/");
  await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(`${path}`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function monthPeriod(monthValue) {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) {
    throw new Error("--month must use YYYY-MM format");
  }

  const [year, monthNumber] = monthValue.split("-").map(Number);
  const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDateObject = new Date(Date.UTC(year, monthNumber, 0));
  const endDate = endDateObject.toISOString().slice(0, 10);

  return {
    startDate,
    endDate,
    timezone: SEOUL_TIME_ZONE,
  };
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

function compactDate(value) {
  return value.replaceAll("-", "");
}

function normalizeDate(value) {
  const text = nullableText(value);
  if (!text) return null;

  const compact = text.replaceAll("-", "");
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }

  return null;
}

function differenceInDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function deadlineStatusFor(daysLeft) {
  if (daysLeft === 0) return "D-Day";
  if (daysLeft === 1) return "D-1";
  if (daysLeft === 2) return "D-2";
  if (daysLeft === 3) return "D-3";
  if (daysLeft > 3) return "active";
  return "expired";
}

function startsWithEndState(value) {
  return String(value || "").startsWith("종료");
}

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeServiceKeyForQuery(serviceKey) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function readNestedValue(value, path) {
  return path.reduce((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return current[key];
    }
    return undefined;
  }, value);
}

function readNestedText(value, path) {
  const found = readNestedValue(value, path);
  return found === null || found === undefined ? null : String(found).trim();
}

function readNestedNumber(value, path) {
  const found = readNestedValue(value, path);
  const parsed = Number(found);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeMessage(error) {
  if (error instanceof Error) {
    return error.message.replace(/serviceKey=[^&\s]+/gi, "serviceKey=[redacted]");
  }

  return String(error).replace(/serviceKey=[^&\s]+/gi, "serviceKey=[redacted]");
}