import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  MOCK_REFERENCE_DATE,
  MockAnimal,
  RescueWindowLabel,
  rescueWindowLabels,
} from "./data/mockAnimals";
import { fallbackAppData, loadAppData } from "./data/exportedData";
import type {
  AppDataSource,
  ExportedAppData,
  FreshnessMeta,
  RegionSummaryRecord,
  RescueWindowSummaryRecord,
} from "./data/exportedData";
import { getRegionCodes } from "./data/regionCodes";
import {
  ShelterApiError,
  fetchSheltersByRegion,
  type Shelter,
  type ShelterApiErrorCode,
} from "./data/shelters";

type ViewKey = "overview" | "golden" | "notices" | "regions" | "saved";

const ALL_FILTER = "전체";
const NOTICE_PAGE_SIZE = 20;

const viewItems: Array<{ key: ViewKey; label: string; testId: string }> = [
  { key: "overview", label: "홈", testId: "nav-home" },
  { key: "golden", label: "골든타임", testId: "nav-golden" },
  { key: "notices", label: "공고", testId: "nav-notices" },
  { key: "regions", label: "지역", testId: "nav-regions" },
  { key: "saved", label: "저장", testId: "nav-saved" },
];

const labelOrder: Record<RescueWindowLabel, number> = {
  "긴급 확인": 1,
  "곧 종료": 2,
  "확인 필요": 3,
  "여유 있음": 4,
  "종료/확인 필요": 5,
};

type DataSourceState = "loading" | AppDataSource;
type ShelterLoadState = "idle" | "loading" | "success" | "error";

interface RuntimeAppData extends ExportedAppData {
  source: DataSourceState;
  errorMessage?: string;
}

interface RegionSignal {
  region: string;
  total: number;
  urgent: number;
  endingSoon: number;
  averageScore: number;
}

interface RegionSignalTotals {
  total: number;
  urgent: number;
  endingSoon: number;
  averageScore: number;
  regionCount: number;
}

interface RegionDistrictOption {
  label: string;
  value: string;
  signal: RegionSignal;
}

interface RegionSelectorGroup {
  sido: string;
  districts: RegionDistrictOption[];
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [labelFilter, setLabelFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [regionFilter, setRegionFilter] = useState(ALL_FILTER);
  const [detailAnimalId, setDetailAnimalId] = useState<string | null>(null);
  const [runtimeData, setRuntimeData] = useState<RuntimeAppData>({
    ...fallbackAppData,
    source: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    loadAppData()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setRuntimeData(data);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        const message = error instanceof Error ? error.message : "app data load failed";
        setRuntimeData({ ...fallbackAppData, source: "fallback", errorMessage: message });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!detailAnimalId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailAnimalId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailAnimalId]);

  const animals = runtimeData.currentNotices;

  const animalTypes = useMemo(
    () => Array.from(new Set(animals.map((animal) => animal.animalType))),
    [animals]
  );
  const regions = useMemo(
    () => Array.from(new Set(animals.map((animal) => animal.region))).sort(),
    [animals]
  );
  const sortedAnimals = useMemo(() => sortByWindow(animals), [animals]);
  const filteredAnimals = useMemo(() => {
    return sortedAnimals
      .filter((animal) =>
        labelFilter === ALL_FILTER ? true : animal.rescueWindowLabel === labelFilter
      )
      .filter((animal) => (typeFilter === ALL_FILTER ? true : animal.animalType === typeFilter))
      .filter((animal) => (regionFilter === ALL_FILTER ? true : animal.region === regionFilter));
  }, [labelFilter, regionFilter, sortedAnimals, typeFilter]);

  const detailAnimal = detailAnimalId
    ? animals.find((animal) => animal.id === detailAnimalId)
    : undefined;
  const activeAnimals = runtimeData.protectedAnimals;
  const urgentAnimals = runtimeData.urgentNotices;
  const soonEndingAnimals = urgentAnimals.filter(
    (animal) => animal.daysUntilNoticeEnd >= 2 && animal.daysUntilNoticeEnd <= 3
  );
  const goldenTimeAnimals = urgentAnimals;
  const topPriorityAnimals = (goldenTimeAnimals.length ? goldenTimeAnimals : sortedAnimals).slice(
    0,
    3
  );
  const regionSignals = useMemo(
    () => buildRegionSignals(animals, runtimeData.regionSummaries),
    [animals, runtimeData.regionSummaries]
  );

  const resetFilters = () => {
    setLabelFilter(ALL_FILTER);
    setTypeFilter(ALL_FILTER);
    setRegionFilter(ALL_FILTER);
  };

  const openDetail = (id: string) => {
    setDetailAnimalId(id);
  };

  return (
    <div className="app-shell">
      <AppHeader
        dataSource={runtimeData.source}
        errorMessage={runtimeData.errorMessage}
        animalCount={animals.length}
        origin={runtimeData.meta.origin}
      />

      <AppNavigation activeView={activeView} placement="top" onChange={setActiveView} />

      <main className="app-main">
        {runtimeData.source === "fallback" && <FallbackWarning />}
        {runtimeData.source !== "loading" && (
          <DataStatusPanel
            meta={runtimeData.meta}
            currentCount={animals.length}
            urgentCount={urgentAnimals.length}
          />
        )}
        {activeView === "overview" && (
          <HomeScreen
            activeCount={activeAnimals.length}
            urgentCount={urgentAnimals.length}
            soonEndingCount={soonEndingAnimals.length}
            goldenCount={goldenTimeAnimals.length}
            topAnimals={topPriorityAnimals}
            regionSignals={regionSignals}
            rescueWindowSummaries={runtimeData.rescueWindowSummaries}
            dataSource={runtimeData.source}
            onOpenGoldenTime={() => setActiveView("golden")}
            onOpenNotices={() => setActiveView("notices")}
            onOpenRegions={() => setActiveView("regions")}
            onOpenSaved={() => setActiveView("saved")}
            onOpenDetail={openDetail}
          />
        )}
        {activeView === "golden" && (
          <GoldenTimeScreen
            animals={goldenTimeAnimals}
            totalUrgentCount={runtimeData.meta.urgentCount ?? goldenTimeAnimals.length}
            truncated={Boolean(runtimeData.meta.truncated)}
            selectedAnimalId={detailAnimal?.id}
            onSelect={openDetail}
          />
        )}
        {activeView === "notices" && (
          <NoticeListScreen
            animals={filteredAnimals}
            selectedAnimalId={detailAnimal?.id}
            labelFilter={labelFilter}
            typeFilter={typeFilter}
            regionFilter={regionFilter}
            animalTypes={animalTypes}
            regions={regions}
            onLabelFilter={setLabelFilter}
            onTypeFilter={setTypeFilter}
            onRegionFilter={setRegionFilter}
            onResetFilters={resetFilters}
            onSelect={openDetail}
            totalCurrentCount={runtimeData.meta.filteredCount ?? animals.length}
            truncated={Boolean(runtimeData.meta.truncated)}
          />
        )}
        {activeView === "regions" && <RegionSummaryScreen regionSignals={regionSignals} />}
        {activeView === "saved" && <SavedNoticesScreen />}
      </main>

      <AppNavigation activeView={activeView} placement="bottom" onChange={setActiveView} />

      {detailAnimal && (
        <NoticeDetailSheet animal={detailAnimal} onClose={() => setDetailAnimalId(null)} />
      )}
    </div>
  );
}

function AppHeader({
  dataSource,
  errorMessage,
  animalCount,
  origin,
}: {
  dataSource: DataSourceState;
  errorMessage?: string;
  animalCount: number;
  origin: ExportedAppData["meta"]["origin"];
}) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true" data-testid="brand-logo" />
        <div className="brand-copy">
          <h1>Shelter Signal</h1>
          <p className="brand-tagline">구조동물 공고 기반 보호소 연락 맥락 PWA</p>
        </div>
      </div>
      <DataSourceNote
        source={dataSource}
        errorMessage={errorMessage}
        animalCount={animalCount}
        origin={origin}
      />
    </header>
  );
}

function FallbackWarning() {
  return (
    <aside className="fallback-warning" role="status">
      공공데이터 API 응답이 불안정하여 샘플 데이터를 표시 중입니다. 실시간 공고가 아닐 수
      있습니다.
    </aside>
  );
}

function DataStatusPanel({
  meta,
  currentCount,
  urgentCount,
}: {
  meta: FreshnessMeta;
  currentCount: number;
  urgentCount: number;
}) {
  const statusItems = [
    ["데이터 소스", meta.source === "api" ? "Live API" : "Fallback"],
    ["조회 기간", `${meta.dateRange.bgnde} ~ ${meta.dateRange.endde}`],
    ["수집 페이지 수", `${meta.pagesFetched ?? 0}페이지`],
    ["현재 공고 수", `${meta.filteredCount ?? currentCount}건`],
    ["종료 임박 공고 수", `${meta.urgentCount ?? urgentCount}건`],
    ["마지막 갱신 시각", formatFetchedAt(meta.fetchedAt)],
  ];

  return (
    <section
      className={`data-status-panel ${meta.source === "fallback" ? "is-fallback" : "is-api"}`}
      aria-label="공공데이터 수집 상태"
      data-testid="data-status-panel"
    >
      <div className="data-status-heading">
        <div>
          <span className="section-kicker">API 상태</span>
          <h2>공고 데이터 수집 현황</h2>
        </div>
        <span className={`source-badge ${meta.source === "api" ? "is-api" : "is-fallback"}`}>
          {meta.source === "api" ? "Live API" : "Fallback"}
        </span>
      </div>
      <dl className="data-status-grid">
        {statusItems.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {meta.truncated && (
        <p className="result-scope-note" role="status">
          전체 조회 결과가 많아 화면에는 최대 {meta.viewLimit ?? currentCount}건만 제공합니다.
          지역 필터와 더 보기를 사용해 필요한 공고를 먼저 확인해 주세요.
        </p>
      )}
    </section>
  );
}

function AppNavigation({
  activeView,
  placement,
  onChange,
}: {
  activeView: ViewKey;
  placement: "top" | "bottom";
  onChange: (view: ViewKey) => void;
}) {
  return (
    <nav className={`${placement}-nav app-nav`} aria-label="주요 화면">
      {viewItems.map((item) => (
        <button
          key={item.key}
          className={activeView === item.key ? "is-active" : ""}
          type="button"
          data-testid={`${item.testId}-${placement}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function HomeScreen({
  activeCount,
  urgentCount,
  soonEndingCount,
  goldenCount,
  topAnimals,
  regionSignals,
  rescueWindowSummaries,
  dataSource,
  onOpenGoldenTime,
  onOpenNotices,
  onOpenRegions,
  onOpenSaved,
  onOpenDetail,
}: {
  activeCount: number;
  urgentCount: number;
  soonEndingCount: number;
  goldenCount: number;
  topAnimals: MockAnimal[];
  regionSignals: RegionSignal[];
  rescueWindowSummaries: RescueWindowSummaryRecord[];
  dataSource: DataSourceState;
  onOpenGoldenTime: () => void;
  onOpenNotices: () => void;
  onOpenRegions: () => void;
  onOpenSaved: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const strongestRegion = regionSignals[0];

  return (
    <div className="screen-stack" data-testid="screen-home">
      <section className="daily-hero">
        <div className="hero-copy">
          <p className="eyebrow">공공데이터 기반 PWA</p>
          <h2>Shelter Signal</h2>
          <p className="hero-lead">
            공공데이터 구조동물 공고와 보호소 연락 맥락을 모바일에서 빠르게 살펴보는
            서비스 실험입니다.
          </p>
          <div className="hero-actions" aria-label="주요 탐색">
            <button className="primary-action" type="button" onClick={onOpenNotices}>
              공고 살펴보기
            </button>
            <button className="secondary-action" type="button" onClick={onOpenRegions}>
              지역 신호 보기
            </button>
          </div>
        </div>
        <div className="hero-card-stack">
          <div className="hero-count" aria-label="오늘 먼저 확인할 골든타임 공고 수">
            <span>우선 확인</span>
            <strong>{goldenCount}</strong>
            <small>골든타임 공고</small>
          </div>
          <p className="hero-footnote">
            {dataSource === "api"
              ? "공고 목록은 공공데이터 API의 현재 공고를 기준으로 표시합니다."
              : dataSource === "loading"
                ? "공공데이터 API의 최신 공고를 확인하고 있습니다."
                : "현재 샘플 fallback 데이터를 표시 중이며 실시간 공고가 아닐 수 있습니다."}
          </p>
        </div>
      </section>

      <section className="signal-stat-row" aria-label="오늘의 요약">
        <SignalStat label="긴급 확인" value={urgentCount} hint="오늘 마감권" tone="urgent" />
        <SignalStat label="곧 종료" value={soonEndingCount} hint="종료 임박" tone="soon" />
        <SignalStat label="보호중" value={activeCount} hint="표시 중" tone="calm" />
      </section>

      <section className="priority-section">
        <SectionHeader
          kicker="우선 확인"
          title="보호 종료 임박 공고"
          actionLabel="골든타임 보기"
          onAction={onOpenGoldenTime}
        />
        <PriorityAnimalList animals={topAnimals} onSelect={onOpenDetail} />
      </section>

      <section className="home-split">
        <button className="region-signal-card" type="button" onClick={onOpenRegions}>
          <span className="section-kicker">지역 신호</span>
          {strongestRegion ? (
            <>
              <strong>{strongestRegion.region}</strong>
              <p>
                긴급 {strongestRegion.urgent}건, 곧 종료 {strongestRegion.endingSoon}건을 먼저
                확인할 수 있어요.
              </p>
              <SignalMeter urgent={strongestRegion.urgent} endingSoon={strongestRegion.endingSoon} />
            </>
          ) : (
            <p>관심 지역의 신호를 차분히 확인할 수 있어요.</p>
          )}
        </button>

        <button className="saved-preview-card" type="button" onClick={onOpenSaved}>
          <span className="section-kicker">다음 단계</span>
          <strong>저장과 알림 준비</strong>
          <p>저장 기능은 아직 준비 중입니다. 현재는 공고 탐색과 공식 연락처 확인에 집중합니다.</p>
        </button>
      </section>

      <section className="info-note">
        <strong>Rescue Window Score</strong>
        <p>
          공고 종료일과 데이터 신호를 바탕으로 먼저 확인할 순서를 정리합니다. 공식 위험
          점수나 예측 모델은 아닙니다.
        </p>
        <MiniWindowSummary summaries={rescueWindowSummaries} />
      </section>
    </div>
  );
}

function SignalStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "urgent" | "soon" | "calm";
}) {
  return (
    <article className={`signal-stat tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function SectionHeader({
  kicker,
  title,
  actionLabel,
  onAction,
}: {
  kicker: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className="section-header">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {actionLabel && onAction && (
        <button className="text-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </header>
  );
}

function MiniWindowSummary({ summaries }: { summaries: RescueWindowSummaryRecord[] }) {
  if (!summaries.length) {
    return null;
  }

  return (
    <div className="mini-window-summary" aria-label="Rescue Window 요약">
      {summaries.slice(0, 4).map((summary) => (
        <span key={`${summary.rescue_window_label}-${summary.deadline_bucket}`}>
          {summary.rescue_window_label} {summary.animal_count}건
        </span>
      ))}
    </div>
  );
}

function PriorityAnimalList({
  animals,
  onSelect,
}: {
  animals: MockAnimal[];
  onSelect: (id: string) => void;
}) {
  if (!animals.length) {
    return (
      <EmptyState
        title="먼저 확인할 공고가 없습니다."
        description="정적 데이터 로딩 상태를 확인하거나 잠시 후 다시 시도해 주세요."
      />
    );
  }

  return (
    <div className="priority-list" aria-label="먼저 확인할 공고">
      {animals.map((animal) => (
        <button
          className="priority-card"
          key={animal.id}
          type="button"
          data-testid="priority-card"
          onClick={() => onSelect(animal.id)}
        >
          <div className="priority-d-day">
            <strong>{animal.ddayText}</strong>
            <span>{animal.rescueWindowLabel}</span>
          </div>
          <div className="priority-main">
            <h3>{animal.kindFullName}</h3>
            <p>
              {animal.region} · {animal.shelterName}
            </p>
          </div>
          <span className="priority-score">{animal.rescueWindowScore}</span>
        </button>
      ))}
    </div>
  );
}

function GoldenTimeScreen({
  animals,
  totalUrgentCount,
  truncated,
  selectedAnimalId,
  onSelect,
}: {
  animals: MockAnimal[];
  totalUrgentCount: number;
  truncated: boolean;
  selectedAnimalId?: string;
  onSelect: (id: string) => void;
}) {
  const regions = useMemo(
    () => Array.from(new Set(animals.map((animal) => animal.region))).sort(),
    [animals]
  );
  const [regionFilter, setRegionFilter] = useState(ALL_FILTER);
  const [visibleCount, setVisibleCount] = useState(NOTICE_PAGE_SIZE);
  const filteredAnimals = useMemo(
    () =>
      regionFilter === ALL_FILTER
        ? animals
        : animals.filter((animal) => animal.region === regionFilter),
    [animals, regionFilter]
  );
  const displayedAnimals = filteredAnimals.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(NOTICE_PAGE_SIZE);
  }, [regionFilter]);

  return (
    <div className="screen-stack" data-testid="screen-golden">
      <ScreenHeader
        kicker="골든타임"
        title="보호 종료가 가까운 공고"
        description="오늘 먼저 확인할 공고부터 정리했어요."
      />
      <section className="signal-note">
        이 화면은 공고 확인 순서를 돕기 위한 탐색용입니다. 공식 문의와 최종 확인은 보호소
        또는 관할기관을 통해 진행해주세요.
      </section>
      <section className="urgent-region-focus" aria-label="종료 임박 공고 지역 필터">
        <div>
          <strong>지역을 먼저 선택해 확인하세요</strong>
          <p>D-Day부터 D-3까지의 공고를 종료일이 가까운 순서로 보여 줍니다.</p>
        </div>
        <FilterSelect
          label="지역"
          value={regionFilter}
          options={[ALL_FILTER, ...regions]}
          testId="urgent-filter-region"
          onChange={setRegionFilter}
        />
      </section>
      <ResultScopeNote
        displayedCount={displayedAnimals.length}
        resultCount={filteredAnimals.length}
        totalCount={totalUrgentCount}
        truncated={truncated}
        label="종료 임박 공고"
      />
      <AnimalCards
        animals={displayedAnimals}
        selectedAnimalId={selectedAnimalId}
        onSelect={onSelect}
        priority
      />
      <LoadMoreControl
        displayedCount={displayedAnimals.length}
        resultCount={filteredAnimals.length}
        onLoadMore={() => setVisibleCount((count) => count + NOTICE_PAGE_SIZE)}
      />
    </div>
  );
}

function NoticeListScreen({
  animals,
  selectedAnimalId,
  labelFilter,
  typeFilter,
  regionFilter,
  animalTypes,
  regions,
  onLabelFilter,
  onTypeFilter,
  onRegionFilter,
  onResetFilters,
  onSelect,
  totalCurrentCount,
  truncated,
}: {
  animals: MockAnimal[];
  selectedAnimalId?: string;
  labelFilter: string;
  typeFilter: string;
  regionFilter: string;
  animalTypes: string[];
  regions: string[];
  onLabelFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onRegionFilter: (value: string) => void;
  onResetFilters: () => void;
  onSelect: (id: string) => void;
  totalCurrentCount: number;
  truncated: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(NOTICE_PAGE_SIZE);
  const activeFilters = [
    ["지역", regionFilter],
    ["신호", labelFilter],
    ["축종", typeFilter],
  ].filter(([, value]) => value !== ALL_FILTER);
  const displayedAnimals = animals.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(NOTICE_PAGE_SIZE);
  }, [labelFilter, regionFilter, typeFilter]);

  return (
    <div className="screen-stack" data-testid="screen-notices">
      <ScreenHeader
        kicker="전체 공고"
        title="공고 살펴보기"
        description="Rescue Window 라벨, 축종, 지역으로 필요한 공고만 좁혀볼 수 있어요."
      />
      <section className="filter-panel" aria-label="공고 필터">
        <FilterSelect
          label="지역"
          value={regionFilter}
          options={[ALL_FILTER, ...regions]}
          testId="filter-region"
          onChange={onRegionFilter}
        />
        <FilterSelect
          label="Rescue Window"
          value={labelFilter}
          options={[ALL_FILTER, ...rescueWindowLabels]}
          testId="filter-window"
          onChange={onLabelFilter}
        />
        <FilterSelect
          label="축종"
          value={typeFilter}
          options={[ALL_FILTER, ...animalTypes]}
          testId="filter-type"
          onChange={onTypeFilter}
        />
      </section>
      <div className="filter-summary" aria-live="polite">
        <strong>{displayedAnimals.length}건 표시</strong>
        {animals.length !== displayedAnimals.length && <span>필터 결과 {animals.length}건 중</span>}
        {activeFilters.length ? (
          <>
            {activeFilters.map(([label, value]) => (
              <span className="filter-chip" key={label}>
                {label}: {value}
              </span>
            ))}
            <button type="button" onClick={onResetFilters}>
              초기화
            </button>
          </>
        ) : (
          <span>적용된 필터가 없습니다.</span>
        )}
      </div>
      <ResultScopeNote
        resultCount={animals.length}
        displayedCount={displayedAnimals.length}
        totalCount={totalCurrentCount}
        truncated={truncated}
        label="현재 공고"
      />
      <AnimalCards
        animals={displayedAnimals}
        selectedAnimalId={selectedAnimalId}
        onSelect={onSelect}
      />
      <LoadMoreControl
        displayedCount={displayedAnimals.length}
        resultCount={animals.length}
        onLoadMore={() => setVisibleCount((count) => count + NOTICE_PAGE_SIZE)}
      />
    </div>
  );
}

function ResultScopeNote({
  resultCount,
  displayedCount,
  totalCount,
  truncated,
  label,
}: {
  resultCount: number;
  displayedCount: number;
  totalCount: number;
  truncated: boolean;
  label: string;
}) {
  return (
    <section className="notice-display-control" aria-label={`${label} 표시 범위`}>
      <div>
        <strong>{label} 표시 범위</strong>
        <p>
          {truncated
            ? `API 조회 결과 ${totalCount}건 중 화면 응답으로 제공된 ${resultCount}건을 탐색합니다.`
            : `조회된 ${resultCount}건을 탐색합니다.`}
        </p>
      </div>
      <span className="notice-display-count" aria-live="polite">
        {displayedCount}/{resultCount}건
      </span>
    </section>
  );
}

function LoadMoreControl({
  displayedCount,
  resultCount,
  onLoadMore,
}: {
  displayedCount: number;
  resultCount: number;
  onLoadMore: () => void;
}) {
  if (displayedCount >= resultCount) {
    return null;
  }

  return (
    <div className="load-more-control">
      <button type="button" data-testid="load-more-notices" onClick={onLoadMore}>
        공고 더 보기
      </button>
      <span>
        {displayedCount}/{resultCount}건 표시 중
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  testId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnimalCards({
  animals,
  selectedAnimalId,
  onSelect,
  priority = false,
}: {
  animals: MockAnimal[];
  selectedAnimalId?: string;
  onSelect: (id: string) => void;
  priority?: boolean;
}) {
  if (!animals.length) {
    return (
      <EmptyState
        title="조건에 맞는 공고가 없습니다."
        description="필터를 줄이거나 전체 지역으로 다시 확인해보세요."
      />
    );
  }

  return (
    <section className="notice-list" aria-label="동물 공고">
      {animals.map((animal) => (
        <button
          key={animal.id}
          className={`notice-card ${priority ? "is-priority" : ""} ${
            selectedAnimalId === animal.id ? "is-selected" : ""
          }`}
          type="button"
          data-testid="notice-card"
          onClick={() => onSelect(animal.id)}
        >
          <PhotoPlaceholder animal={animal} />
          <div className="notice-card-body">
            <div className="notice-card-top">
              <DeadlineBadge animal={animal} />
              <WindowBadge label={animal.rescueWindowLabel} />
            </div>
            <div>
              <h3>{animal.kindFullName}</h3>
              <p className="notice-subtitle">
                {animal.region} · {animal.shelterName}
              </p>
            </div>
            <div className="notice-tags">
              <span>{animal.processState}</span>
              <span>{animal.animalType}</span>
              <span>{animal.hasPhoto ? "사진 있음" : "사진 없음"}</span>
            </div>
            <div className="score-line">
              <span>Rescue Window {animal.rescueWindowScore}</span>
              <ScoreBar score={animal.rescueWindowScore} />
            </div>
          </div>
        </button>
      ))}
    </section>
  );
}

function RegionSummaryScreen({ regionSignals }: { regionSignals: RegionSignal[] }) {
  const [selectedSido, setSelectedSido] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [shelterStatus, setShelterStatus] = useState<ShelterLoadState>("idle");
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [shelterErrorCode, setShelterErrorCode] = useState<ShelterApiErrorCode | null>(null);
  const regionGroups = useMemo(() => buildRegionSelectorGroups(regionSignals), [regionSignals]);
  const selectedGroup = regionGroups.find((group) => group.sido === selectedSido);
  const districtOptions = selectedGroup?.districts ?? [];
  const selectedDistrictOption = districtOptions.find((option) => option.value === selectedDistrict);
  const selectedRegionSignal = selectedDistrictOption?.signal;
  const hasCompletedSelection = Boolean(selectedSido && selectedDistrict);
  const selectedSigunguLabel = selectedDistrictOption?.label ?? "";
  const selectedTotals = selectedRegionSignal
    ? summarizeRegionSignals([selectedRegionSignal])
    : undefined;
  const selectedRegionLabel =
    selectedRegionSignal?.region ??
    [selectedSido, selectedDistrictOption?.label].filter(Boolean).join(" ");
  const selectedRegionCodes = useMemo(
    () => getRegionCodes(selectedSido, selectedSigunguLabel),
    [selectedSido, selectedSigunguLabel]
  );

  useEffect(() => {
    if (!selectedSido || !selectedSigunguLabel) {
      setShelterStatus("idle");
      setShelters([]);
      setShelterErrorCode(null);
      return;
    }

    const controller = new AbortController();
    setShelterStatus("loading");
    setShelters([]);
    setShelterErrorCode(null);

    fetchSheltersByRegion({
      sido: selectedSido,
      sigungu: selectedSigunguLabel,
      ...selectedRegionCodes,
      signal: controller.signal,
    })
      .then((nextShelters) => {
        setShelters(nextShelters);
        setShelterStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setShelters([]);
        setShelterErrorCode(error instanceof ShelterApiError ? error.code : "UNKNOWN");
        setShelterStatus("error");
      });

    return () => controller.abort();
  }, [selectedRegionCodes, selectedSido, selectedSigunguLabel]);

  const handleSidoChange = (value: string) => {
    setSelectedSido(value);
    setSelectedDistrict("");
  };

  const regionResult = !hasCompletedSelection ? (
    <ShelterDataPanel status="idle" shelters={[]} selectedRegionLabel="" />
  ) : (
    <>
      {selectedRegionSignal && selectedTotals ? (
        <>
          <section className="selected-region-panel" aria-label="선택한 지역 요약">
            <div>
              <span className="section-kicker">선택한 지역</span>
              <h3>{selectedRegionLabel}</h3>
              <p>
                현재 정적 공고 데이터 기준으로 공고 {selectedTotals.total}건을 확인하고 있어요.
              </p>
            </div>
            <dl className="selected-region-metrics">
              <SummaryNumber label="긴급" value={selectedTotals.urgent} />
              <SummaryNumber label="곧 종료" value={selectedTotals.endingSoon} />
              <SummaryNumber label="평균 점수" value={selectedTotals.averageScore} />
            </dl>
            <p className="region-limit-note">
              별도 전체 보호소 디렉터리는 제공하지 않습니다. 보호소 홈페이지, 운영시간, 좌표
              정보는 공공데이터 제공 여부와 API 권한을 확인한 뒤 업데이트할 예정입니다.
            </p>
          </section>

          <section className="region-card-list" aria-label="선택한 지역 공고 요약">
            <RegionCard summary={selectedRegionSignal} />
          </section>
        </>
      ) : (
        <section className="empty-state region-empty-state" role="status">
          <strong>
            현재 선택한 지역의 보호소 정보는 준비 중입니다. 공공데이터 제공 여부를 확인한 뒤
            업데이트할 예정입니다.
          </strong>
          <p>지원하지 않는 API 정보를 임의로 표시하지 않습니다.</p>
        </section>
      )}

      <ShelterDataPanel
        status={shelterStatus}
        shelters={shelters}
        errorCode={shelterErrorCode}
        selectedRegionLabel={selectedRegionLabel}
      />
    </>
  );

  return (
    <div className="screen-stack" data-testid="screen-regions">
      <ScreenHeader
        kicker="지역 신호"
        title="관심 지역의 흐름"
        description="시/도와 시/군/구를 선택해 현재 데이터에 포함된 공고 흐름과 보호소 연락 맥락을 확인해보세요."
      />

      <section className="region-explorer" aria-label="지역 신호 선택">
        <div className="region-explorer-copy">
          <span className="section-kicker">지역 선택</span>
          <p>
            현재 export된 공공데이터 기반 공고 지역만 표시합니다. 보호소 연락 맥락은 구조동물
            공고에 포함된 필드 기준으로만 정리합니다.
          </p>
        </div>

        <div className="region-selector-grid">
          <label className="region-select-control">
            <span>시/도 선택</span>
            <select
              value={selectedSido}
              data-testid="region-sido-select"
              onChange={(event) => handleSidoChange(event.target.value)}
            >
              <option value="">시/도 선택</option>
              {regionGroups.map((group) => (
                <option key={group.sido} value={group.sido}>
                  {group.sido}
                </option>
              ))}
            </select>
          </label>

          <label className="region-select-control">
            <span>시/군/구 선택</span>
            <select
              value={selectedDistrict}
              disabled={!selectedSido}
              data-testid="region-district-select"
              onChange={(event) => setSelectedDistrict(event.target.value)}
            >
              <option value="">{selectedSido ? "시/군/구 선택" : "시/도를 먼저 선택"}</option>
              {districtOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="selected-region-inline" aria-live="polite">
          <span>선택 지역</span>
          <strong>{selectedRegionLabel || "아직 선택되지 않음"}</strong>
        </div>
      </section>

      {regionResult}
    </div>
  );
}

function RegionCard({ summary }: { summary: RegionSignal }) {
  return (
    <article
      className={`region-card ${summary.urgent > 0 ? "has-urgent" : ""}`}
      data-testid="region-card"
    >
      <div className="region-card-main">
        <span className="section-kicker">{summary.urgent > 0 ? "우선 확인" : "일반 신호"}</span>
        <h3>{summary.region}</h3>
        <p>총 {summary.total}건의 공고</p>
      </div>
      <dl className="region-counts">
        <SummaryNumber label="긴급" value={summary.urgent} />
        <SummaryNumber label="곧 종료" value={summary.endingSoon} />
        <SummaryNumber label="평균 점수" value={summary.averageScore} />
      </dl>
      <SignalMeter urgent={summary.urgent} endingSoon={summary.endingSoon} />
    </article>
  );
}

function SummaryNumber({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SavedNoticesScreen() {
  return (
    <div className="screen-stack" data-testid="screen-saved">
      <ScreenHeader
        kicker="관심 공고"
        title="저장한 공고"
        description="저장과 알림은 다음 단계로 준비 중인 흐름입니다."
      />
      <section className="saved-empty">
        <div className="saved-icon" aria-hidden="true">
          저장
        </div>
        <div>
          <strong>저장 기능은 아직 구현 전입니다.</strong>
          <p>현재 버전은 공고 탐색, 지역 신호, 보호소 연락처 확인 흐름을 안정적으로 보여줍니다.</p>
        </div>
      </section>
    </div>
  );
}

function NoticeDetailSheet({
  animal,
  onClose,
}: {
  animal: MockAnimal;
  onClose: () => void;
}) {
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <section
        className="detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        data-testid="detail-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="sheet-close" type="button" data-testid="detail-close" onClick={onClose}>
          닫기
        </button>

        <div className="detail-visual">
          <PhotoPlaceholder animal={animal} large />
          <div className="detail-signal">
            <DeadlineBadge animal={animal} large />
            <WindowBadge label={animal.rescueWindowLabel} />
            <span className="process-chip">{animal.processState}</span>
          </div>
        </div>

        <header className="detail-title">
          <p className="section-kicker">공고 상세</p>
          <h2 id="detail-title">{animal.kindFullName}</h2>
          <p>{animal.region}</p>
        </header>

        <DetailSection title="공식 공고 정보">
          <DetailItem label="공고번호" value={animal.noticeNo} />
          <DetailItem label="공고 시작" value={animal.noticeStartDate} />
          <DetailItem label="공고 종료" value={animal.noticeEndDate} />
          <DetailItem label="발견일" value={animal.happenDate} />
          <DetailItem label="발견 장소" value={animal.happenPlace} />
        </DetailSection>

        <DetailSection title="동물 정보">
          <DetailItem label="품종" value={animal.kindFullName} />
          <DetailItem label="성별" value={animal.sex} />
          <DetailItem label="나이" value={animal.age} />
          <DetailItem label="체중" value={animal.weight} />
          <DetailItem label="색상" value={animal.color} />
          <DetailItem label="중성화" value={animal.neuterYn} />
          <DetailItem label="특징" value={animal.specialMark} />
        </DetailSection>

        <DetailSection title="보호소 및 연락처">
          <DetailItem label="보호소" value={animal.shelterName} />
          <DetailItem label="전화" value={animal.shelterTel ?? "데이터 없음"} />
          <DetailItem label="주소" value={animal.shelterAddress} />
          <DetailItem label="관할기관" value={animal.region} />
        </DetailSection>

        <ContactActions animal={animal} />

        <p className="official-disclaimer" id="official-contact-guide">
          공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.
        </p>
      </section>
    </div>
  );
}

function ContactActions({ animal }: { animal: MockAnimal }) {
  const telHref = telLink(animal.shelterTel);

  return (
    <div className="contact-actions" aria-label="보호소 문의 도구">
      {telHref ? (
        <a className="contact-action" href={telHref} data-testid="contact-tel">
          전화번호 보기
        </a>
      ) : (
        <span className="contact-action is-disabled" aria-disabled="true" data-testid="contact-tel">
          전화번호 없음
        </span>
      )}
      <span className="contact-action is-static" title={animal.shelterAddress} data-testid="contact-address">
        주소 확인
      </span>
      <a className="contact-action" href="#official-contact-guide" data-testid="contact-guide">
        공식 문의 안내
      </a>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ScreenHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <header className="screen-header">
      <p className="section-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="empty-state" role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}

function DataSourceNote({
  source,
  errorMessage,
  animalCount,
  origin,
}: {
  source: DataSourceState;
  errorMessage?: string;
  animalCount: number;
  origin: ExportedAppData["meta"]["origin"];
}) {
  return (
    <p className={`data-note is-${source}`} aria-live="polite" title={errorMessage}>
      {dataSourceCopy(source, animalCount, origin)}
    </p>
  );
}

function WindowBadge({ label }: { label: RescueWindowLabel }) {
  return <span className={`label-pill label-${labelClass(label)}`}>{label}</span>;
}

function DeadlineBadge({ animal, large = false }: { animal: MockAnimal; large?: boolean }) {
  return (
    <div className={`deadline-badge ${large ? "is-large" : ""}`}>
      <strong>{animal.ddayText}</strong>
      <span>{animal.deadlineBucket}</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="score-bar" aria-label={`Rescue Window Score ${score}점`}>
      <span style={scoreStyle(score)} />
    </div>
  );
}

function SignalMeter({ urgent, endingSoon }: { urgent: number; endingSoon: number }) {
  return (
    <div className="signal-meter" aria-label={`긴급 ${urgent}건, 곧 종료 ${endingSoon}건`}>
      <span style={signalStyle(urgent, endingSoon)} />
    </div>
  );
}

function PhotoPlaceholder({
  animal,
  large = false,
}: {
  animal: MockAnimal;
  large?: boolean;
}) {
  return (
    <div
      className={`photo-placeholder tone-${animal.photoTone} ${large ? "is-large" : ""}`}
      aria-label={animal.hasPhoto ? "공고 이미지 자리" : "사진 미등록"}
    >
      <span>{animal.animalType}</span>
      <strong>{animal.breed.slice(0, 5)}</strong>
      <small>{animal.hasPhoto ? "image" : "no image"}</small>
    </div>
  );
}

function sortByWindow(animals: MockAnimal[]) {
  return [...animals].sort(
    (a, b) =>
      labelOrder[a.rescueWindowLabel] - labelOrder[b.rescueWindowLabel] ||
      a.daysUntilNoticeEnd - b.daysUntilNoticeEnd ||
      b.rescueWindowScore - a.rescueWindowScore
  );
}

function buildRegionSignals(
  animals: MockAnimal[],
  summaries: RegionSummaryRecord[]
): RegionSignal[] {
  if (summaries.length) {
    return summaries
      .map((summary) => ({
        region: summary.org_nm,
        total: summary.animal_count,
        urgent: summary.urgent_count,
        endingSoon: summary.ending_soon_count,
        averageScore: Math.round(summary.avg_rescue_window_score),
      }))
      .sort((a, b) => b.urgent - a.urgent || b.endingSoon - a.endingSoon || b.total - a.total);
  }

  const grouped = new Map<string, MockAnimal[]>();
  animals.forEach((animal) => {
    grouped.set(animal.region, [...(grouped.get(animal.region) ?? []), animal]);
  });

  return Array.from(grouped.entries())
    .map(([region, regionAnimals]) => ({
      region,
      total: regionAnimals.length,
      urgent: regionAnimals.filter((animal) => animal.rescueWindowLabel === "긴급 확인").length,
      endingSoon: regionAnimals.filter((animal) =>
        ["긴급 확인", "곧 종료"].includes(animal.rescueWindowLabel)
      ).length,
      averageScore: Math.round(
        regionAnimals.reduce((sum, animal) => sum + animal.rescueWindowScore, 0) /
          regionAnimals.length
      ),
    }))
    .sort((a, b) => b.urgent - a.urgent || b.endingSoon - a.endingSoon || b.total - a.total);
}

function summarizeRegionSignals(regionSignals: RegionSignal[]): RegionSignalTotals {
  const total = regionSignals.reduce((sum, signal) => sum + signal.total, 0);
  const weightedScore = regionSignals.reduce(
    (sum, signal) => sum + signal.averageScore * signal.total,
    0
  );

  return {
    total,
    urgent: regionSignals.reduce((sum, signal) => sum + signal.urgent, 0),
    endingSoon: regionSignals.reduce((sum, signal) => sum + signal.endingSoon, 0),
    averageScore: total ? Math.round(weightedScore / total) : 0,
    regionCount: regionSignals.length,
  };
}

function ShelterDataPanel({
  status,
  shelters,
  errorCode,
  selectedRegionLabel,
}: {
  status: ShelterLoadState;
  shelters: Shelter[];
  errorCode?: ShelterApiErrorCode | null;
  selectedRegionLabel: string;
}) {
  if (status === "idle") {
    return (
      <section className="empty-state region-empty-state" role="status">
        <strong>지역을 선택하면 보호소 정보가 여기에 표시됩니다.</strong>
        <p>시/도와 시/군/구를 차례로 선택해 주세요.</p>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="shelter-data-panel" role="status" aria-busy="true">
        <span className="section-kicker">보호소 조회</span>
        <h3>보호소 정보를 불러오고 있어요.</h3>
        <p>{selectedRegionLabel}의 공공데이터 응답을 확인하고 있어요.</p>
      </section>
    );
  }

  if (status === "error") {
    const message =
      errorCode === "MISSING_SERVICE_KEY"
        ? "보호소 정보를 확인할 수 없습니다. 배포 환경 변수를 확인해주세요."
        : errorCode === "UPSTREAM_FORBIDDEN"
          ? "공공데이터 API 권한 또는 서비스 승인 상태를 확인해야 합니다."
        : "공공데이터 API 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";

    return (
      <section className="shelter-data-panel is-error" role="alert">
        <span className="section-kicker">보호소 조회</span>
        <h3>{message}</h3>
        <p>공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.</p>
      </section>
    );
  }

  if (!shelters.length) {
    return (
      <section className="shelter-data-panel" role="status">
        <span className="section-kicker">보호소 조회</span>
        <h3>선택한 지역의 보호소 데이터가 아직 확인되지 않았습니다.</h3>
        <p>
          현재 선택한 지역의 보호소 정보는 준비 중입니다. 공공데이터 제공 여부를 확인한 뒤
          업데이트할 예정입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="shelter-data-panel" aria-label={`${selectedRegionLabel} 보호소 데이터`}>
      <div className="shelter-data-heading">
        <div>
          <span className="section-kicker">보호소 조회</span>
          <h3>{selectedRegionLabel} 보호소 정보</h3>
        </div>
        <span>{shelters.length}곳</span>
      </div>
      <p className="shelter-source-note">구조동물 공고 기반 보호소 연락 맥락</p>
      <div className="shelter-card-list">
        {shelters.map((shelter) => (
          <ShelterCard key={shelter.id} shelter={shelter} />
        ))}
      </div>
      <p className="shelter-api-note">
        전체 공식 보호소 디렉터리가 아니라 구조동물 공고에 포함된 보호소명, 전화번호, 주소,
        관할기관 정보를 기준으로 정리했어요. 최종 확인은 보호소 또는 관할기관을 통해
        진행해주세요.
      </p>
    </section>
  );
}

function ShelterCard({ shelter }: { shelter: Shelter }) {
  return (
    <article className="shelter-card">
      <h4>{shelter.name}</h4>
      <dl className="shelter-meta-list">
        {shelter.address && <ShelterMetaItem label="주소" value={shelter.address} />}
        {shelter.phone && (
          <ShelterMetaItem label="전화" value={shelter.phone} href={telLink(shelter.phone)} />
        )}
        {shelter.jurisdiction && <ShelterMetaItem label="관할" value={shelter.jurisdiction} />}
      </dl>
    </article>
  );
}

function ShelterMetaItem({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{href ? <a href={href}>{value}</a> : value}</dd>
    </div>
  );
}

function buildRegionSelectorGroups(regionSignals: RegionSignal[]): RegionSelectorGroup[] {
  const groups = new Map<string, RegionDistrictOption[]>();

  regionSignals.forEach((signal) => {
    const { sido, district } = splitRegionName(signal.region);
    const districts = groups.get(sido) ?? [];
    districts.push({ label: district, value: signal.region, signal });
    groups.set(sido, districts);
  });

  return Array.from(groups.entries())
    .map(([sido, districts]) => ({
      sido,
      districts: districts.sort((a, b) => a.label.localeCompare(b.label, "ko")),
    }))
    .sort((a, b) => a.sido.localeCompare(b.sido, "ko"));
}

function splitRegionName(region: string): { sido: string; district: string } {
  const parts = region.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { sido: "지역 미상", district: "상세 지역 미상" };
  }
  if (parts.length === 1) {
    return { sido: parts[0], district: "전체" };
  }
  return { sido: parts[0], district: parts.slice(1).join(" ") };
}

function telLink(tel: string | null): string | undefined {
  const normalized = tel?.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : undefined;
}

function scoreStyle(score: number): CSSProperties & { "--score": string } {
  return { "--score": `${Math.max(0, Math.min(score, 100))}%` };
}

function signalStyle(urgent: number, endingSoon: number): CSSProperties & { "--signal": string } {
  const value = Math.min(100, urgent * 28 + endingSoon * 14);
  return { "--signal": `${value}%` };
}

function dataSourceCopy(
  source: DataSourceState,
  animalCount: number,
  origin: ExportedAppData["meta"]["origin"]
): string {
  if (source === "loading") {
    return "최신 공고 확인 중";
  }
  if (source === "api") {
    return `공공데이터 API · 현재 공고 ${animalCount}건`;
  }
  const fallbackLabel =
    origin === "operational-postgres"
      ? "DB fallback"
      : origin === "static-export"
        ? "Static fallback"
        : `Mock fallback · ${MOCK_REFERENCE_DATE}`;
  return `${fallbackLabel} · 현재 공고 ${animalCount}건`;
}

function formatFetchedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelClass(label: RescueWindowLabel) {
  switch (label) {
    case "긴급 확인":
      return "urgent";
    case "곧 종료":
      return "soon";
    case "확인 필요":
      return "watch";
    case "여유 있음":
      return "calm";
    default:
      return "closed";
  }
}

export default App;
