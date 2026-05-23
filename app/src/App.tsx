import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import {
  MOCK_REFERENCE_DATE,
  MockAnimal,
  RescueWindowLabel,
  mockAnimals,
  rescueWindowLabels,
} from "./data/mockAnimals";

type ViewKey = "overview" | "golden" | "notices" | "regions" | "saved";

const ALL_FILTER = "전체";

const viewItems: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "홈" },
  { key: "golden", label: "골든 타임" },
  { key: "notices", label: "공고 목록" },
  { key: "regions", label: "지역 요약" },
  { key: "saved", label: "저장 공고" },
];

const labelOrder: Record<RescueWindowLabel, number> = {
  "긴급 확인": 1,
  "곧 종료": 2,
  "확인 필요": 3,
  "여유 있음": 4,
  "종료/확인 필요": 5,
};

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [labelFilter, setLabelFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [regionFilter, setRegionFilter] = useState(ALL_FILTER);
  const [selectedAnimalId, setSelectedAnimalId] = useState(mockAnimals[0]?.id ?? "");

  const animalTypes = useMemo(
    () => Array.from(new Set(mockAnimals.map((animal) => animal.animalType))),
    []
  );
  const regions = useMemo(
    () => Array.from(new Set(mockAnimals.map((animal) => animal.region))).sort(),
    []
  );

  const sortedAnimals = useMemo(() => sortByWindow(mockAnimals), []);
  const filteredAnimals = useMemo(() => {
    return sortedAnimals
      .filter((animal) =>
        labelFilter === ALL_FILTER ? true : animal.rescueWindowLabel === labelFilter
      )
      .filter((animal) => (typeFilter === ALL_FILTER ? true : animal.animalType === typeFilter))
      .filter((animal) => (regionFilter === ALL_FILTER ? true : animal.region === regionFilter));
  }, [labelFilter, regionFilter, sortedAnimals, typeFilter]);

  const selectedAnimal =
    mockAnimals.find((animal) => animal.id === selectedAnimalId) ?? filteredAnimals[0];

  const activeAnimals = mockAnimals.filter((animal) => animal.processState === "보호중");
  const urgentAnimals = mockAnimals.filter((animal) => animal.rescueWindowLabel === "긴급 확인");
  const goldenTimeAnimals = sortedAnimals.filter((animal) =>
    ["긴급 확인", "곧 종료"].includes(animal.rescueWindowLabel)
  );
  const averageScore = Math.round(
    mockAnimals.reduce((sum, animal) => sum + animal.rescueWindowScore, 0) / mockAnimals.length
  );
  const missingPhotoCount = mockAnimals.filter((animal) => !animal.hasPhoto).length;

  const resetFilters = () => {
    setLabelFilter(ALL_FILTER);
    setTypeFilter(ALL_FILTER);
    setRegionFilter(ALL_FILTER);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">공공데이터 기반 구조동물 모니터링</p>
          <h1>Shelter Signal</h1>
          <p className="intro">
            보호 종료가 가까운 공고를 먼저 확인해보세요. 공식 문의는 보호소 또는
            관할기관을 통해 확인해주세요.
          </p>
        </div>
        <div className="status-panel" aria-label="데이터 상태">
          <span>데이터 기준일</span>
          <strong>{MOCK_REFERENCE_DATE}</strong>
          <small>시범 데이터</small>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="주요 화면">
        {viewItems.map((item) => (
          <button
            key={item.key}
            className={activeView === item.key ? "is-active" : ""}
            type="button"
            onClick={() => setActiveView(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="layout">
        <aside className="sidebar" aria-label="화면 선택">
          <div className="brand-mark" aria-hidden="true">
            SS
          </div>
          <p>Rescue Window</p>
          {viewItems.map((item) => (
            <button
              key={item.key}
              className={activeView === item.key ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <section className="content-area">
          {activeView === "overview" && (
            <Overview
              activeCount={activeAnimals.length}
              urgentCount={urgentAnimals.length}
              goldenCount={goldenTimeAnimals.length}
              averageScore={averageScore}
              missingPhotoCount={missingPhotoCount}
              topAnimals={goldenTimeAnimals.slice(0, 3)}
              onOpenGoldenTime={() => setActiveView("golden")}
            />
          )}
          {activeView === "golden" && (
            <GoldenTimeList
              animals={goldenTimeAnimals}
              selectedAnimalId={selectedAnimal?.id}
              onSelect={setSelectedAnimalId}
            />
          )}
          {activeView === "notices" && (
            <NoticeList
              animals={filteredAnimals}
              selectedAnimalId={selectedAnimal?.id}
              labelFilter={labelFilter}
              typeFilter={typeFilter}
              regionFilter={regionFilter}
              animalTypes={animalTypes}
              regions={regions}
              onLabelFilter={setLabelFilter}
              onTypeFilter={setTypeFilter}
              onRegionFilter={setRegionFilter}
              onResetFilters={resetFilters}
              onSelect={setSelectedAnimalId}
            />
          )}
          {activeView === "regions" && <RegionSummary animals={mockAnimals} />}
          {activeView === "saved" && <SavedNotices />}
        </section>

        <AnimalDetail animal={selectedAnimal} />
      </main>
    </div>
  );
}

function Overview({
  activeCount,
  urgentCount,
  goldenCount,
  averageScore,
  missingPhotoCount,
  topAnimals,
  onOpenGoldenTime,
}: {
  activeCount: number;
  urgentCount: number;
  goldenCount: number;
  averageScore: number;
  missingPhotoCount: number;
  topAnimals: MockAnimal[];
  onOpenGoldenTime: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Rescue Window Score</p>
          <h2>공고 종료까지 남은 시간과 데이터 신호를 함께 봅니다.</h2>
          <p>
            Rescue Window Score는 남은 공고 기간, 사진과 연락처 유무, 공고 상태를
            함께 읽어 우선 확인 순서를 제안하는 내부 지표입니다.
          </p>
          <button className="primary-action" type="button" onClick={onOpenGoldenTime}>
            골든 타임 공고 보기
          </button>
        </div>
        <div className="priority-preview" aria-label="우선 확인 미리보기">
          <span className="section-kicker">오늘 먼저 볼 공고</span>
          {topAnimals.map((animal) => (
            <div className="preview-row" key={animal.id}>
              <span className={`label-dot label-${labelClass(animal.rescueWindowLabel)}`} />
              <div>
                <strong>{animal.ddayText}</strong>
                <p>
                  {animal.region} · {animal.breed}
                </p>
              </div>
              <span>{animal.rescueWindowScore}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="metric-grid" aria-label="요약 지표">
        <Metric label="긴급 확인" value={urgentCount} hint="D-Day 또는 D-1 공고" />
        <Metric label="3일 이내" value={goldenCount} hint="우선 확인 큐" />
        <Metric label="보호중 공고" value={activeCount} hint="현재 표시 데이터" />
        <Metric label="사진 없음" value={missingPhotoCount} hint="추가 확인 신호" />
        <Metric label="평균 점수" value={averageScore} hint="Rescue Window Score" />
      </section>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function GoldenTimeList({
  animals,
  selectedAnimalId,
  onSelect,
}: {
  animals: MockAnimal[];
  selectedAnimalId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="view-stack">
      <ViewHeader
        kicker="우선 확인 큐"
        title="골든 타임 리스트"
        description="보호 종료가 가까운 공고를 먼저 확인할 수 있도록 Rescue Window Score 순서로 정리했습니다."
      />
      <p className="signal-note">
        이 목록은 공식 결과가 아니라 확인 순서를 돕는 신호입니다. 최종 상태는 보호소 또는
        관할기관 공고로 확인해주세요.
      </p>
      <AnimalCards
        animals={animals}
        selectedAnimalId={selectedAnimalId}
        onSelect={onSelect}
        priority
      />
    </div>
  );
}

function NoticeList({
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
}) {
  const activeFilters = [
    ["윈도우", labelFilter],
    ["축종", typeFilter],
    ["지역", regionFilter],
  ].filter(([, value]) => value !== ALL_FILTER);

  return (
    <div className="view-stack">
      <ViewHeader
        kicker="전체 공고"
        title="동물 공고 목록"
        description="Rescue Window 라벨, 축종, 지역으로 공고를 좁혀볼 수 있습니다."
      />
      <section className="filters" aria-label="공고 필터">
        <FilterSelect
          label="Rescue Window"
          value={labelFilter}
          options={[ALL_FILTER, ...rescueWindowLabels]}
          onChange={onLabelFilter}
        />
        <FilterSelect
          label="축종"
          value={typeFilter}
          options={[ALL_FILTER, ...animalTypes]}
          onChange={onTypeFilter}
        />
        <FilterSelect
          label="지역"
          value={regionFilter}
          options={[ALL_FILTER, ...regions]}
          onChange={onRegionFilter}
        />
      </section>
      <div className="filter-summary" aria-live="polite">
        <span>{animals.length}건 표시</span>
        {activeFilters.length ? (
          <>
            {activeFilters.map(([label, value]) => (
              <span className="filter-chip" key={label}>
                {label}: {value}
              </span>
            ))}
            <button type="button" onClick={onResetFilters}>
              필터 초기화
            </button>
          </>
        ) : (
          <span className="muted">필터 없음</span>
        )}
      </div>
      <AnimalCards animals={animals} selectedAnimalId={selectedAnimalId} onSelect={onSelect} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
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
      <section className="empty-state">
        <strong>조건에 맞는 공고가 없습니다.</strong>
        <p>필터를 줄이거나 다른 지역을 선택해보세요.</p>
      </section>
    );
  }

  return (
    <section className="animal-list" aria-label="동물 공고">
      {animals.map((animal) => (
        <button
          key={animal.id}
          className={`animal-card ${priority ? "is-priority" : ""} ${
            selectedAnimalId === animal.id ? "is-selected" : ""
          }`}
          type="button"
          onClick={() => onSelect(animal.id)}
        >
          <PhotoPlaceholder animal={animal} />
          <div className="animal-card-body">
            <div className="card-topline">
              <WindowBadge label={animal.rescueWindowLabel} />
              <DeadlineBadge animal={animal} />
            </div>
            <div>
              <h3>{animal.kindFullName}</h3>
              <p className="card-subtitle">
                {animal.region} · {animal.shelterName}
              </p>
            </div>
            <dl className="mini-facts">
              <div>
                <dt>상태</dt>
                <dd>{animal.processState}</dd>
              </div>
              <div>
                <dt>점수</dt>
                <dd>{animal.rescueWindowScore}</dd>
              </div>
              <div>
                <dt>사진</dt>
                <dd>{animal.hasPhoto ? "있음" : "없음"}</dd>
              </div>
            </dl>
            <ScoreBar score={animal.rescueWindowScore} />
          </div>
        </button>
      ))}
    </section>
  );
}

function RegionSummary({ animals }: { animals: MockAnimal[] }) {
  const summaries = useMemo(() => {
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
  }, [animals]);

  return (
    <div className="view-stack">
      <ViewHeader
        kicker="지역별 현황"
        title="지역 요약"
        description="관심 지역의 공고를 차분히 확인할 수 있어요."
      />
      <section className="summary-table" aria-label="지역별 요약">
        {summaries.map((summary) => (
          <article
            key={summary.region}
            className={`summary-row ${summary.urgent > 0 ? "has-urgent" : ""}`}
          >
            <div className="summary-main">
              <span className="section-kicker">{summary.urgent > 0 ? "우선 확인" : "일반"}</span>
              <h3>{summary.region}</h3>
              <p>총 {summary.total}건의 공고</p>
            </div>
            <dl>
              <div>
                <dt>긴급</dt>
                <dd>{summary.urgent}</dd>
              </div>
              <div>
                <dt>3일 이내</dt>
                <dd>{summary.endingSoon}</dd>
              </div>
              <div>
                <dt>평균 점수</dt>
                <dd>{summary.averageScore}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}

function SavedNotices() {
  return (
    <div className="view-stack">
      <ViewHeader
        kicker="나중에 볼 공고"
        title="저장 공고"
        description="관심 공고를 따로 모아 확인하는 공간입니다."
      />
      <section className="saved-placeholder">
        <div className="saved-symbol" aria-hidden="true">
          저장
        </div>
        <div>
          <strong>저장한 공고가 아직 없습니다.</strong>
          <p>
            이후 단계에서 저장 공고와 알림 흐름을 연결할 예정입니다. 현재는 화면 구조와
            Rescue Window 표시 방식을 먼저 확인합니다.
          </p>
        </div>
      </section>
    </div>
  );
}

function AnimalDetail({ animal }: { animal?: MockAnimal }) {
  if (!animal) {
    return (
      <aside className="detail-panel">
        <p>선택된 공고가 없습니다.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel" aria-label="동물 상세">
      <div className="detail-header">
        <PhotoPlaceholder animal={animal} compact />
        <div>
          <WindowBadge label={animal.rescueWindowLabel} />
          <h2>{animal.kindFullName}</h2>
          <p>{animal.noticeNo}</p>
        </div>
      </div>

      <div className="score-panel">
        <div
          className="score-ring"
          style={scoreStyle(animal.rescueWindowScore)}
          aria-label={`Rescue Window Score ${animal.rescueWindowScore}점`}
        >
          <strong>{animal.rescueWindowScore}</strong>
          <span>score</span>
        </div>
        <div>
          <strong>{animal.ddayText}</strong>
          <p>{animal.noticeEndDate} 보호 종료 예정</p>
        </div>
      </div>

      <DetailSection title="공식 공고 정보">
        <DetailItem label="공고 번호" value={animal.noticeNo} />
        <DetailItem label="공고 기간" value={`${animal.noticeStartDate} ~ ${animal.noticeEndDate}`} />
        <DetailItem label="처리 상태" value={animal.processState} />
      </DetailSection>

      <DetailSection title="동물 정보">
        <DetailItem label="축종/품종" value={`${animal.animalType} · ${animal.breed}`} />
        <DetailItem label="색상" value={animal.color} />
        <DetailItem label="나이/체중" value={`${animal.age} · ${animal.weight}`} />
        <DetailItem label="성별/중성화" value={`${animal.sex} · ${animal.neuterYn}`} />
        <DetailItem label="특징" value={animal.specialMark} />
      </DetailSection>

      <DetailSection title="보호소 및 지역">
        <DetailItem label="지역" value={animal.region} />
        <DetailItem label="보호소" value={animal.shelterName} />
        <DetailItem label="연락처" value={animal.shelterTel ?? "데이터 없음"} />
        <DetailItem label="발견 위치" value={animal.happenPlace} />
      </DetailSection>

      <p className="detail-note">
        공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.
      </p>
    </aside>
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
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ViewHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <header className="view-header">
      <p className="section-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function WindowBadge({ label }: { label: RescueWindowLabel }) {
  return <span className={`label-pill label-${labelClass(label)}`}>{label}</span>;
}

function DeadlineBadge({ animal }: { animal: MockAnimal }) {
  return (
    <div className="deadline-badge">
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

function PhotoPlaceholder({
  animal,
  compact = false,
}: {
  animal: MockAnimal;
  compact?: boolean;
}) {
  return (
    <div
      className={`photo-placeholder tone-${animal.photoTone} ${compact ? "is-compact" : ""}`}
      aria-label={animal.hasPhoto ? "공고 이미지 자리" : "사진 미등록"}
    >
      <span>{animal.animalType}</span>
      <strong>{animal.breed.slice(0, 4)}</strong>
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

function scoreStyle(score: number): CSSProperties & { "--score": string } {
  return { "--score": `${score}%` };
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
