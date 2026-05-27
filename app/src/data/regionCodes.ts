export type RegionCodes = {
  uprCd?: string;
  orgCd?: string;
};

const SIDO_CODES: Record<string, string> = {
  서울특별시: "6110000",
  부산광역시: "6260000",
  대구광역시: "6270000",
  인천광역시: "6280000",
  광주광역시: "6290000",
  대전광역시: "6300000",
  울산광역시: "6310000",
  세종특별자치시: "5690000",
  경기도: "6410000",
  강원특별자치도: "6420000",
  충청북도: "6430000",
  충청남도: "6440000",
  전라북도: "6450000",
  전북특별자치도: "6450000",
  전라남도: "6460000",
  경상북도: "6470000",
  경상남도: "6480000",
  제주특별자치도: "6500000",
};

const SIGUNGU_CODES: Record<string, string> = {
  "경기도 화성시": "5530000",
  "경기도 수원시": "3740000",
  "경기도 성남시": "3780000",
};

export function getRegionCodes(sido: string, sigungu: string): RegionCodes {
  const normalizedSido = normalizeRegionText(sido);
  const normalizedSigungu = normalizeRegionText(sigungu);
  const uprCd = SIDO_CODES[normalizedSido];
  const orgCd =
    normalizedSigungu && normalizedSigungu !== "전체"
      ? SIGUNGU_CODES[`${normalizedSido} ${normalizedSigungu}`]
      : undefined;

  return {
    ...(uprCd ? { uprCd } : {}),
    ...(orgCd ? { orgCd } : {}),
  };
}

function normalizeRegionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
