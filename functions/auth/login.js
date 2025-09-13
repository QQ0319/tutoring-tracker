// functions/auth/login.js
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const state = cryptoRandomString(24);
  const clientId = env.GITHUB_CLIENT_ID;
  const redirect = env.REDIRECT_URI || new URL('/functions/auth/callback', url.origin).toString();
  const scope = env.GITHUB_SCOPE || 'public_repo';

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirect);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

function cryptoRandomString(len){
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>('0'+(b&0xff).toString(16)).slice(-2)).join('');
}
