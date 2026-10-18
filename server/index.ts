import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { createApp } from './app';
import { openDb, seed } from './db';
import { seedData } from './data';
import { RateLimiter } from './rateLimiter';

const isProd = process.env.NODE_ENV === 'production';
// Production secrets (admin login) live in .env.production so development keeps its sample accounts.
dotenv.config({ path: isProd ? ['.env.production', '.env'] : ['.env'], quiet: true });
const port = Number(process.env.PORT ?? (isProd ? 3000 : 3001));
const dbPath = process.env.DATABASE_PATH ?? path.resolve('data', 'nutrifacts.db');

const db = openDb(dbPath);
// Sample accounts and their records are for local development only, unless explicitly switched on.
const demo = process.env.SEED_DEMO_USERS ? process.env.SEED_DEMO_USERS === 'true' : !isProd;
await seed(db, {
  demoUsers: demo,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
});

seedData(db, { demoRecords: demo });

const signUpsPerHour = Number(process.env.SIGNUPS_PER_HOUR_PER_IP ?? 20);

// Behind a reverse proxy / load balancer set TRUST_PROXY (usually 1) so client IPs and https are
// detected correctly. PUBLIC_ORIGIN lists the site's public URL(s), comma-separated.
const trustProxy = process.env.TRUST_PROXY
  ? /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY
  : undefined;
const publicOrigins = process.env.PUBLIC_ORIGIN?.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

const app = createApp({
  db,
  trustProxy,
  publicOrigins,
  strictHeaders: isProd,
  signUpLimiter: new RateLimiter({ max: signUpsPerHour, windowMs: 60 * 60 * 1000 }),
  secureCookies: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
});

// In production this one process also serves the built web app.
const distDir = path.resolve('dist');
if (isProd && fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(port, () => {
  console.log(`Nutrifacts API listening on http://localhost:${port} (${isProd ? 'production' : 'development'})`);
});
