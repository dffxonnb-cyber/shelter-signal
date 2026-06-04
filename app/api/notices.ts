import { Pool } from "pg";

type QueryValue = string | string[] | undefined;

interface VercelRequest {
  method?: string;
  query: Record<string, QueryValue>;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: NoticesResponse): void;
}

interface NoticeFilters {
  region?: string;
  animalType?: string;
  rescueWindowLabel?: string;
}

type NoticeRecord = Record<string, string | number | boolean | null>;

type NoticesResponse =
  | {
      ok: true;
      notices: NoticeRecord[];
      source: "operational-postgres";
      meta: {
        limit: number;
        filters: NoticeFilters;
      };
    }
  | {
      ok: false;
      code: "MISSING_DATABASE_URL" | "DB_QUERY_ERROR" | "METHOD_NOT_ALLOWED";
      notices: [];
    };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

let cachedPool: Pool | null = null;
let cachedDatabaseUrl: string | null = null;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      notices: [],
    });
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    res.status(503).json({
      ok: false,
      code: "MISSING_DATABASE_URL",
      notices: [],
    });
    return;
  }

  const limit = parseLimit(req.query.limit);
  const filters = parseFilters(req.query);

  try {
    const pool = getPool(databaseUrl);
    const { sql, values } = buildNoticesQuery(filters, limit);
    const result = await pool.query<NoticeRecord>(sql, values);

    res.status(200).json({
      ok: true,
      notices: result.rows,
      source: "operational-postgres",
      meta: {
        limit,
        filters,
      },
    });
  } catch (error) {
    console.error(
      "Operational notices query failed",
      error instanceof Error ? error.message : "unknown error",
    );

    res.status(500).json({
      ok: false,
      code: "DB_QUERY_ERROR",
      notices: [],
    });
  }
}

function getPool(databaseUrl: string): Pool {
  if (!cachedPool || cachedDatabaseUrl !== databaseUrl) {
    cachedPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    });
    cachedDatabaseUrl = databaseUrl;
  }

  return cachedPool;
}

function parseLimit(value: QueryValue): number {
  const rawLimit = firstQueryValue(value);
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseFilters(query: Record<string, QueryValue>): NoticeFilters {
  return {
    ...optionalFilter("region", query.region),
    ...optionalFilter("animalType", query.animalType),
    ...optionalFilter("rescueWindowLabel", query.rescueWindowLabel),
  };
}

function optionalFilter(
  key: keyof NoticeFilters,
  value: QueryValue,
): NoticeFilters {
  const parsedValue = firstQueryValue(value);
  return parsedValue ? { [key]: parsedValue } : {};
}

function firstQueryValue(value: QueryValue): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();
  return trimmed || undefined;
}

function buildNoticesQuery(
  filters: NoticeFilters,
  limit: number,
): { sql: string; values: Array<string | number> } {
  const values: Array<string | number> = [];
  const whereClauses: string[] = [];

  addExactFilter(whereClauses, values, "org_nm", filters.region);
  addExactFilter(whereClauses, values, "up_kind_nm", filters.animalType);
  addExactFilter(
    whereClauses,
    values,
    "rescue_window_label",
    filters.rescueWindowLabel,
  );

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  // Assumption: mart.animals_clean is the current notice-level operational view
  // and mirrors the static JSON export fields used by the PWA.
  const sql = `
    SELECT
      desertion_no,
      notice_no,
      happen_dt,
      happen_place,
      notice_sdt,
      notice_edt,
      days_until_notice_end,
      deadline_bucket,
      rescue_window_score,
      rescue_window_label,
      kind_full_nm,
      up_kind_nm,
      kind_nm,
      color_cd,
      age,
      weight,
      popfile1,
      popfile2,
      process_state,
      sex_cd,
      neuter_yn,
      special_mark,
      care_nm,
      care_tel,
      care_addr,
      org_nm,
      has_photo,
      has_care_tel
    FROM mart.animals_clean
    ${whereSql}
    ORDER BY
      rescue_window_score DESC NULLS LAST,
      notice_edt ASC NULLS LAST,
      desertion_no ASC
    LIMIT ${limitPlaceholder};
  `;

  return { sql, values };
}

function addExactFilter(
  whereClauses: string[],
  values: Array<string | number>,
  columnName: "org_nm" | "up_kind_nm" | "rescue_window_label",
  value: string | undefined,
): void {
  if (!value) {
    return;
  }

  values.push(value);
  whereClauses.push(`${columnName} = $${values.length}`);
}
