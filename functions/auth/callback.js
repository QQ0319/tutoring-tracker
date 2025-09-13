// functions/auth/callback.js
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request.headers.get('Cookie') || '', 'oauth_state');

  if (!code || !state || state !== cookieState) {
    return new Response('OAuth 驗證失敗（state 不符）', { status: 400 });
  }

  // 用你在 Actions Variables 設好的變數
  const clientId = env.CLIENT_ID;
  const clientSecret = env.CLIENT_SECRET;
  const redirectUri = new URL('/functions/auth/callback', url.origin).toString();

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body
  });

  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    return new Response('OAuth 交換失敗 ' + JSON.stringify(tokenJson), { status: 400 });
  }

  const allowedOrigin = env.ALLOWED_ORIGIN || url.origin; // 例如 https://qq0319.github.io
  const html = `<!doctype html>
  <meta charset="utf-8">
  <title>GitHub 登入完成</title>
  <script>
    (function(){
      const data = { type: 'github_token', token: ${JSON.stringify(tokenJson.access_token)} };
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(data, ${JSON.stringify(allowedOrigin)});
        window.close();
      } else {
        document.body.innerText = '登入完成，請關閉此視窗並回到主頁。';
      }
    })();
  </script>`;

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(html, { status: 200, headers });
}

function getCookie(cookie, name){
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
