// 当前 Isolate 内共享
let refreshPromise = null;

export default {
  async fetch(request, env, ctx) {

    // ========= 检查访问路径 =========
    const url = new URL(request.url);
    const pandalivePath = env.PANDALIVE_PATH;

    if (!pandalivePath || url.pathname !== pandalivePath) {
      return new Response("Not Found", {
        status: 404
      });
    }

    // ========= 读取配置 =========
    const SOURCE_URL = env.M3U_SOURCE_URL;
    const HTTP_ORIGIN = env.HTTP_ORIGIN;
    const CACHE_TTL = Number(env.CACHE_TTL || 600);

    if (!SOURCE_URL) {
      return new Response("Missing SOURCE_URL", {
        status: 500
      });
    }

    if (!HTTP_ORIGIN) {
      return new Response("Missing HTTP_ORIGIN", {
        status: 500
      });
    }

    // ========= 固定 Cache Key =========
    const cache = caches.default;

    const cacheKey = new Request(
      `https://cache.local${pandalivePath}`,
      { method: "GET" }
    );

    // ========= 查询缓存 =========
    let response = await cache.match(cacheKey);

    if (response) {
      return response;
    }

    // ========= 如果已有刷新任务，则等待 =========
    if (refreshPromise) {
      await refreshPromise;

      response = await cache.match(cacheKey);

      if (response) {
        return response;
      }
    }

    // ========= 当前请求负责刷新 =========
    refreshPromise = (async () => {

      try {

        const upstream = await fetch(SOURCE_URL, {
          headers: {
            "User-Agent": env.USER_AGENT ? env.USER_AGENT : "Cloudflare Worker"
          }
        });

        if (!upstream.ok) {
          throw new Error(`Fetch failed: ${upstream.status}`);
        }

        let text = await upstream.text();

        // 修改 #EXTINF
        text = text.replace(
          /^#EXTINF:([^,]*),/gm,
          (match, beforeComma) => {

            if (match.includes("http-origin=")) {
              return match;
            }

            return `#EXTINF:${beforeComma} http-origin="${HTTP_ORIGIN}",`;
          }
        );

        const newResponse = new Response(text, {
          headers: {
            "Content-Type": "audio/x-mpegurl; charset=utf-8",
            "Cache-Control": `public, max-age=${CACHE_TTL}`
          }
        });

        await cache.put(cacheKey, newResponse.clone());

      } finally {

        refreshPromise = null;

      }

    })();

    try {

      await refreshPromise;

    } catch (err) {

      console.error(err);

      return new Response("Failed to refresh cache", {
        status: 502
      });

    }

    response = await cache.match(cacheKey);

    if (response) {
      return response;
    }

    return new Response("Cache write failed", {
      status: 500
    });

  }
};
