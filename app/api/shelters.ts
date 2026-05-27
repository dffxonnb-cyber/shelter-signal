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

const SHELTER_API_URL = "https://apis.data.go.kr/1543061/animalShelterSrvc_v2/shelterInfo_v2";
const NUM_OF_ROWS = "1000";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method && request.method !== "GET") {
    sendError(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", shelters: [] });
    return;
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    sendError(response, 503, { ok: false, code: "MISSING_SERVICE_KEY", shelters: [] });
    return;
  }

  const sido = firstQueryValue(request.query?.sido);
  const sigungu = firstQueryValue(request.query?.sigungu);

  try {
    const upstreamResponse = await fetch(buildPublicApiUrl(serviceKey), {
      headers: {
        Accept: "application/json, application/xml;q=0.9, text/plain;q=0.8",
        "User-Agent": "shelter-signal-vercel-function/0.1",
      },
    });
    const upstreamText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      sendError(response, 502, {
        ok: false,
        code: "UPSTREAM_ERROR",
        status: upstreamResponse.status,
        shelters: [],
      });
      return;
    }

    const parsed = parsePublicApiPayload(upstreamText);
    if (parsed.upstreamError) {
      sendError(response, 502, {
        ok: false,
        code: "UPSTREAM_RESPONSE_ERROR",
        message: parsed.upstreamError,
        shelters: [],
      });
      return;
    }

    const shelters = parsed.items
      .map(normalizeShelter)
      .filter((shelter): shelter is Shelter => Boolean(shelter))
      .filter((shelter) => matchesRegion(shelter, sido, sigungu));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    response.status(200).json({
      ok: true,
      shelters,
      meta: {
        source: "animalShelterSrvc_v2/shelterInfo_v2",
        filters: { sido, sigungu },
        returnedCount: shelters.length,
      },
    });
  } catch {
    sendError(response, 502, { ok: false, code: "UPSTREAM_REQUEST_FAILED", shelters: [] });
  }
}

function sendError(response: ApiResponse, statusCode: number, body: unknown): void {
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json(body);
}

function buildPublicApiUrl(serviceKey: string): string {
  const query = new URLSearchParams({
    pageNo: "1",
    numOfRows: NUM_OF_ROWS,
    _type: "json",
  });
  return `${SHELTER_API_URL}?serviceKey=${encodeServiceKey(serviceKey)}&${query.toString()}`;
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
    const serviceError = extractXmlTagText(trimmed, "errMsg") ?? extractXmlTagText(trimmed, "returnAuthMsg");
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
  const sigunguMatch = !normalizedSigungu || regionText.includes(normalizedSigungu);
  const sidoAliases = getSidoAliases(sido);
  const sidoMatch = !sidoAliases.length || sidoAliases.some((alias) => regionText.includes(alias));

  return sidoMatch && sigunguMatch;
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
