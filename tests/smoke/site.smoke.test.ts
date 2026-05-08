import { describe, it, expect, beforeAll } from 'vitest';

const SITE_URL = process.env.SITE_URL;

interface FetchedPage {
  status: number;
  headers: Headers;
  body: string;
}

async function fetchWithRetry(
  url: string,
  attempts = 6,
  delayMs = 3000,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status >= 500) {
        throw new Error(`upstream ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw new Error(
    `Failed to reach ${url} after ${attempts} attempts: ${String(lastErr)}`,
  );
}

describe('post-deploy smoke test', () => {
  let page: FetchedPage;

  beforeAll(async () => {
    if (!SITE_URL) {
      throw new Error(
        'SITE_URL env var is required (e.g. SITE_URL=http://my-bucket.s3-website-us-east-1.amazonaws.com).',
      );
    }
    const res = await fetchWithRetry(SITE_URL);
    page = {
      status: res.status,
      headers: res.headers,
      body: await res.text(),
    };
  }, 60_000);

  it('responds with HTTP 200', () => {
    expect(page.status).toBe(200);
  });

  it('serves HTML content-type', () => {
    const ct = page.headers.get('content-type') ?? '';
    expect(ct.toLowerCase()).toContain('text/html');
  });

  it('returns a non-empty document', () => {
    expect(page.body.length).toBeGreaterThan(100);
  });

  it('contains the expected page title', () => {
    expect(page.body).toMatch(/<title>[^<]*Lab 14[^<]*<\/title>/i);
  });

  it('contains the React root mount node', () => {
    expect(page.body).toContain('<div id="root"></div>');
  });

  it('references the built JS bundle', () => {
    expect(page.body).toMatch(/<script[^>]+src="\/assets\/index-[^"]+\.js"/);
  });

  it('references the built CSS bundle', () => {
    expect(page.body).toMatch(/<link[^>]+href="\/assets\/index-[^"]+\.css"/);
  });

  it('serves the JS bundle with HTTP 200 and a JS content-type', async () => {
    const match = page.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
    expect(match).not.toBeNull();
    const jsUrl = new URL(match![1], SITE_URL).toString();
    const res = await fetchWithRetry(jsUrl);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct.toLowerCase()).toMatch(/javascript|application\/ecmascript/);
  });
});
