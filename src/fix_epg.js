import { getFromCache, cacheResult, downloadSource } from './utils.js';

let refreshPromise = null;

export async function handle(request, env, ctx) {
  const cache = caches.default;

  let response = await getFromCache(cache, env.KULAO_PATH);

  if (response) {
    return response;
  }

  if (refreshPromise) {
    await refreshPromise;
    response = await getFromCache(cache, env.KULAO_PATH);
    if (response) {
      return response;
    }
  }

  refreshPromise = (async () => {
    try {
      const text = await downloadSource(env.KULAO_SOURCE_URL, env.USER_AGENT);

      const modified = text.replace(/\s+epg-url="[^"]*"/g, "");

      await cacheResult(cache, env.KULAO_PATH, modified, env.CACHE_TTL);
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

  response = await getFromCache(cache, env.KULAO_PATH);
  if (response) {
    return response;
  }

  return new Response("Cache write failed", { status: 500 });
}
