const TUSHARE_URL = "https://api.tushare.pro";

export type TushareRawResponse = {
  fields: string[];
  items: (string | number | null)[][];
};

type TushareEnvelope = {
  code: number;
  msg: string;
  data?: TushareRawResponse;
};

export async function fetchTusharePaged(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string,
  options?: { pageSize?: number }
): Promise<TushareRawResponse> {
  const pageSize = Math.max(200, Math.min(5000, options?.pageSize ?? 5000));
  const allItems: (string | number | null)[][] = [];
  let offset = 0;
  let responseFields: string[] = [];

  while (true) {
    const { fields: pageFields, items } = await callTushare(apiName, token, params, fields, {
      limit: pageSize,
      offset
    });

    if (responseFields.length === 0) responseFields = pageFields ?? [];
    const rows = items ?? [];
    allItems.push(...rows);

    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 2_000_000) {
      throw new Error(`Tushare ${apiName} offset exceeded safety limit.`);
    }
  }

  return { fields: responseFields, items: allItems };
}

async function callTushare(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string,
  page?: { limit: number; offset: number }
): Promise<TushareRawResponse> {
  const body: Record<string, unknown> = { api_name: apiName, token, params, fields };
  if (page) {
    body.limit = page.limit;
    body.offset = page.offset;
  }

  const res = await fetch(TUSHARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Tushare 请求失败，状态码 ${res.status}。`);
  }
  const json = (await res.json()) as TushareEnvelope;
  if (json.code !== 0) {
    throw new Error(`Tushare 返回错误：${json.msg || "未知错误"}`);
  }
  return json.data ?? { fields: [], items: [] };
}

export function toTushareDate(value: string): string {
  return value.replace(/-/g, "");
}

export function normalizeDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

export function normalizeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

