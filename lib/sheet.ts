const CACHE_TTL = 60_000;

let cache: { data: string; fetchedAt: number } | null = null;

export async function getFaq(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL) return cache.data;

  try {
    const url = process.env.SHEET_CSV_URL;
    if (!url) throw new Error('SHEET_CSV_URL is not set');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.text();
    cache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    if (cache) {
      console.warn('[sheet] fetch failed, using stale cache:', err);
      return cache.data;
    }
    throw err;
  }
}
