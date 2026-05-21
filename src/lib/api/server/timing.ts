const DEFAULT_SLOW_ROUTE_MS = 1000;
const MAX_USER_AGENT_LENGTH = 160;

export async function withRouteTiming<TResponse extends Response>(
  request: Request,
  route: string,
  run: () => Promise<TResponse>,
  thresholdMs = DEFAULT_SLOW_ROUTE_MS
): Promise<TResponse> {
  const startedAt = performance.now();
  let status: number | string = 'thrown';

  try {
    const response = await run();
    status = response.status;
    return response;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    const debugEnabled = process.env.VERCEL_CPU_DEBUG === '1';

    if (debugEnabled || durationMs >= thresholdMs) {
      const url = new URL(request.url);
      const userAgent = request.headers.get('user-agent') ?? '';

      console.info(
        '[route_timing]',
        JSON.stringify({
          route,
          method: request.method,
          path: url.pathname,
          status,
          durationMs,
          userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH),
        })
      );
    }
  }
}
