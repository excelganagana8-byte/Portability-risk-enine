import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = app.listen(env.PORT, () =>
  process.stdout.write(`PRE API listening on http://localhost:${env.PORT}\n`)
);
server.requestTimeout = 100_000;
server.headersTimeout = 105_000;
