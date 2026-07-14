import { useEffect, useMemo, useState } from "react";
import {
  loadDeadlineBriefingData,
  type DeadlineBriefingCandidate,
  type DeadlineBriefingData,
} from "./data/deadlineBriefing";

const DISPLAY_LIMIT = 30;
type DayFilter = "ALL" | "0" | "1" | "2" | "3";
type LoadState =
  | { status: "loading" }
  | { status: "success"; data: DeadlineBriefingData }
  | { status: "error"; message: string };

export default function DeadlineBriefingPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [region, setRegion] = useState("ALL");
  const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoadState({ status: "loading" });
    loadDeadlineBriefingData()
      .then((data) => {
        if (mounted) setLoadState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "마감 브리핑을 불러오지 못했습니다.",
        });
      });
    return () => {
      mounted = false;
    };
  }, [requestId]);

  if (loadState.status === "loading") return <BriefingLoading />;
  if (loadState.status === "error") {
    return (
      <BriefingError
        message={loadState.message}
        onRetry={() => setRequestId((current) => current + 1)}
      />
    );
  }

  return (
    <BriefingContent
      data={loadState.data}
      region={region}
      dayFilter={dayFilter}
      onRegion={setRegion}
      onDayFilter={setDayFilter}
    />
  );
}

function BriefingContent({
  data,
  region,
  dayFilter,
  onRegion,
  onDayFilter,
}: {
  data: DeadlineBriefingData;
  region: string;
  dayFilter: DayFilter;
  onRegion: (region: string) => void;
  onDayFilter: (filter: DayFilter) => void;
}) {
  const regionalCandidates = useMemo(
    () =>
      region === "ALL"
        ? data.candidates
        : data.candidates.filter((candidate) => candidate.notice.org_nm === region),
    [data.candidates, region],
  );
  const filteredCandidates = useMemo(
    () =>
      dayFilter === "ALL"
        ? regionalCandidates
        : regionalCandidates.filter(
            (candidate) => candidate.notice.days_left === Number(dayFilter),
          ),
    [dayFilter, regionalCandidates],
  );
  const visibleCandidates = filteredCandidates.slice(0, DISPLAY_LIMIT);
  const counts = summarizeCandidates(regionalCandidates);

  return (
    <div className="briefing-shell" data-testid="screen-briefing">
      <header className="briefing-header">
        <div className="briefing-brand-lockup">
          <span className="briefing-brand-mark" aria-hidden="true" />
          <div>
            <p>Shelter Signal V2</p>
            <h1>오늘의 마감 브리핑</h1>
          </div>
        </div>
        <span className="briefing-observed-at">{formatDateTime(data.generatedAt)} 수집</span>
      </header>

      <main className="briefing-main">
        <section className="briefing-hero">
          <div>
            <p className="briefing-kicker">{formatDate(data.observationDate)} 우선 확인 목록</p>
            <h2>마감이 가까운 공고부터, 포함된 이유까지 함께 봅니다.</h2>
            <p>
              D-Day부터 D-3까지의 현재 공고를 마감 시점, 오늘 감지된 신규·긴급 진입,
              종료일 앞당김 근거로 정렬했습니다. 이 순위는 공식 위험도나 결과 예측이 아닙니다.
            </p>
          </div>
          <div className="briefing-total">
            <span>D-3 이내</span>
            <strong>{regionalCandidates.length.toLocaleString()}</strong>
            <small>{region === "ALL" ? "전국 공고" : region}</small>
          </div>
        </section>

        <section className="briefing-summary-grid" aria-label="마감 브리핑 요약">
          <SummaryMetric label="오늘 마감" value={counts.dueToday} tone="critical" />
          <SummaryMetric label="내일 마감" value={counts.dueTomorrow} tone="high" />
          <SummaryMetric label="D-2" value={counts.dueInTwoDays} tone="medium" />
          <SummaryMetric label="D-3" value={counts.dueInThreeDays} tone="watch" />
          <SummaryMetric label="오늘 신규 긴급" value={counts.newUrgent} tone="new" />
          <SummaryMetric label="종료일 앞당김" value={counts.deadlineAdvanced} tone="change" />
        </section>

        <section className="briefing-controls" aria-label="마감 브리핑 필터">
          <label>
            <span>지역</span>
            <select value={region} onChange={(event) => onRegion(event.target.value)}>
              <option value="ALL">전국</option>
              {data.regions.map((regionName) => (
                <option key={regionName} value={regionName}>
                  {regionName}
                </option>
              ))}
            </select>
          </label>
          <div className="briefing-day-filter" role="group" aria-label="마감일 필터">
            {(["ALL", "0", "1", "2", "3"] as DayFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={dayFilter === filter ? "is-active" : ""}
                onClick={() => onDayFilter(filter)}
              >
                {dayFilterLabel(filter)}
              </button>
            ))}
          </div>
          <button type="button" className="briefing-change-link" onClick={openChanges}>
            오늘의 변화 보기
          </button>
        </section>

        <section className="briefing-list-section">
          <div className="briefing-section-heading">
            <div>
              <p className="briefing-kicker">Decision brief</p>
              <h2>먼저 확인할 공고</h2>
            </div>
            <span>
              {visibleCandidates.length.toLocaleString()}건 표시 · 전체 {filteredCandidates.length.toLocaleString()}건
            </span>
          </div>

          {visibleCandidates.length ? (
            <div className="briefing-list">
              {visibleCandidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.noticeKey}
                  candidate={candidate}
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <section className="briefing-empty" role="status">
              <strong>선택한 조건의 마감 공고가 없습니다.</strong>
              <p>지역이나 마감일 필터를 바꾸어 확인해 주세요.</p>
            </section>
          )}

          {filteredCandidates.length > DISPLAY_LIMIT && (
            <p className="briefing-limit-note">
              한 번에 판단하기 쉽도록 우선순위 상위 {DISPLAY_LIMIT}건만 표시합니다. 지역과
              마감일 필터를 사용하면 나머지 공고도 확인할 수 있습니다.
            </p>
          )}
        </section>

        <section className="briefing-method-note">
          <strong>선정 기준과 경계</strong>
          <p>
            기본 순서는 남은 공고일이 짧을수록 높고, 같은 마감일에서는 오늘 새로 관측되었거나
            D-3 구간에 진입했거나 종료일이 앞당겨진 공고를 먼저 둡니다. 수집기가 관측한 공개
            공고만 사용하며, 입양 가능성·안락사 위험·보호 결과를 예측하지 않습니다.
          </p>
          <small>
            변화 근거: {data.eventSource === "daily-events" ? "당일 누적 이벤트" : "최근 실행 이벤트"}
            {" · "}{data.eventCount.toLocaleString()}건
          </small>
        </section>
      </main>
    </div>
  );
}

function CandidateCard({
  candidate,
  rank,
}: {
  candidate: DeadlineBriefingCandidate;
  rank: number;
}) {
  const { notice } = candidate;
  const title = notice.kind_full_nm || notice.notice_no || "공고 정보 확인 필요";
  const location = [notice.org_nm, notice.care_nm].filter(Boolean).join(" · ");
  const open = () => openTimeline(candidate.noticeKey);

  return (
    <article
      className={`briefing-card day-${notice.days_left}`}
      role="button"
      tabIndex={0}
      aria-label={`${title} 누적 변화 타임라인 보기`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className="briefing-rank">
        <span>{rank}</span>
        <small>{candidate.priorityLabel}</small>
      </div>
      <div className="briefing-card-body">
        <div className="briefing-card-title">
          <div>
            <h3>{title}</h3>
            <p>{location || "지역·보호소 정보 확인 필요"}</p>
          </div>
          <span className="briefing-dday">{deadlineLabel(notice.days_left)}</span>
        </div>
        <div className="briefing-reasons" aria-label="브리핑 포함 근거">
          {candidate.reasons.map((reason) => (
            <span key={`${candidate.noticeKey}-${reason.code}`}>{reason.label}</span>
          ))}
        </div>
        <dl className="briefing-card-meta">
          <MetaItem label="공고번호" value={notice.notice_no || "확인 필요"} />
          <MetaItem label="공고 종료" value={formatDate(notice.notice_edt || "")} />
          <MetaItem label="처리 상태" value={notice.process_state || "확인 필요"} />
          <MetaItem label="발견 장소" value={notice.happen_place || "확인 필요"} />
        </dl>
        <div className="briefing-card-footer">
          <span>누적 변화 타임라인 보기</span>
          {notice.care_tel && (
            <a
              href={`tel:${notice.care_tel.replace(/[^\d+]/g, "")}`}
              onClick={(event) => event.stopPropagation()}
            >
              보호소 전화
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium" | "watch" | "new" | "change";
}) {
  return (
    <article className={`briefing-summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>공고</small>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BriefingLoading() {
  return (
    <div className="briefing-shell">
      <header className="briefing-header">
        <div className="briefing-brand-lockup">
          <span className="briefing-brand-mark" aria-hidden="true" />
          <div>
            <p>Shelter Signal V2</p>
            <h1>마감 브리핑을 만드는 중</h1>
          </div>
        </div>
      </header>
      <main className="briefing-main" aria-busy="true">
        <section className="briefing-loading">최신 공고와 오늘의 변화 근거를 조합하고 있습니다.</section>
      </main>
    </div>
  );
}

function BriefingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="briefing-shell">
      <header className="briefing-header">
        <div className="briefing-brand-lockup">
          <span className="briefing-brand-mark" aria-hidden="true" />
          <div>
            <p>Shelter Signal V2</p>
            <h1>마감 브리핑을 확인하지 못했습니다.</h1>
          </div>
        </div>
      </header>
      <main className="briefing-main">
        <section className="briefing-error" role="alert">
          <strong>최신 브리핑 데이터를 불러오는 데 실패했습니다.</strong>
          <p>{message}</p>
          <button type="button" onClick={onRetry}>다시 시도</button>
        </section>
      </main>
    </div>
  );
}

function summarizeCandidates(candidates: DeadlineBriefingCandidate[]) {
  return {
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

function dayFilterLabel(filter: DayFilter): string {
  if (filter === "ALL") return "전체";
  if (filter === "0") return "D-Day";
  return `D-${filter}`;
}

function deadlineLabel(daysLeft: number): string {
  return daysLeft === 0 ? "D-Day" : `D-${daysLeft}`;
}

function openChanges() {
  window.location.hash = "#changes";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTimeline(noticeKey: string) {
  window.location.hash = `#timeline/${encodeURIComponent(noticeKey)}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value || "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
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
