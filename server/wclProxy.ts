// Lógica server-side compartilhada (função Netlify + middleware do Vite em dev).
// Fluxo OAuth2 "client credentials": https://www.warcraftlogs.com/api/docs
const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const API_URL = 'https://www.warcraftlogs.com/api/v2/client';

interface Credentials {
  clientId: string;
  clientSecret: string;
}

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(creds: Credentials, force = false): Promise<string> {
  if (!force && cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter token WCL (${res.status}). Verifique WCL_CLIENT_ID/WCL_CLIENT_SECRET.`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Encaminha uma requisição GraphQL (corpo JSON) para a API do WCL com token válido. */
export async function handleWclRequest(
  method: string,
  body: string,
  env: Record<string, string | undefined>,
): Promise<Response> {
  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const clientId = env.WCL_CLIENT_ID;
  const clientSecret = env.WCL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: 'WCL_CLIENT_ID / WCL_CLIENT_SECRET não configurados no servidor.' }, 500);
  }
  const creds = { clientId, clientSecret };

  try {
    const call = async (force: boolean) =>
      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken(creds, force)}`,
        },
        body,
      });

    let upstream = await call(false);
    // Token revogado/expirado: renova uma vez e tenta de novo.
    if (upstream.status === 401) upstream = await call(true);

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 502);
  }
}
