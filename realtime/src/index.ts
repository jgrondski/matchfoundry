import { DurableObject } from 'cloudflare:workers';
import {
  EMPTY_SCHEDULE,
  isAllowedOrigin,
  isInKeepWarmWindow,
  isScheduleDue,
  parseKeepWarmSchedule,
  parseRoute,
  safeEqual,
  type StoredSchedule,
} from './policy';

export interface Env {
  CHANNELS: DurableObjectNamespace<TournamentChannel>;
  ALLOWED_ORIGINS: string;
  ALLOW_VERCEL_PREVIEWS: string;
  KEEP_WARM_URL: string;
  KEEP_WARM_SCHEDULE_URL: string;
  KEEP_WARM: DurableObjectNamespace<KeepWarmSchedule>;
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

const KEEP_WARM_HEADERS = { 'User-Agent': 'matchfoundry-keepwarm' };

/** Single instance ("schedule") that stores the keep-warm windows fetched from the API. */
export class KeepWarmSchedule extends DurableObject<Env> {
  async status(): Promise<StoredSchedule> {
    return (await this.ctx.storage.get<StoredSchedule>('schedule')) ?? EMPTY_SCHEDULE;
  }

  /** Called by the cron every 4 minutes: refresh the schedule when due, then ping the API inside a window. */
  async tick(): Promise<void> {
    const now = Date.now();
    let schedule = await this.status();
    if (isScheduleDue(now, schedule)) {
      schedule = { ...schedule, lastAttemptAt: now };
      try {
        const res = await fetch(this.env.KEEP_WARM_SCHEDULE_URL, { headers: KEEP_WARM_HEADERS });
        const windows = res.ok ? parseKeepWarmSchedule(await res.json()) : null;
        if (windows) schedule = { windows, fetchedAt: now, lastAttemptAt: now };
      } catch {
        // Keep the previous windows; isScheduleDue retries after SCHEDULE_RETRY_MS.
      }
      await this.ctx.storage.put('schedule', schedule);
    }
    if (isInKeepWarmWindow(new Date(now), schedule.windows)) {
      await fetch(this.env.KEEP_WARM_URL, { headers: KEEP_WARM_HEADERS }).catch(() => undefined);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = parseRoute(url.pathname);

    if (route.kind === 'health') return Response.json({ status: 'ok' });
    if (route.kind === 'keepWarm') {
      const schedule = await env.KEEP_WARM.get(env.KEEP_WARM.idFromName('schedule')).status();
      return Response.json(schedule);
    }
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
    const stub = env.KEEP_WARM.get(env.KEEP_WARM.idFromName('schedule'));
    ctx.waitUntil(stub.tick().catch(() => undefined));
  },
} satisfies ExportedHandler<Env>;
