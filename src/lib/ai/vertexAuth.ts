/**
 * Shared Vertex AI authentication helper.
 * Extracted supaya bisa dipakai dari provider.ts dan agent-query route.
 */

let _vertexToken: { token: string; expiresAt: number } | null = null;

interface VertexCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

function getVertexCredentials(): VertexCredentials | null {
  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credJson) return null;
  try {
    const creds = JSON.parse(credJson) as Partial<VertexCredentials>;
    if (!creds.project_id || !creds.client_email || !creds.private_key) return null;
    return creds as VertexCredentials;
  } catch {
    return null;
  }
}

export async function getVertexTokenAndProject(): Promise<{ token: string; projectId: string } | null> {
  if (_vertexToken && Date.now() < _vertexToken.expiresAt - 60_000) {
    const projectId = getVertexCredentials()?.project_id;
    if (projectId) return { token: _vertexToken.token, projectId };
  }

  const creds = getVertexCredentials();
  if (!creds) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));

    const pemBody = creds.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigInput = new TextEncoder().encode(`${header}.${payload}`);
    const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, sigInput);
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const jwt = `${header}.${payload}.${sig}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    if (!tokenRes.ok) return null;

    const tokenJson = await tokenRes.json() as { access_token: string; expires_in: number };
    _vertexToken = {
      token: tokenJson.access_token,
      expiresAt: Date.now() + tokenJson.expires_in * 1000,
    };
    return { token: _vertexToken.token, projectId: creds.project_id };
  } catch {
    return null;
  }
}
