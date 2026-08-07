import { serve } from '@hono/node-server';

import { app } from './app.ts';
import { resolveApiPort } from './port.ts';

const port = resolveApiPort(process.env['API_PORT']);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API サーバーを http://localhost:${info.port} で起動しました`);
});
