type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

declare const process: {
  env: Record<string, string | undefined>;
};

type Shelter = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  jurisdiction?: string;
  raw?: unknown;
};

type PublicApiParseResult = {
  items: Record<string, unknown>[];
  upstreamError?: string;
};

type PublicApiResult = {
  url: string;
  status: number;
  contentType: string;
  parsed: PublicApiParseResult;
};

type RegionCodes = {
  uprCd?: string;
  orgCd?: string;
  source: "query" | "static" | "lookup" | "mixed" | "unresolved";
  warnings: string[];
};

type ShelterDiagnostics = {
  hasServiceKey: boolean;
  received: {
    sido: string;
    district: string;
    uprCd?: string;
    orgCd?: string;
  };
  upstreamUrlWithoutServiceKey?: string;
  upstreamStatus?: number;
  upstreamContentType?: string;
  parsedItemCount?: number;
  publicDataMessage?: string;
  regionCodeSource?: RegionCodes["source"];
  regionCodeWarnings?: string[];
};

const API_BASE_URL = "https://apis.data.go.kr/1543061";
const SHELTER_API_URL = `${API_BASE_URL}/animalShelterSrvc_v2/shelterInfo_v2`;
const SIDO_API_URL = `${API_BASE_URL}/abandonmentPublicService_v2/sido_v2`;
const SIGUNGU_API_URL = `${API_BASE_URL}/abandonmentPublicService_v2/sigungu_v2`;
const NUM_OF_ROWS = "1000";

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

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method && request.method !== "GET") {
    sendError(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", shelters: [] });
    return;
  }

  const sido = firstQueryValue(request.query?.sido);
  const sigungu = firstQueryValue(request.query?.sigungu);
  const queryUprCd =
    firstQueryValue(request.query?.uprCd) || firstQueryValue(request.query?.upr_cd);
  const queryOrgCd =
    firstQueryValue(request.query?.orgCd) || firstQueryValue(request.query?.org_cd);
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  const baseDiagnostics: ShelterDiagnostics = {
    hasServiceKey: Boolean(serviceKey),
    received: {
      sido,
      district: sigungu,
      ...(queryUprCd ? { uprCd: queryUprCd } : {}),
      ...(queryOrgCd ? { orgCd: queryOrgCd } : {}),
    },
  };

  if (!serviceKey) {
    logShelterWarning("missing-service-key", baseDiagnostics);
    sendError(response, 503, { ok: false, code: "MISSING_SERVICE_KEY", shelters: [] });
    return;
  }

  try {
    const regionCodes = await resolveRegionCodes({
      serviceKey,
      sido,
      sigungu,
      queryUprCd,
      queryOrgCd,
    });
    const upstreamResult = await requestPublicApi(SHELTER_API_URL, serviceKey, {
      pageNo: "1",
      numOfRows: NUM_OF_ROWS,
      _type: "json",
      ...(regionCodes.uprCd ? { upr_cd: regionCodes.uprCd } : {}),
      ...(regionCodes.orgCd ? { org_cd: regionCodes.orgCd } : {}),
    });
    const diagnostics: ShelterDiagnostics = {
      ...baseDiagnostics,
      received: {
        ...baseDiagnostics.received,
        ...(regionCodes.uprCd ? { uprCd: regionCodes.uprCd } : {}),
        ...(regionCodes.orgCd ? { orgCd: regionCodes.orgCd } : {}),
      },
      upstreamUrlWithoutServiceKey: withoutServiceKey(upstreamResult.url),
      upstreamStatus: upstreamResult.status,
      upstreamContentType: upstreamResult.contentType,
      parsedItemCount: upstreamResult.parsed.items.length,
      publicDataMessage: upstreamResult.parsed.upstreamError,
      regionCodeSource: regionCodes.source,
      regionCodeWarnings: regionCodes.warnings,
    };

    if (upstreamResult.status < 200 || upstreamResult.status >= 300) {
      logShelterWarning("upstream-http-error", diagnostics);
      sendError(response, 502, {
        ok: false,
        code: "UPSTREAM_ERROR",
        status: upstreamResult.status,
        shelters: [],
      });
      return;
    }

    if (upstreamResult.parsed.upstreamError) {
      logShelterWarning("upstream-public-data-error", diagnostics);
      sendError(response, 502, {
        ok: false,
        code: "UPSTREAM_RESPONSE_ERROR",
        message: upstreamResult.parsed.upstreamError,
        shelters: [],
      });
      return;
    }

    const hasPreciseRegionCode = Boolean(regionCodes.orgCd) || !sigungu || sigungu === "전체";
    const shelters = upstreamResult.parsed.items
      .map(normalizeShelter)
      .filter((shelter): shelter is Shelter => Boolean(shelter))
      .filter((shelter) =>
        hasPreciseRegionCode ? true : matchesRegion(shelter, sido, sigungu)
      );

    if (!shelters.length) {
      logShelterWarning("empty-shelter-result", diagnostics);
    } else if (regionCodes.warnings.length) {
      logShelterWarning("region-code-warning", diagnostics);
    }

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    response.status(200).json({
      ok: true,
      shelters,
      meta: {
        source: "animalShelterSrvc_v2/shelterInfo_v2",
        filters: {
          sido,
          sigungu,
          ...(regionCodes.uprCd ? { uprCd: regionCodes.uprCd } : {}),
          ...(regionCodes.orgCd ? { orgCd: regionCodes.orgCd } : {}),
        },
        regionCodeSource: regionCodes.source,
        returnedCount: shelters.length,
      },
    });
  } catch (error) {
    logShelterWarning("upstream-request-failed", {
      ...baseDiagnostics,
      publicDataMessage: error instanceof Error ? error.message : "unknown request failure",
    });
    sendError(response, 502, { ok: false, code: "UPSTREAM_REQUEST_FAILED", shelters: [] });
  }
}

async function resolveRegionCodes({
  serviceKey,
  sido,
  sigungu,
  queryUprCd,
  queryOrgCd,
}: {
  serviceKey: string;
  sido: string;
  sigungu: string;
  queryUprCd: string;
  queryOrgCd: string;
}): Promise<RegionCodes> {
  const warnings: string[] = [];
  let source: RegionCodes["source"] = "unresolved";
  let uprCd = queryUprCd;
  let orgCd = queryOrgCd;

  if (uprCd || orgCd) {
    source = "query";
  }

  if (!uprCd && sido) {
    uprCd = SIDO_CODES[normalizeRegionText(sido)] ?? "";
    if (uprCd) {
      source = source === "unresolved" ? "static" : "mixed";
    }
  }

  if (!uprCd && sido) {
    const lookupCode = await lookupSidoCode(serviceKey, sido, warnings);
    if (lookupCode) {
      uprCd = lookupCode;
      source = source === "unresolved" ? "lookup" : "mixed";
    }
  }

  if (!orgCd && shouldResolveSigungu(sigungu)) {
    orgCd = SIGUNGU_CODES[`${normalizeRegionText(sido)} ${normalizeRegionText(sigungu)}`] ?? "";
    if (orgCd) {
      source = source === "unresolved" ? "static" : source === "query" ? "mixed" : source;
    }
  }

  if (!orgCd && uprCd && shouldResolveSigungu(sigungu)) {
    const lookupCode = await lookupSigunguCode(serviceKey, uprCd, sigungu, warnings);
    if (lookupCode) {
      orgCd = lookupCode;
      source = source === "unresolved" ? "lookup" : source === "static" ? "mixed" : source;
    }
  }

  if (sido && !uprCd) {
    warnings.push(`No upr_cd resolved for ${sido}`);
  }
  if (shouldResolveSigungu(sigungu) && !orgCd) {
    warnings.push(`No org_cd resolved for ${sido} ${sigungu}`);
  }

  return {
    ...(uprCd ? { uprCd } : {}),
    ...(orgCd ? { orgCd } : {}),
    source,
    warnings,
  };
}

async function lookupSidoCode(
  serviceKey: string,
  sido: string,
  warnings: string[]
): Promise<string> {
  const result = await requestPublicApi(SIDO_API_URL, serviceKey, {
    _type: "json",
    pageNo: "1",
    numOfRows: NUM_OF_ROWS,
  });

  if (result.status < 200 || result.status >= 300 || result.parsed.upstreamError) {
    warnings.push(`sido_v2 lookup failed: ${result.parsed.upstreamError ?? result.status}`);
    return "";
  }

  const aliases = getSidoAliases(sido);
  const match = result.parsed.items.find((item) =>
    aliases.includes(normalizeRegionText(readTextField(item, ["orgdownNm", "orgDownNm", "name"]) ?? ""))
  );
  return match ? readTextField(match, ["orgCd", "org_cd", "uprCd"]) ?? "" : "";
}

async function lookupSigunguCode(
  serviceKey: string,
  uprCd: string,
  sigungu: string,
  warnings: string[]
): Promise<string> {
  const result = await requestPublicApi(SIGUNGU_API_URL, serviceKey, {
    _type: "json",
    pageNo: "1",
    numOfRows: NUM_OF_ROWS,
    upr_cd: uprCd,
  });

  if (result.status < 200 || result.status >= 300 || result.parsed.upstreamError) {
    warnings.push(`sigungu_v2 lookup failed: ${result.parsed.upstreamError ?? result.status}`);
    return "";
  }

  const normalizedSigungu = normalizeRegionText(sigungu);
  const match = result.parsed.items.find(
    (item) =>
      normalizeRegionText(readTextField(item, ["orgdownNm", "orgDownNm", "name"]) ?? "") ===
      normalizedSigungu
  );
  return match ? readTextField(match, ["orgCd", "org_cd"]) ?? "" : "";
}

async function requestPublicApi(
  endpoint: string,
  serviceKey: string,
  params: Record<string, string | undefined>
): Promise<PublicApiResult> {
  const url = buildPublicApiUrl(endpoint, serviceKey, params);
  const upstreamResponse = await fetch(url, {
    headers: {
      Accept: "application/json, application/xml;q=0.9, text/plain;q=0.8",
      "User-Agent": "shelter-signal-vercel-function/0.1",
    },
  });
  const upstreamText = await upstreamResponse.text();

  return {
    url,
    status: upstreamResponse.status,
    contentType: upstreamResponse.headers.get("content-type") ?? "",
    parsed: parsePublicApiPayload(upstreamText),
  };
}

function sendError(response: ApiResponse, statusCode: number, body: unknown): void {
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json(body);
}

function buildPublicApiUrl(
  endpoint: string,
  serviceKey: string,
  params: Record<string, string | undefined>
): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  return `${endpoint}?serviceKey=${encodeServiceKey(serviceKey)}&${query.toString()}`;
}

function withoutServiceKey(url: string): string {
  const safeUrl = new URL(url);
  safeUrl.searchParams.delete("serviceKey");
  return safeUrl.toString();
}

function encodeServiceKey(serviceKey: string): string {
  return serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
}

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return textOrEmpty(value[0]);
  }
  return textOrEmpty(value);
}

function parsePublicApiPayload(text: string): PublicApiParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [] };
  }

  try {
    const data: unknown = JSON.parse(trimmed);
    const resultCode = readNestedText(data, [
      ["response", "header", "resultCode"],
      ["header", "resultCode"],
      ["resultCode"],
    ]);
    if (resultCode && !isSuccessfulResultCode(resultCode)) {
      return {
        items: [],
        upstreamError:
          readNestedText(data, [
            ["response", "header", "resultMsg"],
            ["header", "resultMsg"],
            ["resultMsg"],
          ]) ?? resultCode,
      };
    }

    return { items: extractJsonItems(data) };
  } catch {
    const resultCode = extractXmlTagText(trimmed, "resultCode");
    const errorCode = extractXmlTagText(trimmed, "returnReasonCode");
    const serviceError =
      extractXmlTagText(trimmed, "errMsg") ??
      extractXmlTagText(trimmed, "returnAuthMsg") ??
      extractXmlTagText(trimmed, "resultMsg");
    const reportedCode = resultCode ?? errorCode;

    if ((reportedCode && !isSuccessfulResultCode(reportedCode)) || serviceError) {
      return { items: [], upstreamError: serviceError ?? reportedCode ?? "XML error response" };
    }

    return { items: extractXmlItems(trimmed) };
  }
}

function extractJsonItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  const candidates = [
    nestedGet(data, ["response", "body", "items", "item"]),
    nestedGet(data, ["body", "items", "item"]),
    nestedGet(data, ["items", "item"]),
    nestedGet(data, ["items"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
    if (isRecord(candidate)) {
      return [candidate];
    }
  }

  return [];
}

function extractXmlItems(text: string): Record<string, unknown>[] {
  const matches = Array.from(
    text.matchAll(/<(?:[A-Za-z0-9_:-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_:-]+:)?item>/gi)
  );
  return matches.map((match) => extractXmlRecord(match[1] ?? ""));
}

function extractXmlRecord(text: string): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const tagPattern = /<([A-Za-z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let match = tagPattern.exec(text);

  while (match) {
    const key = match[1].split(":").pop() ?? match[1];
    const value = match[2].trim();
    if (!/<[A-Za-z0-9_:-]+\b/.test(value)) {
      record[key] = decodeXmlEntities(stripCdata(value));
    }
    match = tagPattern.exec(text);
  }

  return record;
}

function normalizeShelter(item: Record<string, unknown>, index: number): Shelter | null {
  const name = readTextField(item, ["careNm", "care_nm", "name", "shelterName"]);
  if (!name) {
    return null;
  }

  const id =
    readTextField(item, ["careRegNo", "care_reg_no", "id", "shelterId"]) ??
    `shelter-${index}-${slugify(name)}`;
  const address = readTextField(item, [
    "careAddr",
    "care_addr",
    "roadAddr",
    "jibunAddr",
    "addr",
    "address",
  ]);
  const phone = readTextField(item, ["careTel", "care_tel", "tel", "phone"]);
  const jurisdiction = readTextField(item, ["orgNm", "org_nm", "jurisdiction"]);

  return {
    id,
    name,
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    raw: item,
  };
}

function matchesRegion(shelter: Shelter, sido: string, sigungu: string): boolean {
  const regionParts = [shelter.address, shelter.jurisdiction, shelter.name]
    .map((value) => normalizeRegionText(value ?? ""))
    .filter(Boolean);
  const regionText = regionParts.join(" ");

  if (!sido && !sigungu) {
    return true;
  }
  if (!regionText) {
    return false;
  }

  const normalizedSigungu = normalizeRegionText(sigungu);
  const sigunguMatch =
    !shouldResolveSigungu(normalizedSigungu) || regionText.includes(normalizedSigungu);
  const sidoAliases = getSidoAliases(sido);
  const sidoMatch = !sidoAliases.length || sidoAliases.some((alias) => regionText.includes(alias));

  return sidoMatch && sigunguMatch;
}

function shouldResolveSigungu(sigungu: string): boolean {
  const normalized = normalizeRegionText(sigungu);
  return Boolean(normalized && normalized !== "전체");
}

function getSidoAliases(sido: string): string[] {
  const normalized = normalizeRegionText(sido);
  if (!normalized) {
    return [];
  }

  const aliases = new Set([normalized]);
  const compactMap: Record<string, string> = {
    서울특별시: "서울",
    부산광역시: "부산",
    대구광역시: "대구",
    인천광역시: "인천",
    광주광역시: "광주",
    대전광역시: "대전",
    울산광역시: "울산",
    세종특별자치시: "세종",
    경기도: "경기",
    강원특별자치도: "강원",
    충청북도: "충북",
    충청남도: "충남",
    전라북도: "전북",
    전북특별자치도: "전북",
    전라남도: "전남",
    경상북도: "경북",
    경상남도: "경남",
    제주특별자치도: "제주",
  };

  const shortAlias = compactMap[normalized];
  if (shortAlias) {
    aliases.add(shortAlias);
  }

  return Array.from(aliases);
}

function readTextField(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = textOrEmpty(item[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readNestedText(data: unknown, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = textOrEmpty(nestedGet(data, path));
    if (value) {
      return value;
    }
  }
  return undefined;
}

function nestedGet(data: unknown, path: string[]): unknown {
  let current = data;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function extractXmlTagText(text: string, tagName: string): string | undefined {
  const match = new RegExp(
    `<(?:[A-Za-z0-9_:-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_:-]+:)?${tagName}>`,
    "i"
  ).exec(text);
  const value = match ? decodeXmlEntities(stripCdata(match[1].trim())) : "";
  return value || undefined;
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function isSuccessfulResultCode(resultCode: string): boolean {
  return ["0", "00", "INFO-000"].includes(resultCode.trim());
}

function logShelterWarning(event: string, diagnostics: ShelterDiagnostics): void {
  console.warn("[shelter-api]", event, diagnostics);
}

function textOrEmpty(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeRegionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
