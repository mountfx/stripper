import { describe, it, expect } from 'vitest';
import handler from '../api/colors';

function mockReq(url: string) {
  return { url };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    send(body: string) {
      res.body = body;
    },
  };
  return res;
}

describe('api/colors handler', () => {
  it('serves the default colors JSON with correct headers', () => {
    const res = mockRes();
    handler(mockReq('https://studio.example/api/colors'), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    const parsed = JSON.parse(res.body) as Record<string, string[]>;
    expect(Object.keys(parsed).sort()).toEqual(['neutral', 'primary']);
    expect(parsed.primary).toHaveLength(11);
    expect(parsed.neutral).toHaveLength(11);
    for (const hex of [...(parsed.primary ?? []), ...(parsed.neutral ?? [])]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('derives every scheme from URL params', () => {
    const res = mockRes();
    handler(mockReq('https://studio.example/api/colors?s1=%23895af6&s2=%2371717a'), res);
    const fromParams = JSON.parse(res.body) as Record<string, string[]>;
    expect(res.statusCode).toBe(200);
    expect(Object.keys(fromParams).sort()).toEqual(['scheme1', 'scheme2']);
    expect(fromParams.scheme1).toHaveLength(11);
    expect(fromParams.scheme2).toHaveLength(11);
    // the anchor params actually change the output vs the default theme
    const resDefault = mockRes();
    handler(mockReq('https://studio.example/api/colors'), resDefault);
    const fromDefault = JSON.parse(resDefault.body) as Record<string, string[]>;
    expect(fromParams.scheme1).not.toEqual(fromDefault.primary);
    expect(fromParams.scheme2).not.toEqual(fromDefault.neutral);
  });

  it('serves the exact preset scale when a preset param is given', () => {
    const res = mockRes();
    handler(mockReq('https://studio.example/api/colors?s1preset=violet&s1name=primary&s2=%2371717a&s2name=neutral'), res);
    const parsed = JSON.parse(res.body) as Record<string, string[]>;
    expect(parsed.primary).toEqual([
      '#f5f3ff',
      '#ede9fe',
      '#ddd6fe',
      '#c4b5fd',
      '#a78bfa',
      '#8b5cf6',
      '#7c3aed',
      '#6d28d9',
      '#5b21b6',
      '#4c1d95',
      '#2e1065',
    ]);
  });

  it('serves more than two schemes', () => {
    const res = mockRes();
    handler(mockReq('https://studio.example/api/colors?s1=%23ff0000&s2=%2300ff00&s3=%230000ff&s3name=accent'), res);
    const parsed = JSON.parse(res.body) as Record<string, string[]>;
    expect(Object.keys(parsed).sort()).toEqual(['accent', 'scheme1', 'scheme2']);
    for (const hexes of Object.values(parsed)) expect(hexes).toHaveLength(11);
  });

  it('returns 400 with an error message for unparseable anchors', () => {
    const res = mockRes();
    handler(mockReq('https://studio.example/api/colors?s1=zzz'), res);
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body) as { error: string };
    expect(parsed.error).toContain('Unparseable color');
  });
});
