import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    },
    { status: 400 }
  );
}

export function serverError(error: unknown, fallback = 'Internal server error') {
  console.error('[SERVER ERROR]', error);
  let message = fallback;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = (error as any).message;
  }
  return NextResponse.json({ error: message }, { status: 500 });
}
