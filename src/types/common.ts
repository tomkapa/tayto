import type { AppError } from '../errors/app-error.js';

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export interface CLIOutput<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
