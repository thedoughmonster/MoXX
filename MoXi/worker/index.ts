function applyResponsePolicy(response: Response, stage: string): Response {
  if (stage.toLowerCase() === 'production') {
    const production = new Response(response.body, response);
    production.headers.set('X-Content-Type-Options', 'nosniff');
    production.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return production;
  }

  const output = new Response(response.body, response);
  output.headers.set('X-Robots-Tag', 'noindex, nofollow');
  output.headers.set('X-Content-Type-Options', 'nosniff');
  output.headers.set('Referrer-Policy', 'no-referrer');
  return output;
}

function normalizePath(pathname: string): string {
  if (pathname === '/health') return '/health.json';
  if (pathname === '/smoke') return '/smoke.json';
  return pathname;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const stage = env.APP_STAGE || 'preview';
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return applyResponsePolicy(new Response('Method not allowed', {
        status: 405
      }), stage);
    }

    const path = normalizePath(url.pathname);
    const mapped = new Request(new URL(path, request.url), request);

    let response = await env.ASSETS.fetch(mapped);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false;
    const isStaticProbe = path === '/health.json' || path === '/smoke.json';
    if (response.status === 404 && acceptsHtml && !isStaticProbe) {
      const fallbackRequest = new Request(new URL('/index.html', request.url), request);
      response = await env.ASSETS.fetch(fallbackRequest);
    }

    return applyResponsePolicy(response, stage);
  }
} satisfies ExportedHandler<Env>;
