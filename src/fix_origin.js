import { getFromCache, cacheResult, downloadSource } from './utils.js';

let refreshPromise = null;

export async function handle(request, env, ctx) {
  const cache = caches.default;

  let response = await getFromCache(cache, env.PANDALIVE_PATH);

  if (response) {
    return response;
  }

  if (refreshPromise) {
    await refreshPromise;
    response = await getFromCache(cache, env.PANDALIVE_PATH);
    if (response) {
      return response;
    }
  }

  refreshPromise = (async () => {
    try {
      const text = await downloadSource(env.PANDALIVE_SOURCE_URL, env.USER_AGENT);

      const modified = text.replace(
        /^#EXTINF:([^,]+),([^,]*),(.*)$|^#EXTINF:([^,]*),(.*)$/gm,
        (match, p1, p2, p3, p4, p5) => {
          if (match.includes("http-origin=")) {
            return match;
          }
          if (p1 !== undefined) {
            return `#EXTINF:${p1.trimEnd()} http-origin="${env.PANDALIVE_HTTP_ORIGIN}",${p3}`;
          }
          return `#EXTINF:${p4.trimEnd()} http-origin="${env.PANDALIVE_HTTP_ORIGIN}",${p5}`;
        }
      );

      await cacheResult(cache, env.PANDALIVE_PATH, modified, env.PANDALIVE_CACHE_TTL);
    } finally {
      refreshPromise = null;
    }
  })();

  try {
    await refreshPromise;
  } catch (err) {
    console.error(err);
    return new Response("Failed to refresh cache", { status: 502 });
  }

  response = await getFromCache(cache, env.PANDALIVE_PATH);
  if (response) {
    return response;
  }

  return new Response("Cache write failed", { status: 500 });
}
