// functions/auth/callback.js
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request.headers.get('Cookie') || '', 'oauth_state');
  if(!code || !state || state !== cookieState){
    return new Response('家教複習課：OAuth 驗證失敗（state 不符）', { status: 400 });
  }
  const body = new URLSearchParams();
  body.set('client_id', env.GITHUB_CLIENT_ID);
  body.set('client_secret', env.GITHUB_CLIENT_SECRET);
  body.set('code', code);
  body.set('redirect_uri', env.REDIRECT_URI || new URL('/functions/auth/callback', url.origin).toString());

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept':'application/json' },
    body
  });
  const tokenJson = await tokenRes.json();
  if(!tokenJson.access_token){
    return new Response('家教複習課：OAuth 交換失敗 ' + JSON.stringify(tokenJson), { status: 400 });
  }

  const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;
  const html = `<!doctype html>
  <meta charset="utf-8">
  <title>家教複習課：GitHub 登入完成</title>
  <script>
    (function(){
      const data = { type: 'github_token', token: ${JSON.stringify(tokenJson.access_token)} };
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(data, ${JSON.stringify(allowedOrigin)});
        window.close();
      } else {
        document.body.innerText = '登入完成：請關閉此視窗，回到「家教複習課」主頁。';
      }
    })();
  </script>`;

  const headers = new Headers({ 'Content-Type':'text/html; charset=utf-8' });
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(html, { status: 200, headers });
}

function getCookie(cookie, name){
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
