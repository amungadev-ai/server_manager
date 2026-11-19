import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { ApiException } from '../common/errors';

export const SESSION_COOKIE = '__Host-cloudlane_session';
export const SETUP_COOKIE = '__Host-cloudlane_setup';
export const CSRF_HEADER = 'x-csrf-token';
export const AUTH_REQUEST_HEADER = 'x-cloudlane-request';
export const REVIEW_TOKEN = Symbol('cloudlane.owner-auth-review');
export const opaque = () => randomBytes(32).toString('base64url');
export function decodeOpaque(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value
    ? bytes
    : null;
}
export const verifier = (purpose: string, value: string) =>
  createHash('sha256')
    .update(`cloudlane.${purpose}.v1\0`)
    .update(value)
    .digest();
export function sameNonce(expected: Buffer, input: unknown): boolean {
  const bytes = decodeOpaque(input);
  return (
    bytes !== null &&
    expected.length === bytes.length &&
    timingSafeEqual(expected, bytes)
  );
}
function headerCount(request: Request, name: string): number {
  return request.rawHeaders.filter(
    (value, index) => index % 2 === 0 && value.toLowerCase() === name,
  ).length;
}
export function readCredential(request: Request, name: string): string | null {
  if (headerCount(request, 'cookie') > 1) return null;
  const header = request.headers.cookie;
  if (!header || header.length > 8192) return null;
  const values = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + '='));
  if (values.length !== 1) return null;
  const value = values[0]?.slice(name.length + 1);
  return decodeOpaque(value) ? value! : null;
}
export class AuthBoundary {
  readonly origin: URL;
  constructor(origin: string) {
    const parsed = new URL(origin);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/' ||
      parsed.origin !== origin
    )
      throw new Error(
        'Review authentication requires one canonical HTTPS origin.',
      );
    this.origin = parsed;
  }
  assert(request: Request): void {
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (
      !request.secure ||
      headerCount(request, 'host') !== 1 ||
      request.headers.host !== this.origin.host ||
      request.originalUrl.includes('?') ||
      headerCount(request, 'origin') > 1 ||
      headerCount(request, CSRF_HEADER) > 1 ||
      headerCount(request, AUTH_REQUEST_HEADER) > 1 ||
      (request.headers.origin !== undefined &&
        request.headers.origin !== this.origin.origin) ||
      request.headers['sec-fetch-site'] === 'cross-site' ||
      (mutation &&
        (request.headers.origin !== this.origin.origin ||
          request.headers[AUTH_REQUEST_HEADER] !== 'owner-auth'))
    )
      throw new ApiException(403, 'FORBIDDEN');
  }
}
export function setCredential(
  response: Response,
  name: string,
  value: string,
  seconds: number,
): void {
  response.cookie(name, value, {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: seconds * 1000,
  });
}
export const clearCredential = (response: Response, name: string) =>
  setCredential(response, name, '', 0);
