import type { IncomingMessage, ServerResponse } from 'http';

let middleware: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!middleware) {
      const { createApiMiddleware } = await import('../src/server/api');
      middleware = createApiMiddleware();
    }
    return await middleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found', url: req.url }));
    });
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
