import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

async function createCredentials(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString('base64')}\n-----END PRIVATE KEY-----\n`;

  return JSON.stringify({
    project_id: 'test-project',
    client_email: 'vertex-test@test-project.iam.gserviceaccount.com',
    private_key: privateKey,
  });
}

afterEach(() => {
  if (originalCredentials === undefined) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  } else {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = originalCredentials;
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Claude Vertex provider', () => {
  it('does not advertise malformed credentials as available', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{';
    const { isClaudeAvailable, streamTextClaude } = await import('@/lib/ai/provider');

    expect(isClaudeAvailable()).toBe(false);
    await expect(streamTextClaude('system', [{ role: 'user', content: 'hello' }]))
      .rejects.toMatchObject({ code: 'claude_invalid_credentials' });
  });

  it('uses Sonnet 4.6 with a valid adaptive-thinking payload', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = await createCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: 'test-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response('data: [DONE]\n\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { streamTextClaude } = await import('@/lib/ai/provider');
    const result = await streamTextClaude(
      'system',
      [{ role: 'user', content: 'hello' }],
      { temperature: 0.7, maxTokens: 4096 }
    );

    expect(result?.model).toBe('claude-sonnet-4-6');
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/claude-sonnet-4-6:streamRawPredict');
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty('temperature');
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'medium' });
  });

  it('uses Sonnet 4.6 for manual non-streaming generation too', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = await createCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: 'test-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { generateTextClaude } = await import('@/lib/ai/provider');
    const result = await generateTextClaude('system', [{ role: 'user', content: 'hello' }]);

    expect(result?.model).toBe('claude-sonnet-4-6');
    const [url] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/claude-sonnet-4-6:rawPredict');
  });

  it('turns a Vertex model-access 404 into an actionable error', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = await createCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ access_token: 'test-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response('model not found or project has no access', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const { streamTextClaude } = await import('@/lib/ai/provider');
    await expect(streamTextClaude('system', [{ role: 'user', content: 'hello' }]))
      .rejects.toMatchObject({
        code: 'claude_model_unavailable',
        message: expect.stringContaining('Model Garden'),
      });
  });
});
