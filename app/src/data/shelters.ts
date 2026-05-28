export type Shelter = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  jurisdiction?: string;
  raw?: unknown;
};

export type ShelterApiErrorCode = "MISSING_SERVICE_KEY" | "UPSTREAM_ERROR" | "UNKNOWN";

export class ShelterApiError extends Error {
  code: ShelterApiErrorCode;

  constructor(code: ShelterApiErrorCode, message: string) {
    super(message);
    this.name = "ShelterApiError";
    this.code = code;
  }
}

type FetchShelterParams = {
  sido: string;
  sigungu: string;
  uprCd?: string;
  orgCd?: string;
  signal?: AbortSignal;
};

export async function fetchSheltersByRegion({
  sido,
  sigungu,
  uprCd,
  orgCd,
  signal,
}: FetchShelterParams): Promise<Shelter[]> {
  const query = new URLSearchParams({
    sido,
    sigungu,
    ...(uprCd ? { uprCd } : {}),
    ...(orgCd ? { orgCd } : {}),
  });
  const response = await fetch(`/api/shelters?${query.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ShelterApiError("UPSTREAM_ERROR", `Shelter API did not return JSON: ${errorMessage(error)}`);
  }

  if (!response.ok || !isRecord(payload) || payload.ok === false) {
    const code = normalizeErrorCode(isRecord(payload) ? payload.code : undefined);
    const message = textOrEmpty(isRecord(payload) ? payload.message : undefined) || "Shelter API request failed";
    throw new ShelterApiError(code, message);
  }

  const shelters = Array.isArray(payload.shelters) ? payload.shelters : [];
  return shelters
    .map(normalizeShelter)
    .filter((shelter): shelter is Shelter => Boolean(shelter));
}

function normalizeShelter(value: unknown, index: number): Shelter | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = textOrEmpty(value.name);
  if (!name) {
    return null;
  }

  const id = textOrEmpty(value.id) || `shelter-${index}`;
  const address = textOrEmpty(value.address);
  const phone = textOrEmpty(value.phone);
  const jurisdiction = textOrEmpty(value.jurisdiction);

  return {
    id,
    name,
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    raw: value.raw,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function normalizeErrorCode(value: unknown): ShelterApiErrorCode {
  if (value === "MISSING_SERVICE_KEY" || value === "UPSTREAM_ERROR") {
    return value;
  }
  return "UNKNOWN";
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
