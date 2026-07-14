import type { ChangeEventType } from "./changeEvents";

export interface BriefingNotice {
  desertion_no: string | null;
  notice_no: string | null;
  notice_sdt: string | null;
  notice_edt: string | null;
  kind_full_nm: string | null;
  process_state: string | null;
  care_nm: string | null;
  care_tel: string | null;
  org_nm: string | null;
  happen_place: string | null;
  days_left: number;
  deadline_status: string | null;
}

export interface BriefingReason {
  code: "DEADLINE" | "NEW_URGENT" | "BECAME_URGENT" | "DEADLINE_ADVANCED";
  label: string;
}

export interface DeadlineBriefingCandidate {
  noticeKey: string;
  notice: BriefingNotice;
  reasons: BriefingReason[];
  priorityScore: number;
  priorityLabel: "즉시 확인" | "오늘 확인" | "우선 검토";
}

export interface DeadlineBriefingSummary {
  totalUrgent: number;
  dueToday: number;
  dueTomorrow: number;
  dueInTwoDays: number;
  dueInThreeDays: number;
  newUrgent: number;
  deadlineAdvanced: number;
}

export interface DeadlineBriefingData {
  generatedAt: string;
  generatedAtKst: string;
  observationDate: string;
  snapshotId: string;
  eventSource: "daily-events" | "latest-events";
  eventCount: number;
  regions: string[];
  summary: DeadlineBriefingSummary;
  candidates: DeadlineBriefingCandidate[];
}

interface RawChangeEvent {
  type: ChangeEventType;
  noticeKey: string;
  changes: Array<{
    field: string;
    previous: string | number | boolean | null;
    current: string | number | boolean | null;
  }>;
}

export async function loadDeadlineBriefingData(): Promise<DeadlineBriefingData> {
  const [snapshotValue, latestEventsValue] = await Promise.all([
    fetchJson("/data/latest-notices.json"),
    fetchJson("/data/latest-events.json"),
  ]);

  const snapshot = requireRecord(snapshotValue, "latest-notices.json");
  const latestEvents = requireRecord(latestEventsValue, "latest-events.json");
  const observationDate = text(latestEvents.observationDate) || dateInSeoul(text(snapshot.generatedAt));
  const dailyEventsValue = observationDate
    ? await fetchJsonOptional(`/data/daily-events/${observationDate}.json`)
    : null;
  const dailyEvents = isRecord(dailyEventsValue) ? dailyEventsValue : null;
  const eventPayload = dailyEvents && text(dailyEvents.observationDate) === observationDate
    ? dailyEvents
    : latestEvents;
  const eventSource = eventPayload === dailyEvents ? "daily-events" : "latest-events";
  const events = normalizeEvents(eventPayload.events);
  const eventsByNotice = groupEvents(events);
  const currentNotices = normalizeCurrentNotices(snapshot);
  const candidates = currentNotices
    .filter((notice) => notice.days_left >= 0 && notice.days_left <= 3)
    .map((notice) => buildCandidate(notice, eventsByNotice.get(stableNoticeKey(notice)) ?? []))
    .sort(compareCandidates);

  return {
    generatedAt: text(snapshot.generatedAt),
    generatedAtKst: text(snapshot.generatedAtKst),
    observationDate,
    snapshotId: text(snapshot.snapshotId),
    eventSource,
    eventCount: events.length,
    regions: [...new Set(candidates.map((candidate) => candidate.notice.org_nm).filter(isText))].sort(
      (left, right) => left.localeCompare(right, "ko"),
    ),
    summary: summarize(candidates),
    candidates,
  };
}

function normalizeCurrentNotices(snapshot: Record<string, unknown>): BriefingNotice[] {
  const views = isRecord(snapshot.views) ? snapshot.views : {};
  const source = Array.isArray(views.current)
    ? views.current
    : Array.isArray(snapshot.notices)
      ? snapshot.notices
      : [];

  return source.map(normalizeNotice).filter((notice): notice is BriefingNotice => notice !== null);
}

function normalizeNotice(value: unknown): BriefingNotice | null {
  if (!isRecord(value)) return null;
  const daysLeft = Number(value.days_left ?? value.days_until_notice_end);
  if (!Number.isFinite(daysLeft)) return null;

  return {
    desertion_no: nullableText(value.desertion_no),
    notice_no: nullableText(value.notice_no),
    notice_sdt: nullableText(value.notice_sdt),
    notice_edt: nullableText(value.notice_edt),
    kind_full_nm: nullableText(value.kind_full_nm),
    process_state: nullableText(value.process_state),
    care_nm: nullableText(value.care_nm),
    care_tel: nullableText(value.care_tel),
    org_nm: nullableText(value.org_nm),
    happen_place: nullableText(value.happen_place),
    days_left: daysLeft,
    deadline_status: nullableText(value.deadline_status),
  };
}

function normalizeEvents(value: unknown): RawChangeEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event) => {
    if (!isRecord(event)) return [];
    const type = text(event.type) as ChangeEventType;
    const noticeKey = text(event.noticeKey);
    if (!noticeKey) return [];
    const changes = Array.isArray(event.changes)
      ? event.changes.flatMap((change) => {
          if (!isRecord(change)) return [];
          return [{
            field: text(change.field),
            previous: primitive(change.previous ?? change.before),
            current: primitive(change.current ?? change.after),
          }];
        })
      : [];
    return [{ type, noticeKey, changes }];
  });
}

function groupEvents(events: RawChangeEvent[]): Map<string, RawChangeEvent[]> {
  const grouped = new Map<string, RawChangeEvent[]>();
  events.forEach((event) => {
    grouped.set(event.noticeKey, [...(grouped.get(event.noticeKey) ?? []), event]);
  });
  return grouped;
}

function buildCandidate(
  notice: BriefingNotice,
  events: RawChangeEvent[],
): DeadlineBriefingCandidate {
  const reasons: BriefingReason[] = [deadlineReason(notice.days_left)];
  let bonus = 0;

  if (events.some((event) => event.type === "NEW")) {
    reasons.push({ code: "NEW_URGENT", label: "오늘 새로 관측된 긴급 공고" });
    bonus += 10;
  }
  if (events.some((event) => event.type === "BECAME_URGENT")) {
    reasons.push({ code: "BECAME_URGENT", label: "오늘 D-3 이내 구간 진입" });
    bonus += 8;
  }

  const advancedChange = events
    .filter((event) => event.type === "DEADLINE_CHANGED")
    .flatMap((event) => event.changes)
    .find((change) => {
      if (change.field !== "notice_edt") return false;
      const previous = typeof change.previous === "string" ? change.previous : "";
      const current = typeof change.current === "string" ? change.current : "";
      return Boolean(previous && current && current < previous);
    });
  if (advancedChange) {
    reasons.push({
      code: "DEADLINE_ADVANCED",
      label: `종료일 앞당김 · ${String(advancedChange.previous)} → ${String(advancedChange.current)}`,
    });
    bonus += 15;
  }

  const priorityScore = 100 - notice.days_left * 20 + bonus;
  const priorityLabel = notice.days_left === 0
    ? "즉시 확인"
    : notice.days_left === 1 || priorityScore >= 90
      ? "오늘 확인"
      : "우선 검토";

  return {
    noticeKey: stableNoticeKey(notice),
    notice,
    reasons,
    priorityScore,
    priorityLabel,
  };
}

function deadlineReason(daysLeft: number): BriefingReason {
  if (daysLeft === 0) return { code: "DEADLINE", label: "오늘 공고 종료" };
  if (daysLeft === 1) return { code: "DEADLINE", label: "내일 공고 종료" };
  return { code: "DEADLINE", label: `D-${daysLeft} 공고 종료` };
}

function summarize(candidates: DeadlineBriefingCandidate[]): DeadlineBriefingSummary {
  return {
    totalUrgent: candidates.length,
    dueToday: candidates.filter((candidate) => candidate.notice.days_left === 0).length,
    dueTomorrow: candidates.filter((candidate) => candidate.notice.days_left === 1).length,
    dueInTwoDays: candidates.filter((candidate) => candidate.notice.days_left === 2).length,
    dueInThreeDays: candidates.filter((candidate) => candidate.notice.days_left === 3).length,
    newUrgent: candidates.filter((candidate) =>
      candidate.reasons.some((reason) => reason.code === "NEW_URGENT"),
    ).length,
    deadlineAdvanced: candidates.filter((candidate) =>
      candidate.reasons.some((reason) => reason.code === "DEADLINE_ADVANCED"),
    ).length,
  };
}

function compareCandidates(left: DeadlineBriefingCandidate, right: DeadlineBriefingCandidate): number {
  return (
    right.priorityScore - left.priorityScore ||
    left.notice.days_left - right.notice.days_left ||
    String(left.notice.notice_edt).localeCompare(String(right.notice.notice_edt)) ||
    String(left.notice.notice_no).localeCompare(String(right.notice.notice_no))
  );
}

function stableNoticeKey(notice: BriefingNotice): string {
  if (notice.desertion_no) return `desertion:${notice.desertion_no}`;
  if (notice.notice_no) return `notice:${notice.notice_no}`;
  return `unknown:${notice.org_nm ?? "region"}:${notice.notice_edt ?? "date"}:${notice.kind_full_nm ?? "notice"}`;
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function fetchJsonOptional(path: string): Promise<unknown | null> {
  const response = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} did not return an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const valueText = text(value).trim();
  return valueText || null;
}

function primitive(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}

function isText(value: string | null): value is string {
  return Boolean(value);
}

function dateInSeoul(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
