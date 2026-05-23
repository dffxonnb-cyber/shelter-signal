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

export async function loadExportedAppData(): Promise<ExportedAppData> {
  const [animalRows, regionSummaries, rescueWindowSummaries] = await Promise.all([
    fetchJsonArray<ExportedAnimalRecord>("/data/animals.json"),
    fetchJsonArray<RegionSummaryRecord>("/data/region_summary.json"),
    fetchJsonArray<RescueWindowSummaryRecord>("/data/rescue_window_summary.json"),
  ]);

  return {
    animals: animalRows.map(toMockAnimalShape),
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
