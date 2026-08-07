import { createCacheKey } from './utils.js';

export async function handle(request, env, ctx) {
  const cache = caches.default;
  let cleared = 0;

  for (const key of Object.keys(env)) {
    if (!key.endsWith('_PATH')) continue;
    const path = env[key];
    if (typeof path !== 'string' || !path.startsWith('/')) continue;
    const ok = await cache.delete(createCacheKey(path));
    if (ok) cleared++;
  }

  return new Response(JSON.stringify({ cleared }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
