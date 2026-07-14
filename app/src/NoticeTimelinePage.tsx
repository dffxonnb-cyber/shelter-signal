import { useEffect, useState } from "react";
import { type NoticeChangeEvent, type NoticeFieldChange } from "./data/changeEvents";
import { loadNoticeTimeline, type NoticeTimelineRecord } from "./data/noticeTimelines";

const EVENT_LABELS: Record<NoticeChangeEvent["type"], string> = {
  NEW: "새 공고 관측",
  DEADLINE_CHANGED: "공고 종료일 변경",
  STATUS_CHANGED: "처리 상태 변경",
  BECAME_URGENT: "긴급 구간 진입",
  NOT_OBSERVED: "한 번 미관측",
  DISAPPEARED: "연속 미관측",
  RETURNED: "다시 관측",
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; timeline: NoticeTimelineRecord; updatedAt: string }
  | { status: "error"; message: string };

export default function NoticeTimelinePage({ noticeKey }: { noticeKey: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });
    loadNoticeTimeline(noticeKey)
      .then(({ payload, timeline }) => {
        if (mounted) setState({ status: "success", timeline, updatedAt: payload.updatedAt });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "타임라인을 불러오지 못했습니다.",
        });
      });
    return () => {
      mounted = false;
    };
  }, [noticeKey, requestId]);

  if (state.status === "loading") {
    return (
      <TimelineShell>
        <section className="timeline-state-card" aria-busy="true">
          공고의 누적 변화 이력을 불러오고 있습니다.
        </section>
      </TimelineShell>
    );
  }

  if (state.status === "error") {
    return (
      <TimelineShell>
        <section className="timeline-state-card is-error" role="alert">
          <strong>이 공고의 타임라인을 아직 열 수 없습니다.</strong>
          <p>{state.message}</p>
          <button type="button" onClick={() => setRequestId((current) => current + 1)}>
            다시 시도
          </button>
        </section>
      </TimelineShell>
    );
  }

  const { timeline, updatedAt } = state;
  const notice = timeline.notice;
  const title = notice?.kind_full_nm || notice?.notice_no || "공고 정보 확인 필요";
  const location = [notice?.org_nm, notice?.care_nm].filter(Boolean).join(" · ");
  const events = [...timeline.events].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  return (
    <TimelineShell>
      <section className="timeline-hero">
        <div>
          <p className="v2-kicker">Individual notice history</p>
          <h1>{title}</h1>
          <p>{location || "지역·보호소 정보 확인 필요"}</p>
        </div>
        <div className="timeline-count">
          <span>누적 기록</span>
          <strong>{timeline.eventCount}</strong>
          <small>변화 이벤트</small>
        </div>
      </section>

      <section className="timeline-summary" aria-label="공고 타임라인 요약">
        <TimelineMetric label="공고 번호" value={notice?.notice_no || "확인 필요"} />
        <TimelineMetric label="최초 변화 관측" value={formatDateTime(timeline.firstObservedAt)} />
        <TimelineMetric label="최근 변화 관측" value={formatDateTime(timeline.lastObservedAt)} />
        <TimelineMetric label="현재 종료일" value={formatDate(notice?.notice_edt)} />
        <TimelineMetric label="현재 상태" value={notice?.process_state || "확인 필요"} />
        <TimelineMetric label="이력 파일 갱신" value={formatDateTime(updatedAt)} />
      </section>

      <section className="timeline-list-section">
        <div className="v2-section-heading">
          <div>
            <p className="v2-kicker">Timeline</p>
            <h2>수집기가 관측한 변화</h2>
          </div>
          <span>{events.length}건</span>
        </div>

        <ol className="notice-timeline-list">
          {events.map((event) => (
            <li key={event.eventId} className={`timeline-event tone-${timelineTone(event.type)}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <article>
                <div className="timeline-event-heading">
                  <div>
                    <span>{EVENT_LABELS[event.type]}</span>
                    <h3>{eventTitle(event)}</h3>
                  </div>
                  <time dateTime={event.observedAt}>{formatDateTime(event.observedAt)}</time>
                </div>

                <p>{eventDescription(event)}</p>

                {event.changes.length > 0 && (
                  <dl className="timeline-change-list">
                    {event.changes.map((change, index) => (
                      <TimelineChange
                        key={`${event.eventId}-${change.field}-${index}`}
                        change={change}
                      />
                    ))}
                  </dl>
                )}
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className="v2-boundary-note">
        <strong>이 타임라인이 말할 수 있는 범위</strong>
        <p>
          Shelter Signal V2가 자동 수집을 시작한 이후의 변화만 누적합니다. 미관측 기록은 입양,
          반환, 이관, 안락사 또는 공고 종료를 증명하지 않으며 공식 결과는 보호소나 관할기관에서
          확인해야 합니다.
        </p>
      </section>
    </TimelineShell>
  );
}

function TimelineShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2-shell timeline-shell" data-testid="screen-notice-timeline">
      <header className="timeline-header">
        <button type="button" onClick={backToChanges} aria-label="오늘의 변화 목록으로 돌아가기">
          ← 변화 목록
        </button>
        <div>
          <p className="v2-eyebrow">Shelter Signal V2</p>
          <strong>공고 변화 타임라인</strong>
        </div>
      </header>
      <main className="v2-main">{children}</main>
    </div>
  );
}

function TimelineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TimelineChange({ change }: { change: NoticeFieldChange }) {
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

function eventTitle(event: NoticeChangeEvent): string {
  if (event.type === "NEW") return "이 공고가 변화 이력에 처음 들어왔습니다.";
  if (event.type === "NOT_OBSERVED") return "이번 성공 수집에서는 확인되지 않았습니다.";
  if (event.type === "DISAPPEARED") return "서로 다른 날짜에 연속으로 확인되지 않았습니다.";
  if (event.type === "RETURNED") return "미관측 뒤 다시 공고가 확인됐습니다.";
  if (event.type === "BECAME_URGENT") return "공고 종료일까지 D-3 이내 구간에 들어왔습니다.";
  return "이전 관측과 다른 값이 확인됐습니다.";
}

function eventDescription(event: NoticeChangeEvent): string {
  const noticeNo = event.notice.notice_no ? `공고 ${event.notice.notice_no}` : "이 공고";
  if (event.type === "NOT_OBSERVED" || event.type === "DISAPPEARED") {
    return `${noticeNo}의 미관측 상태를 기록했습니다. 실제 최종 결과는 확인되지 않았습니다.`;
  }
  return `${noticeNo}를 ${formatDate(event.observationDate)} 수집 결과에서 기록했습니다.`;
}

function timelineTone(type: NoticeChangeEvent["type"]): string {
  if (type === "NEW") return "new";
  if (type === "BECAME_URGENT") return "urgent";
  if (type === "NOT_OBSERVED" || type === "DISAPPEARED") return "missing";
  if (type === "RETURNED") return "return";
  return "change";
}

function backToChanges() {
  window.location.hash = "#changes";
  window.scrollTo({ top: 0, behavior: "smooth" });
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "확인 필요";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "기록 없음";
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
