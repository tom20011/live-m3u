import { handle as fixOrigin } from './fix_origin.js';
import { handle as fixEpg } from './fix_epg.js';
import { handle as cacheM3u } from './cache_m3u.js';
import { handle as allM3u } from './all_m3u.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/live/all.m3u') {
      return allM3u(request, env, ctx);
    }

    if (path === env.PANDALIVE_PATH) {
      return fixOrigin(request, env, ctx);
    }

    if (path === env.KULAO_PATH) {
      return fixEpg(request, env, ctx);
    }

    const isCacheable = Object.keys(env).some(key => key.endsWith('_PATH') && env[key] === path);
    if (isCacheable) {
      return cacheM3u(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  }
};
