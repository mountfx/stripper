/**
 * GET /api/colors — the studio's color scales as JSON, derived from the same
 * URL params the studio app reads. Payload = the "Color JSON" export:
 * { "primary": ["#..", ...], "neutral": ["#..", ...] } in step order.
 *
 * Example: /api/colors?p=%23895af6&n=%23a49aa8 — any shared studio link works.
 */

/** Minimal structural types for the Vercel Node req/res shape. */
interface ApiRequest {
  url: string;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse;
  send(body: string): void;
}

import { colorsPayload } from '../src/lib/colorsEndpoint';

export default function handler(req: ApiRequest, res: ApiResponse): void {
  const q = new URLSearchParams(req.url.split('?')[1] ?? '');
  const { status, body } = colorsPayload(q);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(body);
}
