import { useMemo, useState } from "react";
import {
  MOCK_REFERENCE_DATE,
  MockAnimal,
  RescueWindowLabel,
  mockAnimals,
  rescueWindowLabels,
} from "./data/mockAnimals";

type ViewKey = "overview" | "golden" | "notices" | "regions" | "saved";

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
  const [labelFilter, setLabelFilter] = useState("전체");
  const [typeFilter, setTypeFilter] = useState("전체");
  const [regionFilter, setRegionFilter] = useState("전체");
  const [selectedAnimalId, setSelectedAnimalId] = useState(mockAnimals[0]?.id ?? "");

  const animalTypes = useMemo(
    () => Array.from(new Set(mockAnimals.map((animal) => animal.animalType))),
    []
  );
  const regions = useMemo(
    () => Array.from(new Set(mockAnimals.map((animal) => animal.region))).sort(),
    []
  );

  const filteredAnimals = useMemo(() => {
    return mockAnimals
      .filter((animal) =>
        labelFilter === "전체" ? true : animal.rescueWindowLabel === labelFilter
      )
      .filter((animal) => (typeFilter === "전체" ? true : animal.animalType === typeFilter))
      .filter((animal) => (regionFilter === "전체" ? true : animal.region === regionFilter))
      .sort(
        (a, b) =>
          labelOrder[a.rescueWindowLabel] - labelOrder[b.rescueWindowLabel] ||
          a.daysUntilNoticeEnd - b.daysUntilNoticeEnd ||
          b.rescueWindowScore - a.rescueWindowScore
      );
  }, [labelFilter, regionFilter, typeFilter]);

  const selectedAnimal =
    mockAnimals.find((animal) => animal.id === selectedAnimalId) ?? filteredAnimals[0];

  const activeAnimals = mockAnimals.filter((animal) => animal.processState === "보호중");
  const urgentAnimals = mockAnimals.filter((animal) => animal.rescueWindowLabel === "긴급 확인");
  const endingSoonAnimals = mockAnimals.filter((animal) =>
    ["긴급 확인", "곧 종료"].includes(animal.rescueWindowLabel)
  );
  const averageScore = Math.round(
    mockAnimals.reduce((sum, animal) => sum + animal.rescueWindowScore, 0) / mockAnimals.length
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Phase 2 MVP · mock data</p>
          <h1>Shelter Signal</h1>
          <p className="intro">
            보호 종료가 가까운 공고를 먼저 확인해보세요. 공식 문의는 보호소 또는
            관할기관을 통해 확인해주세요.
          </p>
        </div>
        <div className="status-panel" aria-label="데이터 상태">
          <span>모의 기준일</span>
          <strong>{MOCK_REFERENCE_DATE}</strong>
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
              endingSoonCount={endingSoonAnimals.length}
              averageScore={averageScore}
              onOpenGoldenTime={() => setActiveView("golden")}
            />
          )}
          {activeView === "golden" && (
            <GoldenTimeList
              animals={endingSoonAnimals}
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
  endingSoonCount,
  averageScore,
  onOpenGoldenTime,
}: {
  activeCount: number;
  urgentCount: number;
  endingSoonCount: number;
  averageScore: number;
  onOpenGoldenTime: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="overview-band">
        <div>
          <p className="eyebrow">Rescue Window</p>
          <h2>남은 공고 시간과 데이터 신호를 함께 보는 첫 화면</h2>
          <p>
            관심 지역의 공고를 차분히 확인할 수 있어요. 현재 화면은 Phase 1 모델의
            개념을 mock 데이터로 시각화합니다.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onOpenGoldenTime}>
          가까운 종료 공고 보기
        </button>
      </section>

      <section className="metric-grid" aria-label="요약 지표">
        <Metric label="긴급 확인" value={urgentCount} hint="D-Day 또는 D-1 중심" />
        <Metric label="곧 종료 포함" value={endingSoonCount} hint="3일 이내 우선 확인" />
        <Metric label="보호중 공고" value={activeCount} hint="mock 데이터 기준" />
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
        title="골든 타임 리스트"
        description="보호 종료가 가까운 공고를 먼저 확인할 수 있도록 정렬했습니다."
      />
      <AnimalCards animals={animals} selectedAnimalId={selectedAnimalId} onSelect={onSelect} />
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
  onSelect: (id: string) => void;
}) {
  return (
    <div className="view-stack">
      <ViewHeader
        title="동물 공고 목록"
        description="Rescue Window 라벨, 축종, 지역으로 mock 공고를 좁혀볼 수 있습니다."
      />
      <section className="filters" aria-label="공고 필터">
        <FilterSelect
          label="윈도우"
          value={labelFilter}
          options={["전체", ...rescueWindowLabels]}
          onChange={onLabelFilter}
        />
        <FilterSelect
          label="축종"
          value={typeFilter}
          options={["전체", ...animalTypes]}
          onChange={onTypeFilter}
        />
        <FilterSelect
          label="지역"
          value={regionFilter}
          options={["전체", ...regions]}
          onChange={onRegionFilter}
        />
      </section>
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
    <label>
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
}: {
  animals: MockAnimal[];
  selectedAnimalId?: string;
  onSelect: (id: string) => void;
}) {
  if (!animals.length) {
    return <p className="empty-state">조건에 맞는 mock 공고가 없습니다.</p>;
  }

  return (
    <section className="animal-list" aria-label="동물 공고">
      {animals.map((animal) => (
        <button
          key={animal.id}
          className={`animal-card ${selectedAnimalId === animal.id ? "is-selected" : ""}`}
          type="button"
          onClick={() => onSelect(animal.id)}
        >
          <PhotoPlaceholder animal={animal} />
          <div className="animal-card-body">
            <div className="card-topline">
              <span className={`label-pill label-${labelClass(animal.rescueWindowLabel)}`}>
                {animal.rescueWindowLabel}
              </span>
              <strong>{animal.ddayText}</strong>
            </div>
            <h3>{animal.kindFullName}</h3>
            <p>{animal.region}</p>
            <dl className="mini-facts">
              <div>
                <dt>보호소</dt>
                <dd>{animal.shelterName}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{animal.processState}</dd>
              </div>
            </dl>
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
        title="지역 요약"
        description="관심 지역의 공고를 차분히 확인할 수 있어요."
      />
      <section className="summary-table" aria-label="지역별 요약">
        {summaries.map((summary) => (
          <article key={summary.region} className="summary-row">
            <div>
              <h3>{summary.region}</h3>
              <p>총 {summary.total}건</p>
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
        title="저장 공고"
        description="관심 공고를 따로 모아보는 공간입니다. 아직은 화면 자리만 준비했습니다."
      />
      <section className="saved-placeholder">
        <strong>저장 기능은 다음 단계에서 연결합니다.</strong>
        <p>
          지금은 mock 데이터 화면 흐름을 확인하는 단계입니다. 로그인, 알림, 동기화는 아직
          포함하지 않았습니다.
        </p>
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
          <span className={`label-pill label-${labelClass(animal.rescueWindowLabel)}`}>
            {animal.rescueWindowLabel}
          </span>
          <h2>{animal.kindFullName}</h2>
          <p>{animal.noticeNo}</p>
        </div>
      </div>

      <div className="score-panel">
        <div
          className="score-ring"
          style={{ "--score": `${animal.rescueWindowScore}%` } as React.CSSProperties}
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

      <dl className="detail-list">
        <div>
          <dt>지역</dt>
          <dd>{animal.region}</dd>
        </div>
        <div>
          <dt>보호소</dt>
          <dd>{animal.shelterName}</dd>
        </div>
        <div>
          <dt>보호소 연락처</dt>
          <dd>{animal.shelterTel ?? "mock 데이터 없음"}</dd>
        </div>
        <div>
          <dt>발견 위치</dt>
          <dd>{animal.happenPlace}</dd>
        </div>
        <div>
          <dt>특징</dt>
          <dd>{animal.specialMark}</dd>
        </div>
        <div>
          <dt>기본 정보</dt>
          <dd>
            {animal.color} · {animal.age} · {animal.weight} · {animal.sex}
          </dd>
        </div>
      </dl>

      <p className="detail-note">
        공식 문의는 보호소 또는 관할기관을 통해 확인해주세요.
      </p>
    </aside>
  );
}

function ViewHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="view-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
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
      aria-label={animal.hasPhoto ? "mock 사진 자리" : "사진 미등록"}
    >
      <span>{animal.animalType}</span>
      <strong>{animal.breed.slice(0, 4)}</strong>
      <small>{animal.hasPhoto ? "mock photo" : "no photo"}</small>
    </div>
  );
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
