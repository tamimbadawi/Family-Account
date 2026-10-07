import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mockRpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

describe('/api/keepalive', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockRpc.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('401 Unauthorized', () => {
    it('returns 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer some-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it('returns 401 when Authorization header is missing', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      const req = new Request('http://localhost/api/keepalive');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it('returns 401 when Authorization header does not match CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });
  });

  describe('503 Service Unavailable', () => {
    it('returns 503 when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'valid-key';

      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer valid-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it('returns 503 when Supabase key is missing', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;

      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer valid-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });
  });

  describe('200 OK', () => {
    it('returns 200 with pingedAt when authorized and Supabase rpc succeeds', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'valid-key';

      const pingedAt = '2026-10-07T11:00:00.000Z';
      mockRpc.mockResolvedValueOnce({ data: pingedAt, error: null });

      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer valid-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true, pingedAt });
      expect(mockRpc).toHaveBeenCalledWith('keepalive');
    });

    it('works with POST method as well', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'valid-key';

      const pingedAt = '2026-10-07T11:00:00.000Z';
      mockRpc.mockResolvedValueOnce({ data: pingedAt, error: null });

      const req = new Request('http://localhost/api/keepalive', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-secret' },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true, pingedAt });
    });
  });

  describe('Error handling', () => {
    it('returns 502 when rpc returns an error', async () => {
      process.env.CRON_SECRET = 'valid-secret';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'valid-key';

      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database paused' } });

      const req = new Request('http://localhost/api/keepalive', {
        headers: { authorization: 'Bearer valid-secret' },
      });
      const res = await GET(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe('Database paused');
    });
  });
});
