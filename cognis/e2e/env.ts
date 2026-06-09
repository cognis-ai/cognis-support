import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Credentials come from env vars first; as a dev convenience we fall back to
// reading CHATWOOT_ADMIN_PASSWORD out of the platform .env.local (sibling
// checkout). The value is never logged and never written anywhere.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_ENV_FILE =
  process.env.PLATFORM_ENV_FILE ??
  path.resolve(HERE, '../../../cognis-platform/.env.local');

function fromPlatformEnv(key: string): string | undefined {
  try {
    const raw = fs.readFileSync(PLATFORM_ENV_FILE, 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!m) return undefined;
    return m[1].trim().replace(/^["']|["']$/g, '').replace(/\r$/, '');
  } catch {
    return undefined;
  }
}

export const BASE_URL = process.env.CW_BASE_URL ?? 'http://localhost:3000';
export const ADMIN_EMAIL = process.env.CW_ADMIN_EMAIL ?? 'admin@cognis.io';
export const ADMIN_PASS =
  process.env.CW_ADMIN_PASS ?? fromPlatformEnv('CHATWOOT_ADMIN_PASSWORD') ?? '';
