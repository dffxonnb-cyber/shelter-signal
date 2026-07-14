import { useEffect, useMemo, useState } from "react";
import {
  CHANGE_EVENT_TYPES,
  loadChangeDashboardData,
  type ChangeDashboardData,
  type ChangeEventType,
  type NoticeChangeEvent,
  type NoticeFieldChange,
} from "./data/changeEvents";

type EventFilter = "ALL" | ChangeEventType;
type LoadState =
  | { status: "loading" }
  | { status: "success"; data: ChangeDashboardData }
  | { status: "error"; message: string };

const EVENT_COPY: Record<
  ChangeEventType,
  { label: string; description: string; tone: "new" | "change" | "urgent" | "missing" | "return" }
> = {
  NEW: {
    label: "새 공고",
    description: "이전 수집에는 없었고 이번 수집에서 처음 관측됐어요.",
    tone: "new",
  },
  DEADLINE_CHANGED: {
    label: "종료일 변경",
    description: "공고 종료일이 이전 관측과 달라졌어요.",
    tone: "change",
  },
  STATUS_CHANGED: {
    label: "상태 변경",
    description: "공고의 처리 상태가 이전 관측과 달라졌어요.",
    tone: "change",
  },
  BECAME_URGENT: {
    label: "긴급 구간 진입",
    description: "이번 관측에서 D-3 이내 확인 구간에 들어왔어요.",
    tone: "urgent",
  },
  NOT_OBSERVED: {
    label: "한 번 미관측",
    description: "이번 수집에서 보이지 않았지만 종료나 결과를 뜻하지는 않아요.",
    tone: "missing",
  },
  DISAPPEARED: {
    label: "연속 미관측",
    description: "서로 다른 날짜에 두 번 이상 관측되지 않았어요. 최종 결과는 확인되지 않았어요.",
    tone: "missing",
  },
  RETURNED: {
    label: "다시 관측",
    description: "이전에 보이지 않던 공고가 이번 수집에서 다시 확인됐어요.",
    tone: "return",
  },
};

const FILTER_ORDER: EventFilter[] = ["ALL", ...CHANGE_EVENT_TYPES];

export default function ChangeDashboard() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<EventFilter>("ALL");
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoadState({ status: "loading" });

    loadChangeDashboardData()
      .then((data) => {
        if (isMounted) setLoadState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "변화 이력을 불러오지 못했습니다.",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  if (loadState.status === "loading") {
    return <DashboardLoading />;
  }

  if (loadState.status === "error") {
    return (
      <DashboardError
        message={loadState.message}
        onRetry={() => setRequestId((current) => current + 1)}
      />
    );
  }

  return <DashboardContent data={loadState.data} filter={filter} onFilter={setFilter} />;
}

function DashboardContent({
  data,
  filter,
  onFilter,
}: {
  data: ChangeDashboardData;
  filter: EventFilter;
  onFilter: (filter: EventFilter) => void;
}) {
  const { events, health } = data;
  const filteredEvents = useMemo(
    () => (filter === "ALL" ? events.events : events.events.filter((event) => event.type === filter)),
    [events.events, filter],
  );
  const deadlineChanges = events.summary.DEADLINE_CHANGED + events.summary.BECAME_URGENT;
  const statusChanges = events.summary.STATUS_CHANGED + events.summary.RETURNED;
  const missingChanges = events.summary.NOT_OBSERVED + events.summary.DISAPPEARED;
  const collectionHealthy =
    !health.collection.truncated && health.warnings.length === 0 && events.diagnostics.warnings.length === 0;

  return (
    <div className="v2-shell" data-testid="screen-changes">
      <header className="v2-header">
        <div className="v2-brand-lockup">
          <span className="v2-brand-mark" aria-hidden="true" />
          <div>
            <p className="v2-eyebrow">Shelter Signal V2</p>
            <h1>오늘 무엇이 달라졌는지</h1>
          </div>
        </div>
        <span className="v2-history-badge">History-aware</span>
      </header>

      <main className="v2-main">
        <section className="v2-hero">
          <div>
            <p className="v2-kicker">{formatDate(events.observationDate)} 관측 브리핑</p>
            <h2>현재 목록보다 먼저, 변화부터 확인합니다.</h2>
            <p>
              이전 성공 수집과 이번 수집을 비교해 새 공고, 마감 변화, 상태 변화와 미관측을
              분리했습니다. 미관측은 실제 종료 결과로 단정하지 않습니다.
            </p>
          </div>
          <div className="v2-total-change">
            <span>오늘 감지</span>
            <strong>{events.summary.total}</strong>
            <small>변화 이벤트</small>
          </div>
        </section>

        <section className="v2-summary-grid" aria-label="오늘의 변화 요약">
          <SummaryCard label="새 공고" value={events.summary.NEW} hint="처음 관측" tone="new" />
          <SummaryCard label="마감 변화" value={deadlineChanges} hint="종료일·긴급 진입" tone="urgent" />
          <SummaryCard label="상태 변화" value={statusChanges} hint="상태 변경·복귀" tone="change" />
          <SummaryCard label="미관측" value={missingChanges} hint="결과 확정 아님" tone="missing" />
        </section>

        <CollectionHealthPanel
          data={data}
          collectionHealthy={collectionHealthy}
        />

        <section className="v2-events-section">
          <div className="v2-section-heading">
            <div>
              <p className="v2-kicker">Change log</p>
              <h2>관측 변화 목록</h2>
            </div>
            <span>{filteredEvents.length}건 표시</span>
          </div>

          <div className="v2-filter-row" role="group" aria-label="변화 유형 필터">
            {FILTER_ORDER.map((eventFilter) => {
              const count = eventFilter === "ALL" ? events.summary.total : events.summary[eventFilter];
              return (
                <button
                  key={eventFilter}
                  type="button"
                  className={filter === eventFilter ? "is-active" : ""}
                  onClick={() => onFilter(eventFilter)}
                >
                  {filterLabel(eventFilter)} <span>{count}</span>
                </button>
              );
            })}
          </div>

          {filteredEvents.length ? (
            <div className="v2-event-list">
              {filteredEvents.map((event) => (
                <EventCard key={event.eventId} event={event} />
              ))}
            </div>
          ) : (
            <section className="v2-empty-state" role="status">
              <strong>이 유형의 변화는 오늘 감지되지 않았습니다.</strong>
              <p>다른 변화 유형을 선택하거나 다음 자동 수집 결과를 확인해 주세요.</p>
            </section>
          )}
        </section>

        <section className="v2-boundary-note">
          <strong>관측 이력의 경계</strong>
          <p>
            이 화면은 수집기가 본 변화를 기록합니다. `NOT_OBSERVED`와 `DISAPPEARED`는 입양,
            반환, 이관, 안락사 또는 공고 종료를 증명하지 않습니다. 공식 결과는 보호소와
            관할기관에서 확인해야 합니다.
          </p>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "new" | "urgent" | "change" | "missing";
}) {
  return (
    <article className={`v2-summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function CollectionHealthPanel({
  data,
  collectionHealthy,
}: {
  data: ChangeDashboardData;
  collectionHealthy: boolean;
}) {
  const { events, health } = data;
  const noticeDelta = events.diagnostics.currentNoticeCount - events.diagnostics.previousNoticeCount;
  const warnings = [...health.warnings, ...events.diagnostics.warnings];

  return (
    <section className={`v2-health-panel ${collectionHealthy ? "is-healthy" : "is-warning"}`}>
      <div className="v2-section-heading">
        <div>
          <p className="v2-kicker">Collection health</p>
          <h2>수집 상태와 비교 범위</h2>
        </div>
        <span>{collectionHealthy ? "정상 수집" : "확인 필요"}</span>
      </div>

      <dl className="v2-health-grid">
        <HealthItem label="마지막 수집" value={formatDateTime(health.generatedAt)} />
        <HealthItem label="현재 관측" value={`${events.diagnostics.currentNoticeCount.toLocaleString()}건`} />
        <HealthItem
          label="이전 대비"
          value={`${noticeDelta >= 0 ? "+" : ""}${noticeDelta.toLocaleString()}건`}
        />
        <HealthItem label="수집 페이지" value={`${health.collection.pagesFetched}페이지`} />
        <HealthItem label="원천 전체 건수" value={`${health.collection.upstreamTotalCount.toLocaleString()}건`} />
        <HealthItem label="현재 미관측 기록" value={`${health.counts.missingRecordCount.toLocaleString()}건`} />
      </dl>

      <div className="v2-health-flags">
        <span className={health.collection.truncated ? "is-warning" : "is-ok"}>
          {health.collection.truncated ? "수집 범위 잘림" : "수집 범위 완료"}
        </span>
        <span className={events.baseline ? "is-neutral" : "is-ok"}>
          {events.baseline ? "기준선 생성" : "이전 수집과 비교"}
        </span>
        <span className={events.observationWindowChanged ? "is-warning" : "is-ok"}>
          {events.observationWindowChanged ? "조회 창 변경" : "동일 조회 창"}
        </span>
      </div>

      {warnings.length > 0 && (
        <ul className="v2-warning-list">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HealthItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EventCard({ event }: { event: NoticeChangeEvent }) {
  const copy = EVENT_COPY[event.type];
  const title = event.notice.kind_full_nm || event.notice.notice_no || "공고 정보 확인 필요";
  const location = [event.notice.org_nm, event.notice.care_nm].filter(Boolean).join(" · ");

  return (
    <article className={`v2-event-card tone-${copy.tone}`}>
      <div className="v2-event-card-top">
        <span className="v2-event-type">{copy.label}</span>
        <time dateTime={event.observedAt}>{formatTime(event.observedAt)}</time>
      </div>

      <div className="v2-event-main">
        <div>
          <h3>{title}</h3>
          <p>{location || "지역·보호소 정보 확인 필요"}</p>
        </div>
        <DeadlineChip event={event} />
      </div>

      <p className="v2-event-description">{copy.description}</p>

      <div className="v2-event-meta">
        {event.notice.notice_no && <span>{event.notice.notice_no}</span>}
        {event.notice.process_state && <span>{event.notice.process_state}</span>}
        {event.notice.notice_edt && <span>종료 {formatDate(event.notice.notice_edt)}</span>}
      </div>

      {event.changes.length > 0 && (
        <dl className="v2-change-list">
          {event.changes.map((change, index) => (
            <FieldChange key={`${event.eventId}-${change.field}-${index}`} change={change} />
          ))}
        </dl>
      )}
    </article>
  );
}

function DeadlineChip({ event }: { event: NoticeChangeEvent }) {
  const daysLeft = event.notice.days_left;
  const label =
    event.notice.deadline_status ||
    (daysLeft === null ? "일정 확인" : daysLeft === 0 ? "D-Day" : `D-${daysLeft}`);

  return <span className="v2-deadline-chip">{label}</span>;
}

function FieldChange({ change }: { change: NoticeFieldChange }) {
  return (
    <div>
      <dt>{fieldLabel(change.field)}</dt>
      <dd>
        <span>{formatValue(change.before)}</span>
        <b aria-hidden="true">→</b>
        <strong>{formatValue(change.after)}</strong>
      </dd>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="v2-shell">
      <header className="v2-header">
        <div className="v2-brand-lockup">
          <span className="v2-brand-mark" aria-hidden="true" />
          <div>
            <p className="v2-eyebrow">Shelter Signal V2</p>
            <h1>변화 이력을 불러오는 중</h1>
          </div>
        </div>
      </header>
      <main className="v2-main" aria-busy="true">
        <section className="v2-loading-card">최신 자동 수집 결과를 확인하고 있습니다.</section>
      </main>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="v2-shell">
      <header className="v2-header">
        <div className="v2-brand-lockup">
          <span className="v2-brand-mark" aria-hidden="true" />
          <div>
            <p className="v2-eyebrow">Shelter Signal V2</p>
            <h1>변화 이력을 확인하지 못했습니다.</h1>
          </div>
        </div>
      </header>
      <main className="v2-main">
        <section className="v2-error-card" role="alert">
          <strong>최신 변화 파일을 불러오는 데 실패했습니다.</strong>
          <p>{message}</p>
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        </section>
      </main>
    </div>
  );
}

function filterLabel(filter: EventFilter): string {
  return filter === "ALL" ? "전체" : EVENT_COPY[filter].label;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    notice_edt: "공고 종료일",
    process_state: "처리 상태",
    deadline_status: "마감 구간",
    days_left: "남은 날짜",
  };
  return labels[field] || field;
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === "") return "없음";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return String(value);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
