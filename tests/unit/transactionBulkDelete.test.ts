import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteTransactionsBulk, type BulkDeleteEvent } from '@/lib/api/transactions';

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deleteTransactionsBulk', () => {
  it('streams progress and returns the final result across split network chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      'data: {"type":"progress","current":0,"total":2,"deleted":0,"failed":0}\n\n',
      'data: {"type":"progress","current":1,"total":2,"deleted":1,',
      '"failed":0}\n\ndata: {"type":"result","current":2,"total":2,"deleted":2,"failed":0,"errors":[]}\n\n',
      'data: {"type":"done"}\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const events: BulkDeleteEvent[] = [];

    const result = await deleteTransactionsBulk(['id-1', 'id-2'], (event) => events.push(event));

    expect(result).toEqual({ deleted: 2, failed: 0, errors: [] });
    expect(events.map((event) => event.type)).toEqual(['progress', 'progress', 'result', 'done']);
    expect(events[1]).toMatchObject({ current: 1, total: 2, deleted: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions/bulk-delete', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
    }));
  });

  it('surfaces JSON validation errors returned before the SSE stream starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Periode sudah dikunci' }),
      { status: 423, headers: { 'Content-Type': 'application/json' } }
    )));

    await expect(deleteTransactionsBulk(['id-1'])).rejects.toThrow('Periode sudah dikunci');
  });

  it('rejects when the server emits an SSE error event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"type":"progress","current":1,"total":2,"deleted":1,"failed":0}\n\n',
      'data: {"type":"error","message":"Koneksi database terputus"}\n\n',
      'data: {"type":"done"}\n\n',
    ])));

    await expect(deleteTransactionsBulk(['id-1', 'id-2'])).rejects.toThrow('Koneksi database terputus');
  });
});
