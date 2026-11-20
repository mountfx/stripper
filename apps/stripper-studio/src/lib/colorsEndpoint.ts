/**
 * The /api/colors payload: color scales derived from studio URL params.
 * Shared by the deployed serverless function (api/colors.ts) and the dev
 * middleware in vite.config.ts.
 */
import { toColorsJson } from 'stripper';
import { themeFromParams } from './themeFromParams';

export function colorsPayload(q: URLSearchParams): { status: number; body: string } {
  const { scales, error } = themeFromParams(q);
  if (!scales) {
    return { status: 400, body: JSON.stringify({ error: error ?? 'invalid params' }) };
  }
  return { status: 200, body: toColorsJson(scales) };
}
