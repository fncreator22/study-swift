import { createServer } from 'node:http';
import { Readable } from 'node:stream';

// Dynamically import the Cloudflare Worker-style handler built by TanStack Start
let handlerPromise;
async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../dist/server/index.js').then((m) => m.default ?? m);
  }
  return handlerPromise;
}

/**
 * Convert a Node.js IncomingMessage to a Web API Request
 */
async function nodeRequestToWebRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  const method = req.method || 'GET';
  let body = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks);
    }
  }

  return new Request(url, { method, headers, body });
}

/**
 * Stream a Web API Response back to Node.js ServerResponse
 */
async function webResponseToNodeResponse(webResponse, res) {
  res.statusCode = webResponse.status;
  for (const [key, value] of webResponse.headers.entries()) {
    res.setHeader(key, value);
  }

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
  try {
    const workerHandler = await getHandler();
    const webRequest = await nodeRequestToWebRequest(req);

    // The Cloudflare Worker handler signature: fetch(request, env, ctx)
    const webResponse = await workerHandler.fetch(webRequest, process.env, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });

    await webResponseToNodeResponse(webResponse, res);
  } catch (err) {
    console.error('[SSR Error]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>500 Internal Server Error</h1><p>The server encountered an unexpected error.</p>');
  }
}
