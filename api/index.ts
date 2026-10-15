import type { IncomingMessage, ServerResponse } from 'http';
import { createApiMiddleware } from '../src/server/api';

const middleware = createApiMiddleware();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return await middleware(req, res);
  } catch (err: any) {
    console.error('[API Serverless Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      name: err?.name,
      message: err?.message || String(err),
      stack: err?.stack,
    }));
  }
}
