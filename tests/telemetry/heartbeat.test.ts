import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { maybeSendHeartbeat, todayUTC } from '../../src/telemetry/heartbeat.js';
import type { FetchFn } from '../../src/types/common.js';

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

describe('maybeSendHeartbeat', () => {
  let testDir: string;
  let statePath: string;

  function mockFetch(): FetchFn {
    return vi.fn<FetchFn>().mockResolvedValue(new Response(null, { status: 204 }));
  }

  function failFetch(): FetchFn {
    return vi.fn<FetchFn>().mockRejectedValue(new Error('network error'));
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `tayto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    statePath = join(testDir, 'telemetry.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('sends ping on first run (no telemetry.json exists)', async () => {
    const fetch = mockFetch();

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/heartbeat');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty('installId');
    expect(body).toHaveProperty('version', '1.0.0');
    expect(body).toHaveProperty('os');
    expect(body).toHaveProperty('nodeVersion');
    expect(body).toHaveProperty('timestamp');
  });

  it('generates and persists install ID on first run', async () => {
    const fetch = mockFetch();

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(existsSync(statePath)).toBe(true);
    });
    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, string>;
    expect(state['installId']).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(state['lastPingDate']).toBe(todayUTC());
  });

  it('does NOT send ping if lastPingDate is today', async () => {
    const fetch = mockFetch();
    const installId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    writeFileSync(statePath, JSON.stringify({ installId, lastPingDate: todayUTC() }), 'utf-8');

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    // Give the async IIFE time to execute
    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends ping if lastPingDate is yesterday', async () => {
    const fetch = mockFetch();
    const installId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    writeFileSync(statePath, JSON.stringify({ installId, lastPingDate: yesterdayUTC() }), 'utf-8');

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body['installId']).toBe(installId);
  });

  it('does NOT send ping if TASKCLI_TELEMETRY_DISABLED=1', async () => {
    const fetch = mockFetch();

    maybeSendHeartbeat({
      statePath,
      version: '1.0.0',
      fetchImpl: fetch,
      env: { TASKCLI_TELEMETRY_DISABLED: '1' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does NOT send ping if CI=true', async () => {
    const fetch = mockFetch();

    maybeSendHeartbeat({
      statePath,
      version: '1.0.0',
      fetchImpl: fetch,
      env: { CI: 'true' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does NOT send ping if GITHUB_ACTIONS is set', async () => {
    const fetch = mockFetch();

    maybeSendHeartbeat({
      statePath,
      version: '1.0.0',
      fetchImpl: fetch,
      env: { GITHUB_ACTIONS: 'true' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('writes lastPingDate optimistically before response', async () => {
    const fetch = vi.fn<FetchFn>().mockReturnValue(new Promise(() => {}));

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(existsSync(statePath)).toBe(true);
    });
    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, string>;
    expect(state['lastPingDate']).toBe(todayUTC());
  });

  it('handles fetch failure silently (no thrown errors)', async () => {
    const fetch = failFetch();

    expect(() => {
      maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  it('handles corrupt telemetry.json gracefully', async () => {
    writeFileSync(statePath, 'not valid json!!!', 'utf-8');
    const fetch = mockFetch();

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, string>;
    expect(state['installId']).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('preserves the same installId across multiple days', async () => {
    const fetch = mockFetch();
    const installId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    writeFileSync(statePath, JSON.stringify({ installId, lastPingDate: yesterdayUTC() }), 'utf-8');

    maybeSendHeartbeat({ statePath, version: '1.0.0', fetchImpl: fetch, env: {} });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, string>;
    expect(state['installId']).toBe(installId);
    expect(state['lastPingDate']).toBe(todayUTC());
  });
});
