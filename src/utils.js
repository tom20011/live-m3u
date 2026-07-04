export function createCacheKey(path) {
  return new Request(`https://cache.local${path}`, { method: "GET" });
}

export async function getFromCache(cache, path) {
  return await cache.match(createCacheKey(path));
}

export async function cacheResult(cache, path, text, cacheTTL) {
  const ttl = Number(cacheTTL || 600);
  const cacheKey = createCacheKey(path);
  const response = new Response(text, {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}`
    }
  });
  await cache.put(cacheKey, response.clone());
  return response;
}

export async function downloadSource(url, userAgent) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": userAgent || "Cloudflare Worker"
    }
  });
  if (!resp.ok) {
    throw new Error(`Fetch failed: ${resp.status}`);
  }
  return await resp.text();
}
