import { DurableObject } from 'cloudflare:workers';
import { isAllowedOrigin, parseRoute, safeEqual, shouldKeepWarm } from './policy';

export interface Env {
  CHANNELS: DurableObjectNamespace<TournamentChannel>;
  ALLOWED_ORIGINS: string;
  ALLOW_VERCEL_PREVIEWS: string;
  KEEP_WARM_URL: string;
  KEEP_WARM_FROM: string;
  KEEP_WARM_UNTIL: string;
  PUBLISH_SECRET: string;
}

/** One instance per tournament id. Holds that tournament's viewer sockets. */
export class TournamentChannel extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answered by Cloudflare without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/connect') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/broadcast') {
      const message = await request.text();
      let sent = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message);
          sent++;
        } catch {
          // Socket already closing; Cloudflare removes it.
        }
      }
      return Response.json({ sent });
    }
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(): Promise<void> {
    // Clients send only "ping", which the auto-response handles. Ignore anything else.
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'closing');
    } catch {
      // already closed
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = parseRoute(url.pathname);

    if (route.kind === 'health') return Response.json({ status: 'ok' });
    if (route.kind === 'notFound') return new Response('Not found', { status: 404 });

    const stub = env.CHANNELS.get(env.CHANNELS.idFromName(route.tournamentId));

    if (route.kind === 'ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const origin = request.headers.get('Origin');
      if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS, env.ALLOW_VERCEL_PREVIEWS === 'true')) {
        return new Response('Origin not allowed', { status: 403 });
      }
      return stub.fetch(new Request('https://do/connect', request));
    }

    // publish
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.PUBLISH_SECRET || !safeEqual(token, env.PUBLISH_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    let revision = 0;
    try {
      const body = (await request.json()) as { revision?: unknown };
      revision = typeof body.revision === 'number' ? body.revision : 0;
    } catch {
      return new Response('Bad JSON', { status: 400 });
    }
    const message = JSON.stringify({ type: 'changed', tournamentId: route.tournamentId, revision });
    return stub.fetch('https://do/broadcast', { method: 'POST', body: message });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!shouldKeepWarm(new Date(), env.KEEP_WARM_FROM, env.KEEP_WARM_UNTIL)) return;
    ctx.waitUntil(fetch(env.KEEP_WARM_URL, { headers: { 'User-Agent': 'matchfoundry-keepwarm' } }).then(() => undefined, () => undefined));
  },
} satisfies ExportedHandler<Env>;
