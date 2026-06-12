import { Pool } from "pg";

type QueryValue = string | string[] | undefined;
type NoticeSource = "api" | "fallback";
type DeadlineStatus = "D-Day" | "D-1" | "D-2" | "D-3" | "active" | "expired";
type FallbackReason =
  | "missing_service_key"
  | "upstream_http_error"
  | "upstream_api_error"
  | "upstream_empty_response"
  | "upstream_request_failed";

interface VercelRequest {
  method?: string;
  query: Record<string, QueryValue>;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: NoticesResponse): void;
}

interface NoticeFilters {
  region?: string;
  animalType?: string;
  rescueWindowLabel?: string;
}

interface RequestOptions {
  bgnde: string;
  endde: string;
  state: string;
  bgupd?: string;
  enupd?: string;
  pageNo: number;
  numOfRows: number;
  includeExpired: boolean;
  filters: NoticeFilters;
}

type NoticeRecord = Record<string, string | number | boolean | null>;

interface NoticeViews {
  currentNotices: NoticeRecord[];
  urgentNotices: NoticeRecord[];
  protectedAnimals: NoticeRecord[];
  expiredRecords: NoticeRecord[];
}

interface NoticeMeta {
  source: NoticeSource;
  origin: "public-api" | "operational-postgres";
  fetchedAt: string;
  dateRange: {
    bgnde: string;
    endde: string;
    bgupd?: string;
    enupd?: string;
  };
  state: string;
  requestState: string;
  pageNo: number;
  numOfRows: number;
  itemCount: number;
  filteredCount: number;
  returnedCount: number;
  urgentCount: number;
  pagesFetched: number;
  upstreamTotalCount: number;
  responseFormat: "json" | "xml" | "empty" | "fallback";
  truncated: boolean;
  viewLimit: number;
  fallbackReason?: FallbackReason;
  warning?: string;
  counts: {
    current: number;
    urgent: number;
    protected: number;
    expired: number;
  };
}

type NoticesResponse =
  | {
      ok: true;
      notices: NoticeRecord[];
      views: NoticeViews;
      source: NoticeSource;
      meta: NoticeMeta;
    }
  | {
      ok: false;
      code:
        | "MISSING_DATA_SOURCE"
        | "UPSTREAM_ERROR"
        | "DB_QUERY_ERROR"
        | "METHOD_NOT_ALLOWED";
      message?: string;
      notices: [];
    };

interface PublicApiResult {
  status: number;
  items: Record<string, unknown>[];
  totalCount: number;
  pagesFetched: number;
  contentType: string;
  responseFormat: "json" | "xml" | "empty";
  truncated: boolean;
  errorReason?: FallbackReason;
  errorMessage?: string;
}

interface NoticeDiagnostics {
  itemCount: number;
  filteredCount: number;
  urgentCount: number;
  pagesFetched: number;
  upstreamTotalCount: number;
  responseFormat: NoticeMeta["responseFormat"];
  truncated: boolean;
  fallbackReason?: FallbackReason;
}

const PUBLIC_API_URL =
  "https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2";
const FALLBACK_WARNING =
  "공공데이터 API 응답이 불안정하여 샘플 데이터를 표시 중입니다. 실시간 공고가 아닐 수 있습니다.";
const DEFAULT_NUM_OF_ROWS = 1000;
const MAX_NUM_OF_ROWS = 1000;
const MAX_UPSTREAM_PAGES = 10;
const MAX_VIEW_ROWS = 500;
const DEFAULT_STATE = "notice";
const SEOUL_TIME_ZONE = "Asia/Seoul";

let cachedPool: Pool | null = null;
let cachedDatabaseUrl: string | null = null;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      notices: [],
    });
    return;
  }

  const today = todayInSeoul();
  const options = parseRequestOptions(req.query, today);
  const serviceKey =
    process.env.DATA_GO_KR_SERVICE_KEY || process.env.ANIMAL_API_KEY;
  let upstreamError: string;
  let fallbackReason: FallbackReason;

  if (serviceKey) {
    if (!process.env.DATA_GO_KR_SERVICE_KEY && process.env.ANIMAL_API_KEY) {
      console.warn("[notices-api] using legacy ANIMAL_API_KEY server-side alias");
    }
    try {
      const upstreamResult = await fetchPublicNotices(serviceKey, options);
      if (
        upstreamResult.status >= 200 &&
        upstreamResult.status < 300 &&
        !upstreamResult.errorMessage
      ) {
        const records = upstreamResult.items
          .map(normalizePublicNotice)
          .map((record) => decorateNotice(record, today));
        const hasUsableDates =
          records.length === 0 ||
          records.some((record) => Boolean(record.notice_edt));

        if (hasUsableDates) {
          const views = buildViews(records, options.includeExpired, options.filters);

          res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
          res.status(200).json({
            ok: true,
            notices: views.currentNotices,
            views,
            source: "api",
            meta: buildMeta("api", "public-api", options, views, {
              itemCount: upstreamResult.items.length,
              filteredCount: countCurrentNotices(records, options.filters),
              urgentCount: countUrgentNotices(records, options.filters),
              pagesFetched: upstreamResult.pagesFetched,
              upstreamTotalCount: upstreamResult.totalCount,
              responseFormat: upstreamResult.responseFormat,
              truncated: upstreamResult.truncated,
            }),
          });
          return;
        }

        upstreamError = "Public data API records did not contain usable noticeEdt values";
        fallbackReason = "upstream_api_error";
      } else {
        upstreamError =
          upstreamResult.errorMessage || `Public data API returned ${upstreamResult.status}`;
        fallbackReason = upstreamResult.errorReason || "upstream_api_error";
      }
    } catch (error) {
      upstreamError = sanitizeDiagnosticText(errorMessage(error));
      fallbackReason = "upstream_request_failed";
    }
  } else {
    upstreamError = "DATA_GO_KR_SERVICE_KEY or ANIMAL_API_KEY is not configured";
    fallbackReason = "missing_service_key";
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[notices-api] live API unavailable and DATABASE_URL is missing", upstreamError);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      ok: false,
      code: "MISSING_DATA_SOURCE",
      message: fallbackReason,
      notices: [],
    });
    return;
  }

  try {
    const records = await fetchDatabaseFallback(databaseUrl, options, today);
    const views = buildViews(records, options.includeExpired, options.filters);
    console.warn("[notices-api] using PostgreSQL fallback", upstreamError);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      ok: true,
      notices: views.currentNotices,
      views,
      source: "fallback",
      meta: buildMeta(
        "fallback",
        "operational-postgres",
        options,
        views,
        {
          itemCount: records.length,
          filteredCount: countCurrentNotices(records, options.filters),
          urgentCount: countUrgentNotices(records, options.filters),
          pagesFetched: 0,
          upstreamTotalCount: 0,
          responseFormat: "fallback",
          truncated: false,
          fallbackReason,
        },
        FALLBACK_WARNING,
      ),
    });
  } catch (error) {
    console.error("[notices-api] PostgreSQL fallback failed", errorMessage(error));
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({
      ok: false,
      code: "DB_QUERY_ERROR",
      message: `${fallbackReason}; database fallback failed`,
      notices: [],
    });
  }
}

function parseRequestOptions(
  query: Record<string, QueryValue>,
  today: string,
): RequestOptions {
  const defaultStart = shiftDate(today, -30);
  return {
    bgnde: parseDateQuery(query.bgnde, defaultStart),
    endde: parseDateQuery(query.endde, today),
    state: firstQueryValue(query.state) || DEFAULT_STATE,
    ...optionalDateQuery("bgupd", query.bgupd),
    ...optionalDateQuery("enupd", query.enupd),
    pageNo: parsePositiveInteger(query.pageNo, 1, 1_000_000),
    numOfRows: parsePositiveInteger(query.numOfRows, DEFAULT_NUM_OF_ROWS, MAX_NUM_OF_ROWS),
    includeExpired: firstQueryValue(query.includeExpired) === "true",
    filters: parseFilters(query),
  };
}

async function fetchPublicNotices(
  serviceKey: string,
  options: RequestOptions,
): Promise<PublicApiResult> {
  const firstPage = await fetchPublicNoticePage(serviceKey, options, options.pageNo);
  if (firstPage.errorMessage || options.pageNo !== 1) {
    return firstPage;
  }

  const totalPages = Math.ceil(firstPage.totalCount / options.numOfRows);
  const lastPage = Math.min(totalPages, MAX_UPSTREAM_PAGES);
  const items = [...firstPage.items];
  let pagesFetched = 1;

  for (let pageNo = 2; pageNo <= lastPage; pageNo += 1) {
    const page = await fetchPublicNoticePage(serviceKey, options, pageNo);
    if (page.errorMessage) {
      return {
        ...page,
        items: [],
        pagesFetched,
        totalCount: firstPage.totalCount,
        truncated: true,
      };
    }
    items.push(...page.items);
    pagesFetched += 1;
  }

  return {
    ...firstPage,
    items,
    pagesFetched,
    truncated: totalPages > lastPage || items.length < firstPage.totalCount,
  };
}

async function fetchPublicNoticePage(
  serviceKey: string,
  options: RequestOptions,
  pageNo: number,
): Promise<PublicApiResult> {
  const url = new URL(PUBLIC_API_URL);
  url.searchParams.set("serviceKey", normalizeServiceKeyForQuery(serviceKey));
  url.searchParams.set("bgnde", compactDate(options.bgnde));
  url.searchParams.set("endde", compactDate(options.endde));
  url.searchParams.set("state", options.state);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(options.numOfRows));
  url.searchParams.set("_type", "json");
  if (options.bgupd) {
    url.searchParams.set("bgupd", compactDate(options.bgupd));
  }
  if (options.enupd) {
    url.searchParams.set("enupd", compactDate(options.enupd));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "shelter-signal-vercel-function/0.2",
    },
  });
  const text = await response.text();
  const parsed = parsePublicApiPayload(text);

  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    pagesFetched: 1,
    truncated: false,
    ...parsed,
    ...(response.status < 200 || response.status >= 300
      ? {
          errorReason: "upstream_http_error" as const,
          errorMessage: parsed.errorMessage || `Public data API returned ${response.status}`,
        }
      : {}),
  };
}

function parsePublicApiPayload(text: string): {
  items: Record<string, unknown>[];
  totalCount: number;
  responseFormat: PublicApiResult["responseFormat"];
  errorReason?: FallbackReason;
  errorMessage?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      items: [],
      totalCount: 0,
      responseFormat: "empty",
      errorReason: "upstream_empty_response",
      errorMessage: "Public data API returned an empty response",
    };
  }

  try {
    const payload: unknown = JSON.parse(trimmed);
    const resultCode = readNestedText(payload, [
      ["response", "header", "resultCode"],
      ["header", "resultCode"],
      ["resultCode"],
    ]);
    const resultMessage = readNestedText(payload, [
      ["response", "header", "resultMsg"],
      ["header", "resultMsg"],
      ["resultMsg"],
    ]);
    if (resultCode && !["0", "00", "INFO-000"].includes(resultCode)) {
      return {
        items: [],
        totalCount: 0,
        responseFormat: "json",
        errorReason: "upstream_api_error",
        errorMessage: resultMessage || resultCode,
      };
    }

    const items = extractJsonItems(payload);
    return {
      items,
      totalCount: readNestedNumber(payload, [
        ["response", "body", "totalCount"],
        ["body", "totalCount"],
        ["totalCount"],
      ]) ?? items.length,
      responseFormat: "json",
    };
  } catch {
    const message =
      extractXmlTagText(trimmed, "errMsg") ||
      extractXmlTagText(trimmed, "returnAuthMsg") ||
      extractXmlTagText(trimmed, "resultMsg") ||
      "Public data API did not return JSON";
    return {
      items: [],
      totalCount: 0,
      responseFormat: "xml",
      errorReason: "upstream_api_error",
      errorMessage: message,
    };
  }
}

function normalizePublicNotice(item: Record<string, unknown>): NoticeRecord {
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

async function fetchDatabaseFallback(
  databaseUrl: string,
  options: RequestOptions,
  today: string,
): Promise<NoticeRecord[]> {
  const pool = getPool(databaseUrl);
  const { sql, values } = buildNoticesQuery(options, today);
  const result = await pool.query<NoticeRecord>(sql, values);
  return result.rows.map((record) => decorateNotice(record, today));
}

function getPool(databaseUrl: string): Pool {
  if (!cachedPool || cachedDatabaseUrl !== databaseUrl) {
    cachedPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
    });
    cachedDatabaseUrl = databaseUrl;
  }

  return cachedPool;
}

function buildNoticesQuery(
  options: RequestOptions,
  today: string,
): { sql: string; values: Array<string | number> } {
  const values: Array<string | number> = [];
  const whereClauses: string[] = [];

  addExactFilter(whereClauses, values, "org_nm", options.filters.region);
  addExactFilter(whereClauses, values, "up_kind_nm", options.filters.animalType);
  addExactFilter(
    whereClauses,
    values,
    "rescue_window_label",
    options.filters.rescueWindowLabel,
  );

  values.push(options.bgnde);
  whereClauses.push(`notice_sdt >= $${values.length}::date`);
  values.push(options.endde);
  whereClauses.push(`notice_sdt <= $${values.length}::date`);
  if (!options.includeExpired) {
    values.push(today);
    whereClauses.push(`notice_edt >= $${values.length}::date`);
  }

  values.push(options.numOfRows);
  const limitPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      desertion_no,
      notice_no,
      happen_dt,
      happen_place,
      notice_sdt,
      notice_edt,
      days_until_notice_end,
      deadline_bucket,
      rescue_window_score,
      rescue_window_label,
      kind_full_nm,
      up_kind_nm,
      kind_nm,
      color_cd,
      age,
      weight,
      popfile1,
      popfile2,
      process_state,
      sex_cd,
      neuter_yn,
      special_mark,
      care_nm,
      care_tel,
      care_addr,
      org_nm,
      has_photo,
      has_care_tel
    FROM mart.animals_clean
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY notice_edt ASC NULLS LAST, desertion_no ASC
    LIMIT ${limitPlaceholder};
  `;

  return { sql, values };
}

function decorateNotice(record: NoticeRecord, today: string): NoticeRecord {
  const noticeEndDate = normalizeDate(record.notice_edt);
  const daysLeft = noticeEndDate ? differenceInDays(today, noticeEndDate) : -1;
  const deadlineStatus = deadlineStatusFor(daysLeft);
  const hasPhoto = Boolean(record.has_photo || record.popfile1 || record.popfile2);
  const hasCareTel = Boolean(record.has_care_tel || record.care_tel);
  const score = rescueWindowScore(daysLeft, hasPhoto, hasCareTel);

  return {
    ...record,
    happen_dt: normalizeDate(record.happen_dt),
    notice_sdt: normalizeDate(record.notice_sdt),
    notice_edt: noticeEndDate,
    days_until_notice_end: daysLeft,
    days_left: daysLeft,
    deadline_status: deadlineStatus,
    deadline_bucket: deadlineStatus,
    rescue_window_score: score,
    rescue_window_label: rescueWindowLabel(daysLeft),
    has_photo: hasPhoto,
    has_care_tel: hasCareTel,
  };
}

function buildViews(
  records: NoticeRecord[],
  includeExpired: boolean,
  filters: NoticeFilters,
): NoticeViews {
  const filteredRecords = records.filter((notice) => matchesNoticeFilters(notice, filters));
  const currentCandidates = filteredRecords
    .filter(
      (notice) =>
        notice.deadline_status !== "expired" &&
        !textFromUnknown(notice.process_state).startsWith("종료"),
    )
    .sort(compareNoticeDeadline);
  const currentNotices = currentCandidates.slice(0, MAX_VIEW_ROWS);
  const urgentNotices = currentCandidates
    .filter((notice) => {
      const daysLeft = numberFromUnknown(notice.days_left);
      return daysLeft >= 0 && daysLeft <= 3;
    })
    .sort(compareUrgency)
    .slice(0, MAX_VIEW_ROWS);
  const protectedAnimals = currentCandidates
    .filter((notice) => textFromUnknown(notice.process_state).includes("보호"))
    .slice(0, MAX_VIEW_ROWS);
  const expiredRecords = includeExpired
    ? filteredRecords
        .filter(
          (notice) =>
            notice.deadline_status === "expired" ||
            textFromUnknown(notice.process_state).startsWith("종료"),
        )
        .sort(compareNoticeDeadline)
        .slice(0, MAX_VIEW_ROWS)
    : [];

  return {
    currentNotices,
    urgentNotices,
    protectedAnimals,
    expiredRecords,
  };
}

function countCurrentNotices(records: NoticeRecord[], filters: NoticeFilters): number {
  return records.filter(
    (notice) =>
      matchesNoticeFilters(notice, filters) &&
      notice.deadline_status !== "expired" &&
      !textFromUnknown(notice.process_state).startsWith("종료"),
  ).length;
}

function countUrgentNotices(records: NoticeRecord[], filters: NoticeFilters): number {
  return records.filter((notice) => {
    const daysLeft = numberFromUnknown(notice.days_left);
    return (
      matchesNoticeFilters(notice, filters) &&
      notice.deadline_status !== "expired" &&
      !textFromUnknown(notice.process_state).startsWith("종료") &&
      daysLeft >= 0 &&
      daysLeft <= 3
    );
  }).length;
}

function matchesNoticeFilters(notice: NoticeRecord, filters: NoticeFilters): boolean {
  return (
    (!filters.region || textFromUnknown(notice.org_nm) === filters.region) &&
    (!filters.animalType || textFromUnknown(notice.up_kind_nm) === filters.animalType) &&
    (!filters.rescueWindowLabel ||
      textFromUnknown(notice.rescue_window_label) === filters.rescueWindowLabel)
  );
}

function compareUrgency(a: NoticeRecord, b: NoticeRecord): number {
  return (
    numberFromUnknown(a.days_left) - numberFromUnknown(b.days_left) ||
    compareNoticeDeadline(a, b)
  );
}

function compareNoticeDeadline(a: NoticeRecord, b: NoticeRecord): number {
  return (
    textFromUnknown(a.notice_edt).localeCompare(textFromUnknown(b.notice_edt)) ||
    textFromUnknown(a.desertion_no).localeCompare(textFromUnknown(b.desertion_no))
  );
}

function buildMeta(
  source: NoticeSource,
  origin: NoticeMeta["origin"],
  options: RequestOptions,
  views: NoticeViews,
  diagnostics: NoticeDiagnostics,
  warning?: string,
): NoticeMeta {
  return {
    source,
    origin,
    fetchedAt: new Date().toISOString(),
    dateRange: {
      bgnde: options.bgnde,
      endde: options.endde,
      ...(options.bgupd ? { bgupd: options.bgupd } : {}),
      ...(options.enupd ? { enupd: options.enupd } : {}),
    },
    state: options.state,
    requestState: options.state,
    pageNo: options.pageNo,
    numOfRows: options.numOfRows,
    itemCount: diagnostics.itemCount,
    filteredCount: diagnostics.filteredCount,
    returnedCount: views.currentNotices.length,
    urgentCount: diagnostics.urgentCount,
    pagesFetched: diagnostics.pagesFetched,
    upstreamTotalCount: diagnostics.upstreamTotalCount,
    responseFormat: diagnostics.responseFormat,
    truncated:
      diagnostics.truncated ||
      diagnostics.filteredCount > views.currentNotices.length ||
      diagnostics.urgentCount > views.urgentNotices.length,
    viewLimit: MAX_VIEW_ROWS,
    ...(diagnostics.fallbackReason
      ? { fallbackReason: diagnostics.fallbackReason }
      : {}),
    ...(warning ? { warning } : {}),
    counts: {
      current: views.currentNotices.length,
      urgent: views.urgentNotices.length,
      protected: views.protectedAnimals.length,
      expired: views.expiredRecords.length,
    },
  };
}

function parseFilters(query: Record<string, QueryValue>): NoticeFilters {
  return {
    ...optionalFilter("region", query.region),
    ...optionalFilter("animalType", query.animalType),
    ...optionalFilter("rescueWindowLabel", query.rescueWindowLabel),
  };
}

function optionalFilter(
  key: keyof NoticeFilters,
  value: QueryValue,
): NoticeFilters {
  const parsedValue = firstQueryValue(value);
  return parsedValue ? { [key]: parsedValue } : {};
}

function addExactFilter(
  whereClauses: string[],
  values: Array<string | number>,
  columnName: "org_nm" | "up_kind_nm" | "rescue_window_label",
  value: string | undefined,
): void {
  if (!value) {
    return;
  }

  values.push(value);
  whereClauses.push(`${columnName} = $${values.length}`);
}

function parsePositiveInteger(
  value: QueryValue,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(firstQueryValue(value) || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}

function parseDateQuery(value: QueryValue, fallback: string): string {
  return normalizeDate(firstQueryValue(value)) || fallback;
}

function optionalDateQuery(
  key: "bgupd" | "enupd",
  value: QueryValue,
): Partial<Pick<RequestOptions, "bgupd" | "enupd">> {
  const date = normalizeDate(firstQueryValue(value));
  return date ? { [key]: date } : {};
}

function firstQueryValue(value: QueryValue): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();
  return trimmed || undefined;
}

function normalizeDate(value: unknown): string | null {
  const text = textFromUnknown(value);
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 8) {
    return null;
  }

  const normalized = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return isValidDate(normalized) ? normalized : null;
}

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function differenceInDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function deadlineStatusFor(daysLeft: number): DeadlineStatus {
  if (daysLeft < 0) {
    return "expired";
  }
  if (daysLeft === 0) {
    return "D-Day";
  }
  if (daysLeft <= 3) {
    return `D-${daysLeft}` as DeadlineStatus;
  }
  return "active";
}

function rescueWindowLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    return "종료/확인 필요";
  }
  if (daysLeft <= 1) {
    return "긴급 확인";
  }
  if (daysLeft <= 3) {
    return "곧 종료";
  }
  if (daysLeft <= 7) {
    return "확인 필요";
  }
  return "여유 있음";
}

function rescueWindowScore(daysLeft: number, hasPhoto: boolean, hasCareTel: boolean): number {
  const baseScore =
    daysLeft < 0 ? 0 : daysLeft <= 1 ? 80 : daysLeft <= 3 ? 65 : daysLeft <= 7 ? 45 : 25;
  return Math.min(100, baseScore + (hasPhoto ? 0 : 10) + (hasCareTel ? 0 : 10));
}

function compactDate(value: string): string {
  return value.replace(/-/g, "");
}

function normalizeServiceKeyForQuery(serviceKey: string): string {
  const trimmed = serviceKey.trim().replace(/^["']|["']$/g, "");
  if (!/%[0-9a-f]{2}/i.test(trimmed)) {
    return trimmed;
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function extractJsonItems(data: unknown): Record<string, unknown>[] {
  const candidates = [
    nestedGet(data, ["response", "body", "items", "item"]),
    nestedGet(data, ["body", "items", "item"]),
    nestedGet(data, ["items", "item"]),
    nestedGet(data, ["items"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
    if (isRecord(candidate)) {
      return [candidate];
    }
  }
  return [];
}

function readNestedText(data: unknown, paths: string[][]): string {
  for (const path of paths) {
    const value = textFromUnknown(nestedGet(data, path));
    if (value) {
      return value;
    }
  }
  return "";
}

function readNestedNumber(data: unknown, paths: string[][]): number | undefined {
  for (const path of paths) {
    const parsed = Number(nestedGet(data, path));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function nestedGet(data: unknown, path: string[]): unknown {
  let current = data;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function extractXmlTagText(text: string, tagName: string): string {
  const match = new RegExp(
    `<(?:[A-Za-z0-9_:-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_:-]+:)?${tagName}>`,
    "i",
  ).exec(text);
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() || "";
}

function nullableText(value: unknown): string | null {
  return textFromUnknown(value) || null;
}

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function numberFromUnknown(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/serviceKey=([^&\s<>"']+)/gi, "serviceKey=[redacted]")
    .replace(/serviceKey%3D([^&\s<>"']+)/gi, "serviceKey%3D[redacted]")
    .slice(0, 400);
}
