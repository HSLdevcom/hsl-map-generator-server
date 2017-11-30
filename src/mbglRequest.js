import httpHttpsAgent from 'http-https-agent';
import fetch from 'node-fetch';
import LRU from 'lru-cache';

const cache = LRU({
  max: 128 * 1024 * 1024, // 128 MB
  maxAge: 10 * 60 * 1000, // 10 minutes
  length: n => n.data.length + 20, // add extra 20 bytes for metadata
});

const getAgent = httpHttpsAgent({
  keepAlive: true,
});

export default async function mbglRequest({ url }, callback) {
  try {
    const cacheResponse = cache.get(url);
    if (cacheResponse) {
      callback(null, cacheResponse);
      return;
    }

    const res = await fetch(url, { agent: getAgent(url) });

    if (res.status === 200 || res.status === 404) {
      const response = {
        modified: res.headers.modified ? new Date(res.headers.modified) : undefined,
        expires: res.headers.expires ? new Date(res.headers.expires) : undefined,
        etag: res.headers.etag ? res.headers.etag : undefined,
        data: res.status === 200 ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0),
      };
      cache.set(url, response);

      callback(null, response);
    } else {
      callback(new Error(await res.text()));
    }
  } catch (err) {
    callback(err);
  }
}
