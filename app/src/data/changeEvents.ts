export const CHANGE_EVENT_TYPES = [
  "NEW",
  "DEADLINE_CHANGED",
  "STATUS_CHANGED",
  "BECAME_URGENT",
  "NOT_OBSERVED",
  "DISAPPEARED",
  "RETURNED",
] as const;

export type ChangeEventType = (typeof CHANGE_EVENT_TYPES)[number];

export interface ChangeEventSummary {
  NEW: number;
  DEADLINE_CHANGED: number;
  STATUS_CHANGED: number;
  BECAME_URGENT: number;
  NOT_OBSERVED: number;
  DISAPPEARED: number;
  RETURNED: number;
  total: number;
}

export interface ChangeNoticeSnapshot {
  desertion_no: string | null;
  notice_no: string | null;
  happen_dt: string | null;
  notice_sdt: string | null;
  notice_edt: string | null;
  kind_full_nm: string | null;
  process_state: string | null;
  care_nm: string | null;
  org_nm: string | null;
  days_left: number | null;
  deadline_status: string | null;
}

export interface NoticeFieldChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export interface NoticeChangeEvent {
  eventId: string;
  type: ChangeEventType;
  observedAt: string;
  observationDate: string;
  snapshotId: string;
  noticeKey: string;
  notice: ChangeNoticeSnapshot;
  changes: NoticeFieldChange[];
}

export interface ChangeEventDiagnostics {
  previousNoticeCount: number;
  currentNoticeCount: number;
  skippedPreviousNotices: number;
  skippedCurrentNotices: number;
  duplicatePreviousIdentifiers: number;
  duplicateCurrentIdentifiers: number;
  warnings: string[];
}

export interface ChangeEventPayload {
  schemaVersion: string;
  generatedAt: string;
  generatedAtKst: string;
  observationDate: string;
  snapshotId: string;
  previousSnapshot: {
    snapshotId: string;
    generatedAt: string;
  } | null;
  baseline: boolean;
  observationWindowChanged: boolean;
  summary: ChangeEventSummary;
  diagnostics: ChangeEventDiagnostics;
  events: NoticeChangeEvent[];
}

export interface SnapshotHealthMeta {
  generatedAt: string;
  generatedAtKst: string;
  period: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
  collection: {
    pagesFetched: number;
    upstreamTotalCount: number;
    truncated: boolean;
    responseFormat: string;
  };
  counts: {
    itemCount: number;
    normalizedItemCount: number;
    currentCount: number;
    urgentCount: number;
    protectedCount: number;
    archiveCount: number;
    eventCount: number;
    missingRecordCount: number;
  };
  warnings: string[];
}

export interface ChangeDashboardData {
  events: ChangeEventPayload;
  health: SnapshotHealthMeta;
}

export async function loadChangeDashboardData(): Promise<ChangeDashboardData> {
  const [eventsPayload, healthPayload] = await Promise.all([
    fetchJson("/data/latest-events.json"),
    fetchJson("/data/latest-notices.meta.json"),
  ]);

  return {
    events: normalizeChangeEventPayload(eventsPayload),
    health: normalizeSnapshotHealthMeta(healthPayload),
  };
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

function normalizeChangeEventPayload(value: unknown): ChangeEventPayload {
  const payload = requireRecord(value, "latest-events.json");
  const summary = requireRecord(payload.summary, "latest-events summary");
  const diagnostics = requireRecord(payload.diagnostics, "latest-events diagnostics");
  const previousSnapshot = isRecord(payload.previousSnapshot) ? payload.previousSnapshot : null;

  return {
    schemaVersion: text(payload.schemaVersion),
    generatedAt: text(payload.generatedAt),
    generatedAtKst: text(payload.generatedAtKst),
    observationDate: text(payload.observationDate),
    snapshotId: text(payload.snapshotId),
    previousSnapshot: previousSnapshot
      ? {
          snapshotId: text(previousSnapshot.snapshotId),
          generatedAt: text(previousSnapshot.generatedAt),
        }
      : null,
    baseline: booleanValue(payload.baseline),
    observationWindowChanged: booleanValue(payload.observationWindowChanged),
    summary: normalizeSummary(summary),
    diagnostics: {
      previousNoticeCount: numberValue(diagnostics.previousNoticeCount),
      currentNoticeCount: numberValue(diagnostics.currentNoticeCount),
      skippedPreviousNotices: numberValue(diagnostics.skippedPreviousNotices),
      skippedCurrentNotices: numberValue(diagnostics.skippedCurrentNotices),
      duplicatePreviousIdentifiers: numberValue(diagnostics.duplicatePreviousIdentifiers),
      duplicateCurrentIdentifiers: numberValue(diagnostics.duplicateCurrentIdentifiers),
      warnings: stringArray(diagnostics.warnings),
    },
    events: Array.isArray(payload.events)
      ? payload.events.map((event, index) => normalizeEvent(event, index))
      : [],
  };
}

function normalizeSnapshotHealthMeta(value: unknown): SnapshotHealthMeta {
  const payload = requireRecord(value, "latest-notices.meta.json");
  const period = requireRecord(payload.period, "snapshot period");
  const collection = requireRecord(payload.collection, "snapshot collection");
  const counts = requireRecord(payload.counts, "snapshot counts");

  return {
    generatedAt: text(payload.generatedAt),
    generatedAtKst: text(payload.generatedAtKst),
    period: {
      startDate: text(period.startDate),
      endDate: text(period.endDate),
      timezone: text(period.timezone),
    },
    collection: {
      pagesFetched: numberValue(collection.pagesFetched),
      upstreamTotalCount: numberValue(collection.upstreamTotalCount),
      truncated: booleanValue(collection.truncated),
      responseFormat: text(collection.responseFormat),
    },
    counts: {
      itemCount: numberValue(counts.itemCount),
      normalizedItemCount: numberValue(counts.normalizedItemCount),
      currentCount: numberValue(counts.currentCount),
      urgentCount: numberValue(counts.urgentCount),
      protectedCount: numberValue(counts.protectedCount),
      archiveCount: numberValue(counts.archiveCount),
      eventCount: numberValue(counts.eventCount),
      missingRecordCount: numberValue(counts.missingRecordCount),
    },
    warnings: stringArray(payload.warnings),
  };
}

function normalizeSummary(value: Record<string, unknown>): ChangeEventSummary {
  return {
    NEW: numberValue(value.NEW),
    DEADLINE_CHANGED: numberValue(value.DEADLINE_CHANGED),
    STATUS_CHANGED: numberValue(value.STATUS_CHANGED),
    BECAME_URGENT: numberValue(value.BECAME_URGENT),
    NOT_OBSERVED: numberValue(value.NOT_OBSERVED),
    DISAPPEARED: numberValue(value.DISAPPEARED),
    RETURNED: numberValue(value.RETURNED),
    total: numberValue(value.total),
  };
}

function normalizeEvent(value: unknown, index: number): NoticeChangeEvent {
  const event = requireRecord(value, `change event ${index}`);
  const eventType = text(event.type);
  if (!isChangeEventType(eventType)) {
    throw new Error(`Unsupported change event type: ${eventType || "empty"}`);
  }

  return {
    eventId: text(event.eventId) || `event-${index}`,
    type: eventType,
    observedAt: text(event.observedAt),
    observationDate: text(event.observationDate),
    snapshotId: text(event.snapshotId),
    noticeKey: text(event.noticeKey),
    notice: normalizeNotice(event.notice),
    changes: Array.isArray(event.changes)
      ? event.changes.map((change) => normalizeFieldChange(change))
      : [],
  };
}

function normalizeNotice(value: unknown): ChangeNoticeSnapshot {
  const notice = isRecord(value) ? value : {};
  return {
    desertion_no: nullableText(notice.desertion_no),
    notice_no: nullableText(notice.notice_no),
    happen_dt: nullableText(notice.happen_dt),
    notice_sdt: nullableText(notice.notice_sdt),
    notice_edt: nullableText(notice.notice_edt),
    kind_full_nm: nullableText(notice.kind_full_nm),
    process_state: nullableText(notice.process_state),
    care_nm: nullableText(notice.care_nm),
    org_nm: nullableText(notice.org_nm),
    days_left: nullableNumber(notice.days_left),
    deadline_status: nullableText(notice.deadline_status),
  };
}

function normalizeFieldChange(value: unknown): NoticeFieldChange {
  const change = isRecord(value) ? value : {};
  return {
    field: text(change.field),
    before: primitive(change.before),
    after: primitive(change.after),
  };
}

function isChangeEventType(value: string): value is ChangeEventType {
  return (CHANGE_EVENT_TYPES as readonly string[]).includes(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} did not return an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result ? result : null;
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function primitive(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}
