import { getFromCache, cacheResult, downloadSource } from './utils.js';

const refreshPromises = {};

function getConfiguredPaths(env) {
  const paths = [];
  for (const key of Object.keys(env)) {
    if (key.endsWith('_PATH') && env[key] !== '/live/all.m3u' && env[key] !== env.PANDALIVE_PATH) {
      paths.push(env[key]);
    }
  }
  return paths;
}

function getSourceUrl(path, env) {
  const pathKey = Object.keys(env).find(key => key.endsWith('_PATH') && env[key] === path);
  if (!pathKey) return null;
  return env[pathKey.replace('_PATH', '_SOURCE_URL')];
}

async function ensurePathCached(path, env) {
  const cache = caches.default;
  const sourceUrl = getSourceUrl(path, env);
  if (!sourceUrl) return null;

  let resp = await getFromCache(cache, path);
  if (resp) return await resp.text();

  if (refreshPromises[path]) {
    await refreshPromises[path];
    resp = await getFromCache(cache, path);
    if (resp) return await resp.text();
    return null;
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
    return null;
  }

  resp = await getFromCache(cache, path);
  if (resp) return await resp.text();
  return null;
}

function parseExtm3uAttrs(line) {
  const rest = line.slice(7).trim();
  const attrs = {};
  const regex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(rest)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export async function handle(request, env, ctx) {
  const paths = getConfiguredPaths(env);
  const fragments = [];
  const mergedAttrs = {};

  for (const path of paths) {
    const text = await ensurePathCached(path, env);
    if (!text) continue;

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (trimmed.startsWith('#EXTM3U')) {
        Object.assign(mergedAttrs, parseExtm3uAttrs(trimmed));
        continue;
      }

      fragments.push(line);
    }
  }

  const attrPairs = Object.entries(mergedAttrs).map(([k, v]) => `${k}="${v}"`);
  const header = attrPairs.length ? `#EXTM3U ${attrPairs.join(' ')}` : '#EXTM3U';
  const body = header + '\n' + fragments.join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'audio/x-mpegurl; charset=utf-8'
    }
  });
}
