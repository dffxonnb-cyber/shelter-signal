import {
  MOCK_REFERENCE_DATE,
  MockAnimal,
  RescueWindowLabel,
  mockAnimals,
} from "./mockAnimals";

export type DeadlineStatus = NonNullable<MockAnimal["deadlineStatus"]>;
export type AppDataSource = "api" | "fallback";
export type NoticeView = "current" | "urgent" | "protected" | "archive";
export type AppDataOrigin =
  | "public-api"
  | "operational-postgres"
  | "static-export"
  | "mock";

export interface ExportedAnimalRecord {
  desertion_no: string | null;
  notice_no: string | null;
  happen_dt: string | null;
  happen_place: string | null;
  notice_sdt: string | null;
  notice_edt: string | null;
  days_until_notice_end: number | null;
  days_left: number | null;
  deadline_status: DeadlineStatus | null;
  deadline_bucket: string | null;
  rescue_window_score: number | null;
  rescue_window_label: string | null;
  kind_full_nm: string | null;
  up_kind_nm: string | null;
  kind_nm: string | null;
  color_cd: string | null;
  age: string | null;
  weight: string | null;
  popfile1: string | null;
  popfile2: string | null;
  process_state: string | null;
  sex_cd: string | null;
  neuter_yn: string | null;
  special_mark: string | null;
  care_nm: string | null;
  care_tel: string | null;
  care_addr: string | null;
  org_nm: string | null;
  has_photo: boolean | null;
  has_care_tel: boolean | null;
}

export interface RegionSummaryRecord {
  org_nm: string;
  animal_count: number;
  active_notice_count: number;
  urgent_count: number;
  ending_soon_count: number;
  avg_rescue_window_score: number;
  earliest_notice_end: string | null;
  latest_collected_at?: string | null;
}

export interface RescueWindowSummaryRecord {
  rescue_window_label: RescueWindowLabel;
  deadline_bucket: string;
  animal_count: number;
  active_notice_count: number;
  with_photo_count: number;
  with_care_tel_count: number;
  avg_rescue_window_score: number;
  min_days_until_notice_end: number | null;
  max_days_until_notice_end: number | null;
}

export interface FreshnessMeta {
  source: AppDataSource;
  origin: AppDataOrigin;
  fetchedAt: string;
  dateRange: {
    bgnde: string;
    endde: string;
    bgupd?: string;
    enupd?: string;
  };
  state: string;
  requestState?: string;
  view?: NoticeView;
  region?: string;
  limit?: number;
  page?: number;
  itemCount?: number;
  filteredCount?: number;
  returnedCount?: number;
  totalFilteredCount?: number;
  hasMore?: boolean;
  nextPage?: number;
  urgentCount?: number;
  pagesFetched?: number;
  upstreamTotalCount?: number;
  responseFormat?: string;
  truncated?: boolean;
  viewLimit?: number;
  cacheStatus?: "hit" | "miss" | "disabled";
  cacheTtlSeconds?: number;
  cacheGeneratedAt?: string;
  cacheAgeSeconds?: number;
  cacheStale?: boolean;
  cacheRefreshError?: string;
  cacheScope?: string;
  upstreamFetchDurationMs?: number;
  upstreamFetchCount?: number;
  normalizedItemCount?: number;
  inFlightMerged?: boolean;
  fallbackReason?: string;
  warning?: string;
  counts?: {
    current: number;
    urgent: number;
    protected: number;
    expired: number;
  };
}

export interface NoticeViews {
  currentNotices: MockAnimal[];
  urgentNotices: MockAnimal[];
  protectedAnimals: MockAnimal[];
  expiredRecords: MockAnimal[];
}

export interface ExportedAppData extends NoticeViews {
  animals: MockAnimal[];
  regionSummaries: RegionSummaryRecord[];
  rescueWindowSummaries: RescueWindowSummaryRecord[];
  meta: FreshnessMeta;
}

export interface LoadedAppData extends ExportedAppData {
  source: AppDataSource;
  errorMessage?: string;
}

export interface NoticePageQuery {
  view: NoticeView;
  region?: string;
  animalType?: string;
  rescueWindowLabel?: string;
  page?: number;
  limit?: number;
}

export interface LoadedNoticePage {
  notices: MockAnimal[];
  meta: FreshnessMeta;
  source: AppDataSource;
}

const FALLBACK_WARNING =
  "공공데이터 API 응답이 불안정하여 샘플 데이터를 표시 중입니다. 실시간 공고가 아닐 수 있습니다.";

export async function loadAppData(): Promise<LoadedAppData> {
  const errors: string[] = [];

  try {
    const operationalData = await loadOperationalAppData();
    return {
      ...operationalData,
      source: operationalData.meta.source,
      ...(operationalData.meta.warning
        ? { errorMessage: operationalData.meta.warning }
        : {}),
    };
  } catch (error) {
    errors.push(`Notice API unavailable: ${errorMessage(error)}`);
  }

  try {
    const exportedData = await loadExportedAppData();
    return {
      ...exportedData,
      source: "fallback",
      errorMessage: errors.join(" "),
    };
  } catch (error) {
    errors.push(`Static export unavailable: ${errorMessage(error)}`);
  }

  return {
    ...fallbackAppData,
    source: "fallback",
    errorMessage: errors.join(" "),
  };
}

export async function loadExportedAppData(): Promise<ExportedAppData> {
  const animalRows = await fetchJsonArray<unknown>("/data/animals.json");
  const animals = animalRows.map((record, index) =>
    toMockAnimalShape(normalizeAnimalRecord(record), index),
  );

  return buildAppData(animals, fallbackMeta("static-export"));
}

export const fallbackAppData: ExportedAppData = buildAppData(
  mockAnimals.map(refreshMockAnimal),
  fallbackMeta("mock"),
);

async function fetchJsonArray<T>(path: string): Promise<T[]> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`${path} did not return a JSON array`);
  }
  return payload as T[];
}

async function loadOperationalAppData(): Promise<ExportedAppData> {
  const payload = await fetchOperationalNotices({ view: "current", limit: 20 });
  const views = normalizeApiViews(payload);
  const meta = normalizeApiMeta(payload.meta, payload.source);

  return {
    animals: views.currentNotices,
    ...views,
    regionSummaries: [],
    rescueWindowSummaries: [],
    meta,
  };
}

export async function loadNoticePage(query: NoticePageQuery): Promise<LoadedNoticePage> {
  const payload = await fetchOperationalNotices(query);
  const source: AppDataSource = payload.source === "api" ? "api" : "fallback";
  return {
    notices: normalizeAnimalArray(payload.notices),
    meta: normalizeApiMeta(payload.meta, payload.source),
    source,
  };
}

async function fetchOperationalNotices(
  query: Partial<NoticePageQuery> = {},
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (query.view) params.set("view", query.view);
  if (query.region) params.set("region", query.region);
  if (query.animalType) params.set("animalType", query.animalType);
  if (query.rescueWindowLabel) params.set("rescueWindowLabel", query.rescueWindowLabel);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const queryString = params.toString();
  const path = `/api/notices${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await parseJsonResponse(response, path);

  if (!isRecord(payload) || payload.ok !== true) {
    const code = isRecord(payload) ? textFromUnknown(payload.code) : "";
    throw new Error(code || "/api/notices did not return ok: true");
  }

  return payload;
}

function normalizeApiViews(payload: Record<string, unknown>): NoticeViews {
  if (isRecord(payload.views)) {
    return {
      currentNotices: normalizeAnimalArray(payload.views.currentNotices),
      urgentNotices: normalizeAnimalArray(payload.views.urgentNotices),
      protectedAnimals: normalizeAnimalArray(payload.views.protectedAnimals),
      expiredRecords: normalizeAnimalArray(payload.views.expiredRecords),
    };
  }

  if (!Array.isArray(payload.notices)) {
    throw new Error("/api/notices did not return notice views");
  }

  const animals = normalizeAnimalArray(payload.notices);
  return buildNoticeViews(animals);
}

function normalizeAnimalArray(value: unknown): MockAnimal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((record, index) => toMockAnimalShape(normalizeAnimalRecord(record), index));
}

function normalizeApiMeta(value: unknown, sourceValue: unknown): FreshnessMeta {
  const meta = isRecord(value) ? value : {};
  const dateRange = isRecord(meta.dateRange) ? meta.dateRange : {};
  const source: AppDataSource = sourceValue === "api" ? "api" : "fallback";
  const originValue = textFromUnknown(meta.origin);
  const origin: AppDataOrigin =
    originValue === "public-api" || originValue === "operational-postgres"
      ? originValue
      : source === "api"
        ? "public-api"
        : "operational-postgres";

  return {
    source,
    origin,
    fetchedAt: textFromUnknown(meta.fetchedAt) || new Date().toISOString(),
    dateRange: {
      bgnde: normalizeDate(dateRange.bgnde) || rollingDateRange().bgnde,
      endde: normalizeDate(dateRange.endde) || rollingDateRange().endde,
      ...(normalizeDate(dateRange.bgupd) ? { bgupd: normalizeDate(dateRange.bgupd)! } : {}),
      ...(normalizeDate(dateRange.enupd) ? { enupd: normalizeDate(dateRange.enupd)! } : {}),
    },
    state: textFromUnknown(meta.state) || "notice",
    requestState: textFromUnknown(meta.requestState) || textFromUnknown(meta.state) || "notice",
    view: normalizeNoticeView(meta.view),
    ...(textFromUnknown(meta.region) ? { region: textFromUnknown(meta.region) } : {}),
    ...(nullableNumber(meta.limit) !== null ? { limit: nullableNumber(meta.limit)! } : {}),
    ...(nullableNumber(meta.page) !== null ? { page: nullableNumber(meta.page)! } : {}),
    ...(nullableNumber(meta.itemCount) !== null
      ? { itemCount: nullableNumber(meta.itemCount)! }
      : {}),
    ...(nullableNumber(meta.filteredCount) !== null
      ? { filteredCount: nullableNumber(meta.filteredCount)! }
      : {}),
    ...(nullableNumber(meta.returnedCount) !== null
      ? { returnedCount: nullableNumber(meta.returnedCount)! }
      : {}),
    ...(nullableNumber(meta.totalFilteredCount) !== null
      ? { totalFilteredCount: nullableNumber(meta.totalFilteredCount)! }
      : {}),
    ...(nullableBoolean(meta.hasMore) !== null
      ? { hasMore: nullableBoolean(meta.hasMore)! }
      : {}),
    ...(nullableNumber(meta.nextPage) !== null
      ? { nextPage: nullableNumber(meta.nextPage)! }
      : {}),
    ...(nullableNumber(meta.urgentCount) !== null
      ? { urgentCount: nullableNumber(meta.urgentCount)! }
      : {}),
    ...(nullableNumber(meta.pagesFetched) !== null
      ? { pagesFetched: nullableNumber(meta.pagesFetched)! }
      : {}),
    ...(nullableNumber(meta.upstreamTotalCount) !== null
      ? { upstreamTotalCount: nullableNumber(meta.upstreamTotalCount)! }
      : {}),
    ...(textFromUnknown(meta.responseFormat)
      ? { responseFormat: textFromUnknown(meta.responseFormat) }
      : {}),
    ...(nullableBoolean(meta.truncated) !== null
      ? { truncated: nullableBoolean(meta.truncated)! }
      : {}),
    ...(nullableNumber(meta.viewLimit) !== null
      ? { viewLimit: nullableNumber(meta.viewLimit)! }
      : {}),
    ...(normalizeCacheStatus(meta.cacheStatus)
      ? { cacheStatus: normalizeCacheStatus(meta.cacheStatus)! }
      : {}),
    ...(nullableNumber(meta.cacheTtlSeconds) !== null
      ? { cacheTtlSeconds: nullableNumber(meta.cacheTtlSeconds)! }
      : {}),
    ...(textFromUnknown(meta.cacheGeneratedAt)
      ? { cacheGeneratedAt: textFromUnknown(meta.cacheGeneratedAt) }
      : {}),
    ...(nullableNumber(meta.cacheAgeSeconds) !== null
      ? { cacheAgeSeconds: nullableNumber(meta.cacheAgeSeconds)! }
      : {}),
    ...(nullableBoolean(meta.cacheStale) !== null
      ? { cacheStale: nullableBoolean(meta.cacheStale)! }
      : {}),
    ...(textFromUnknown(meta.cacheRefreshError)
      ? { cacheRefreshError: textFromUnknown(meta.cacheRefreshError) }
      : {}),
    ...(textFromUnknown(meta.cacheScope)
      ? { cacheScope: textFromUnknown(meta.cacheScope) }
      : {}),
    ...(nullableNumber(meta.upstreamFetchDurationMs) !== null
      ? { upstreamFetchDurationMs: nullableNumber(meta.upstreamFetchDurationMs)! }
      : {}),
    ...(nullableNumber(meta.upstreamFetchCount) !== null
      ? { upstreamFetchCount: nullableNumber(meta.upstreamFetchCount)! }
      : {}),
    ...(nullableNumber(meta.normalizedItemCount) !== null
      ? { normalizedItemCount: nullableNumber(meta.normalizedItemCount)! }
      : {}),
    ...(nullableBoolean(meta.inFlightMerged) !== null
      ? { inFlightMerged: nullableBoolean(meta.inFlightMerged)! }
      : {}),
    ...(textFromUnknown(meta.fallbackReason)
      ? { fallbackReason: textFromUnknown(meta.fallbackReason) }
      : {}),
    ...(textFromUnknown(meta.warning) ? { warning: textFromUnknown(meta.warning) } : {}),
    ...(normalizeCounts(meta.counts) ? { counts: normalizeCounts(meta.counts)! } : {}),
  };
}

async function parseJsonResponse(response: Response, label: string): Promise<unknown> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${errorMessage(error)}`);
  }

  if (!response.ok) {
    const code = isRecord(payload) ? textFromUnknown(payload.code) : "";
    const message = isRecord(payload) ? textFromUnknown(payload.message) : "";
    throw new Error(
      [label, `returned ${response.status}`, code, message].filter(Boolean).join(" "),
    );
  }

  return payload;
}

function normalizeAnimalRecord(value: unknown): ExportedAnimalRecord {
  const record = isRecord(value) ? value : {};

  return {
    desertion_no: nullableText(record.desertion_no),
    notice_no: nullableText(record.notice_no),
    happen_dt: normalizeDate(record.happen_dt),
    happen_place: nullableText(record.happen_place),
    notice_sdt: normalizeDate(record.notice_sdt),
    notice_edt: normalizeDate(record.notice_edt),
    days_until_notice_end: nullableNumber(record.days_until_notice_end),
    days_left: nullableNumber(record.days_left),
    deadline_status: normalizeDeadlineStatus(record.deadline_status),
    deadline_bucket: nullableText(record.deadline_bucket),
    rescue_window_score: nullableNumber(record.rescue_window_score),
    rescue_window_label: nullableText(record.rescue_window_label),
    kind_full_nm: nullableText(record.kind_full_nm),
    up_kind_nm: nullableText(record.up_kind_nm),
    kind_nm: nullableText(record.kind_nm),
    color_cd: nullableText(record.color_cd),
    age: nullableText(record.age),
    weight: nullableText(record.weight),
    popfile1: nullableText(record.popfile1),
    popfile2: nullableText(record.popfile2),
    process_state: nullableText(record.process_state),
    sex_cd: nullableText(record.sex_cd),
    neuter_yn: nullableText(record.neuter_yn),
    special_mark: nullableText(record.special_mark),
    care_nm: nullableText(record.care_nm),
    care_tel: nullableText(record.care_tel),
    care_addr: nullableText(record.care_addr),
    org_nm: nullableText(record.org_nm),
    has_photo: nullableBoolean(record.has_photo),
    has_care_tel: nullableBoolean(record.has_care_tel),
  };
}

function toMockAnimalShape(record: ExportedAnimalRecord, index: number): MockAnimal {
  const noticeEndDate = textOr(record.notice_edt, "미상");
  const daysUntilNoticeEnd =
    noticeEndDate === "미상" ? -1 : differenceInDays(todayInSeoul(), noticeEndDate);
  const deadlineStatus = deadlineStatusFor(daysUntilNoticeEnd);
  const label = rescueWindowLabel(daysUntilNoticeEnd);
  const hasPhoto = Boolean(record.has_photo || record.popfile1 || record.popfile2);
  const hasCareTel = Boolean(record.has_care_tel || record.care_tel);
  const animalType = normalizeAnimalType(record.up_kind_nm);
  const breed = textOr(record.kind_nm, "품종 미상");

  return {
    id: textOr(record.desertion_no, `exported-${index}`),
    desertionNo: textOr(record.desertion_no, "미상"),
    noticeNo: textOr(record.notice_no, "공고번호 미상"),
    happenDate: textOr(record.happen_dt, "미상"),
    happenPlace: textOr(record.happen_place, "발견 위치 미상"),
    noticeStartDate: textOr(record.notice_sdt, "미상"),
    noticeEndDate,
    daysUntilNoticeEnd,
    deadlineStatus,
    ddayText: deadlineStatus,
    deadlineBucket: deadlineStatus,
    rescueWindowScore: rescueWindowScore(daysUntilNoticeEnd, hasPhoto, hasCareTel),
    rescueWindowLabel: label,
    animalType,
    breed,
    kindFullName: textOr(record.kind_full_nm, `[${animalType}] ${breed}`),
    color: textOr(record.color_cd, "미상"),
    age: textOr(record.age, "미상"),
    weight: textOr(record.weight, "미상"),
    sex: formatSex(record.sex_cd),
    neuterYn: formatNeuter(record.neuter_yn),
    processState: textOr(record.process_state, "상태 미상"),
    region: textOr(record.org_nm, "지역 미상"),
    shelterName: textOr(record.care_nm, "보호소 미상"),
    shelterTel: record.care_tel || null,
    shelterAddress: textOr(record.care_addr, "주소 미상"),
    specialMark: textOr(record.special_mark, "특이사항 없음"),
    hasPhoto,
    photoTone: photoToneFor(index, hasPhoto),
  };
}

function refreshMockAnimal(animal: MockAnimal): MockAnimal {
  const today = todayInSeoul();
  const noticeEndDate = shiftDate(
    today,
    differenceInDays(MOCK_REFERENCE_DATE, animal.noticeEndDate),
  );
  const noticeStartDate = shiftDate(
    today,
    differenceInDays(MOCK_REFERENCE_DATE, animal.noticeStartDate),
  );
  const happenDate = shiftDate(
    today,
    differenceInDays(MOCK_REFERENCE_DATE, animal.happenDate),
  );
  const daysUntilNoticeEnd = differenceInDays(today, noticeEndDate);
  const deadlineStatus = deadlineStatusFor(daysUntilNoticeEnd);
  const hasCareTel = Boolean(animal.shelterTel);

  return {
    ...animal,
    happenDate,
    noticeStartDate,
    noticeEndDate,
    daysUntilNoticeEnd,
    deadlineStatus,
    ddayText: deadlineStatus,
    deadlineBucket: deadlineStatus,
    rescueWindowScore: rescueWindowScore(daysUntilNoticeEnd, animal.hasPhoto, hasCareTel),
    rescueWindowLabel: rescueWindowLabel(daysUntilNoticeEnd),
  };
}

function buildAppData(animals: MockAnimal[], meta: FreshnessMeta): ExportedAppData {
  const views = buildNoticeViews(animals);
  return {
    animals: views.currentNotices,
    ...views,
    regionSummaries: [],
    rescueWindowSummaries: [],
    meta: {
      ...meta,
      requestState: meta.requestState || meta.state,
      view: meta.view || "current",
      limit: meta.limit ?? views.currentNotices.length,
      page: meta.page ?? 1,
      itemCount: meta.itemCount ?? animals.length,
      filteredCount: meta.filteredCount ?? views.currentNotices.length,
      returnedCount: meta.returnedCount ?? views.currentNotices.length,
      totalFilteredCount: meta.totalFilteredCount ?? views.currentNotices.length,
      hasMore: meta.hasMore ?? false,
      urgentCount: meta.urgentCount ?? views.urgentNotices.length,
      pagesFetched: meta.pagesFetched ?? 0,
      upstreamTotalCount: meta.upstreamTotalCount ?? animals.length,
      responseFormat: meta.responseFormat || "fallback",
      truncated: meta.truncated ?? false,
      viewLimit: meta.viewLimit ?? views.currentNotices.length,
      cacheStatus: meta.cacheStatus ?? "disabled",
      cacheTtlSeconds: meta.cacheTtlSeconds ?? 0,
      counts:
        meta.counts ?? {
          current: views.currentNotices.length,
          urgent: views.urgentNotices.length,
          protected: views.protectedAnimals.length,
          expired: views.expiredRecords.length,
        },
    },
  };
}

function buildNoticeViews(animals: MockAnimal[]): NoticeViews {
  const currentNotices = animals
    .filter(
      (animal) =>
        animal.deadlineStatus !== "expired" && !animal.processState.startsWith("종료"),
    )
    .sort(compareDeadline);
  return {
    currentNotices,
    urgentNotices: currentNotices
      .filter((animal) => animal.daysUntilNoticeEnd >= 0 && animal.daysUntilNoticeEnd <= 3)
      .sort(compareDeadline),
    protectedAnimals: currentNotices.filter((animal) => animal.processState.includes("보호")),
    expiredRecords: animals
      .filter(
        (animal) =>
          animal.deadlineStatus === "expired" || animal.processState.startsWith("종료"),
      )
      .sort(compareDeadline),
  };
}

function compareDeadline(a: MockAnimal, b: MockAnimal): number {
  return a.noticeEndDate.localeCompare(b.noticeEndDate) || a.id.localeCompare(b.id);
}

function fallbackMeta(origin: "static-export" | "mock"): FreshnessMeta {
  return {
    source: "fallback",
    origin,
    fetchedAt: new Date().toISOString(),
    dateRange: rollingDateRange(),
    state: "notice",
    cacheStatus: "disabled",
    cacheTtlSeconds: 0,
    warning: FALLBACK_WARNING,
  };
}

function normalizeCacheStatus(
  value: unknown,
): FreshnessMeta["cacheStatus"] | null {
  const status = textFromUnknown(value);
  return status === "hit" || status === "miss" || status === "disabled"
    ? status
    : null;
}

function rollingDateRange(): { bgnde: string; endde: string } {
  const endde = todayInSeoul();
  return {
    bgnde: shiftDate(endde, -30),
    endde,
  };
}

function normalizeDeadlineStatus(value: unknown): DeadlineStatus | null {
  const status = textFromUnknown(value);
  if (
    status === "D-Day" ||
    status === "D-1" ||
    status === "D-2" ||
    status === "D-3" ||
    status === "active" ||
    status === "expired"
  ) {
    return status;
  }
  return null;
}

function normalizeNoticeView(value: unknown): NoticeView {
  const view = textFromUnknown(value);
  if (view === "urgent" || view === "protected" || view === "archive") {
    return view;
  }
  return "current";
}

function normalizeCounts(value: unknown): FreshnessMeta["counts"] | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    current: nullableNumber(value.current) ?? 0,
    urgent: nullableNumber(value.urgent) ?? 0,
    protected: nullableNumber(value.protected) ?? 0,
    expired: nullableNumber(value.expired) ?? 0,
  };
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

function rescueWindowLabel(daysLeft: number): RescueWindowLabel {
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

function normalizeAnimalType(value: string | null): MockAnimal["animalType"] {
  if (value === "개" || value === "고양이" || value === "기타축종") {
    return value;
  }
  return "기타축종";
}

function formatSex(value: string | null): string {
  if (value === "M") {
    return "수컷";
  }
  if (value === "F") {
    return "암컷";
  }
  return "미상";
}

function formatNeuter(value: string | null): string {
  if (value === "Y") {
    return "중성화";
  }
  return "미상";
}

function photoToneFor(index: number, hasPhoto: boolean): MockAnimal["photoTone"] {
  if (!hasPhoto) {
    return "mist";
  }
  const tones: MockAnimal["photoTone"][] = ["sage", "coral", "ink", "gold"];
  return tones[index % tones.length];
}

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
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
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return -1;
  }
  return Math.round((end - start) / 86_400_000);
}

function normalizeDate(value: unknown): string | null {
  const text = textFromUnknown(value);
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 8) {
    return null;
  }
  const normalized = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function textOr(value: string | null, fallback: string): string {
  const text = value?.trim();
  return text || fallback;
}

function nullableText(value: unknown): string | null {
  const text = textFromUnknown(value);
  return text || null;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
