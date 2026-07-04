import { handle as fixOrigin } from './fix_origin.js';
import { handle as fixEpg } from './fix_epg.js';
import { handle as cacheM3u } from './cache_m3u.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === env.PANDALIVE_PATH) {
      return fixOrigin(request, env, ctx);
    }

    if (path === env.KULAO_PATH) {
      return fixEpg(request, env, ctx);
    }

    if (path === env.SUXUANG_PATH || path === env.GARY_PATH) {
      return cacheM3u(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  }
};
