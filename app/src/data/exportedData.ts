import {
  MockAnimal,
  RescueWindowLabel,
  mockAnimals,
  rescueWindowLabels,
} from "./mockAnimals";

export interface ExportedAnimalRecord {
  desertion_no: string | null;
  notice_no: string | null;
  happen_dt: string | null;
  happen_place: string | null;
  notice_sdt: string | null;
  notice_edt: string | null;
  days_until_notice_end: number | null;
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

export interface ExportedAppData {
  animals: MockAnimal[];
  regionSummaries: RegionSummaryRecord[];
  rescueWindowSummaries: RescueWindowSummaryRecord[];
}

export type AppDataSource = "operational" | "exported" | "fallback";

export interface LoadedAppData extends ExportedAppData {
  source: AppDataSource;
  errorMessage?: string;
}

export async function loadAppData(): Promise<LoadedAppData> {
  const errors: string[] = [];

  try {
    return {
      ...(await loadOperationalAppData()),
      source: "operational",
    };
  } catch (error) {
    errors.push(`Operational DB unavailable: ${errorMessage(error)}`);
  }

  try {
    return {
      ...(await loadExportedAppData()),
      source: "exported",
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
  const [animalRows, regionSummaries, rescueWindowSummaries] = await Promise.all([
    fetchJsonArray<unknown>("/data/animals.json"),
    fetchJsonArray<RegionSummaryRecord>("/data/region_summary.json"),
    fetchJsonArray<RescueWindowSummaryRecord>("/data/rescue_window_summary.json"),
  ]);

  return {
    animals: animalRows.map((record, index) =>
      toMockAnimalShape(normalizeAnimalRecord(record), index)
    ),
    regionSummaries,
    rescueWindowSummaries,
  };
}

export const fallbackAppData: ExportedAppData = {
  animals: mockAnimals,
  regionSummaries: [],
  rescueWindowSummaries: [],
};

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
  const notices = await fetchOperationalNotices();

  return {
    animals: notices.map((record, index) => toMockAnimalShape(record, index)),
    regionSummaries: [],
    rescueWindowSummaries: [],
  };
}

async function fetchOperationalNotices(): Promise<ExportedAnimalRecord[]> {
  const response = await fetch("/api/notices?limit=100", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await parseJsonResponse(response, "/api/notices");

  if (!isRecord(payload) || payload.ok !== true) {
    const code = isRecord(payload) ? textFromUnknown(payload.code) : "";
    throw new Error(code || "/api/notices did not return ok: true");
  }

  if (!Array.isArray(payload.notices)) {
    throw new Error("/api/notices did not return a notices array");
  }

  if (!payload.notices.length) {
    throw new Error("/api/notices returned an empty notices array");
  }

  return payload.notices.map(normalizeAnimalRecord);
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
      [label, `returned ${response.status}`, code, message].filter(Boolean).join(" ")
    );
  }

  return payload;
}

function normalizeAnimalRecord(value: unknown): ExportedAnimalRecord {
  const record = isRecord(value) ? value : {};

  return {
    desertion_no: nullableText(record.desertion_no),
    notice_no: nullableText(record.notice_no),
    happen_dt: nullableText(record.happen_dt),
    happen_place: nullableText(record.happen_place),
    notice_sdt: nullableText(record.notice_sdt),
    notice_edt: nullableText(record.notice_edt),
    days_until_notice_end: nullableNumber(record.days_until_notice_end),
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
  const label = normalizeLabel(record.rescue_window_label);
  const score = numberOr(record.rescue_window_score, 0);
  const daysUntilNoticeEnd = numberOr(record.days_until_notice_end, 0);
  const animalType = normalizeAnimalType(record.up_kind_nm);
  const breed = textOr(record.kind_nm, "품종 미상");
  const hasPhoto = Boolean(record.has_photo);

  return {
    id: textOr(record.desertion_no, `exported-${index}`),
    desertionNo: textOr(record.desertion_no, "미상"),
    noticeNo: textOr(record.notice_no, "공고번호 미상"),
    happenDate: textOr(record.happen_dt, "미상"),
    happenPlace: textOr(record.happen_place, "발견 위치 미상"),
    noticeStartDate: textOr(record.notice_sdt, "미상"),
    noticeEndDate: textOr(record.notice_edt, "미상"),
    daysUntilNoticeEnd,
    ddayText: formatDday(daysUntilNoticeEnd),
    deadlineBucket: textOr(record.deadline_bucket, "미상"),
    rescueWindowScore: score,
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

function normalizeLabel(value: string | null): RescueWindowLabel {
  return rescueWindowLabels.find((label) => label === value) ?? "확인 필요";
}

function normalizeAnimalType(value: string | null): MockAnimal["animalType"] {
  if (value === "개" || value === "고양이" || value === "기타축종") {
    return value;
  }
  return "기타축종";
}

function formatDday(days: number): string {
  if (days === 0) {
    return "D-Day";
  }
  if (days > 0) {
    return `D-${days}`;
  }
  return `D+${Math.abs(days)}`;
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
  if (value === "N") {
    return "미상";
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

function textOr(value: string | null, fallback: string): string {
  const text = value?.trim();
  return text || fallback;
}

function numberOr(value: number | null, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
