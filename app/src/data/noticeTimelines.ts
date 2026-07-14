import type { ChangeNoticeSnapshot, NoticeChangeEvent } from "./changeEvents";

export interface NoticeTimelineRecord {
  noticeKey: string;
  notice: ChangeNoticeSnapshot | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  firstObservationDate: string | null;
  lastObservationDate: string | null;
  eventCount: number;
  eventTypes: Record<string, number>;
  events: NoticeChangeEvent[];
}

export interface NoticeTimelinePayload {
  schemaVersion: string;
  updatedAt: string;
  latestObservationDate: string | null;
  noticeCount: number;
  eventCount: number;
  timelines: Record<string, NoticeTimelineRecord>;
  claimBoundary: string[];
}

export async function loadNoticeTimeline(noticeKey: string): Promise<{
  payload: NoticeTimelinePayload;
  timeline: NoticeTimelineRecord;
}> {
  const response = await fetch("/data/notice-timelines.json", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`/data/notice-timelines.json returned ${response.status}`);
  }

  const payload = normalizePayload(await response.json());
  const timeline = payload.timelines[noticeKey];
  if (!timeline) {
    throw new Error("선택한 공고의 누적 타임라인이 아직 생성되지 않았습니다.");
  }

  return { payload, timeline };
}

function normalizePayload(value: unknown): NoticeTimelinePayload {
  const payload = requireRecord(value, "notice-timelines.json");
  const timelinesValue = requireRecord(payload.timelines, "notice timelines");
  const timelines: Record<string, NoticeTimelineRecord> = {};

  for (const [noticeKey, rawTimeline] of Object.entries(timelinesValue)) {
    const timeline = requireRecord(rawTimeline, `timeline ${noticeKey}`);
    timelines[noticeKey] = {
      noticeKey,
      notice: normalizeNotice(timeline.notice),
      firstObservedAt: nullableText(timeline.firstObservedAt),
      lastObservedAt: nullableText(timeline.lastObservedAt),
      firstObservationDate: nullableText(timeline.firstObservationDate),
      lastObservationDate: nullableText(timeline.lastObservationDate),
      eventCount: numberValue(timeline.eventCount),
      eventTypes: normalizeNumberRecord(timeline.eventTypes),
      events: Array.isArray(timeline.events)
        ? timeline.events.map((event, index) => normalizeEvent(event, index))
        : [],
    };
  }

  return {
    schemaVersion: text(payload.schemaVersion),
    updatedAt: text(payload.updatedAt),
    latestObservationDate: nullableText(payload.latestObservationDate),
    noticeCount: numberValue(payload.noticeCount),
    eventCount: numberValue(payload.eventCount),
    timelines,
    claimBoundary: Array.isArray(payload.claimBoundary)
      ? payload.claimBoundary.map(text).filter(Boolean)
      : [],
  };
}

function normalizeEvent(value: unknown, index: number): NoticeChangeEvent {
  const event = requireRecord(value, `timeline event ${index}`);
  const notice = normalizeNotice(event.notice) || emptyNotice();
  const changes = Array.isArray(event.changes)
    ? event.changes.map((rawChange) => {
        const change = requireRecord(rawChange, "timeline field change");
        return {
          field: text(change.field),
          before: primitive(change.before ?? change.previous),
          after: primitive(change.after ?? change.current),
        };
      })
    : [];

  return {
    eventId: text(event.eventId) || `timeline-event-${index}`,
    type: text(event.type) as NoticeChangeEvent["type"],
    observedAt: text(event.observedAt),
    observationDate: text(event.observationDate),
    snapshotId: text(event.snapshotId),
    noticeKey: text(event.noticeKey),
    notice,
    changes,
  };
}

function normalizeNotice(value: unknown): ChangeNoticeSnapshot | null {
  if (!isRecord(value)) return null;
  return {
    desertion_no: nullableText(value.desertion_no),
    notice_no: nullableText(value.notice_no),
    happen_dt: nullableText(value.happen_dt),
    notice_sdt: nullableText(value.notice_sdt),
    notice_edt: nullableText(value.notice_edt),
    kind_full_nm: nullableText(value.kind_full_nm),
    process_state: nullableText(value.process_state),
    care_nm: nullableText(value.care_nm),
    org_nm: nullableText(value.org_nm),
    days_left: nullableNumber(value.days_left),
    deadline_status: nullableText(value.deadline_status),
  };
}

function emptyNotice(): ChangeNoticeSnapshot {
  return {
    desertion_no: null,
    notice_no: null,
    happen_dt: null,
    notice_sdt: null,
    notice_edt: null,
    kind_full_nm: null,
    process_state: null,
    care_nm: null,
    org_nm: null,
    days_left: null,
    deadline_status: null,
  };
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, count]) => [key, numberValue(count)]));
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} did not return an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const normalized = text(value).trim();
  return normalized || null;
}

function numberValue(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function primitive(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}
