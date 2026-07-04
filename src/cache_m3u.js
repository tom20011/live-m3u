import { getFromCache, cacheResult, downloadSource } from './utils.js';

const refreshPromises = {};

export async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  let sourceUrl;
  if (path === env.SUXUANG_PATH) {
    sourceUrl = env.SUXUANG_SOURCE_URL;
  } else if (path === env.GARY_PATH) {
    sourceUrl = env.GARY_SOURCE_URL;
  }

  if (!sourceUrl) {
    return new Response("Not Found", { status: 404 });
  }

  const cache = caches.default;

  let response = await getFromCache(cache, path);

  if (response) {
    return response;
  }

  if (refreshPromises[path]) {
    await refreshPromises[path];
    response = await getFromCache(cache, path);
    if (response) {
      return response;
    }
  }

  refreshPromises[path] = (async () => {
    try {
      const text = await downloadSource(sourceUrl, env.USER_AGENT);
      await cacheResult(cache, path, text, env.CACHE_TTL);
    } finally {
      delete refreshPromises[path];
    }
  })();

  try {
    await refreshPromises[path];
  } catch (err) {
    console.error(err);
    return new Response("Failed to refresh cache", { status: 502 });
  }

  response = await getFromCache(cache, path);
  if (response) {
    return response;
  }

  return new Response("Cache write failed", { status: 500 });
}
