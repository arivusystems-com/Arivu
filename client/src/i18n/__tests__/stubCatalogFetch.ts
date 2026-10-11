import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const clientRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** Serves `?url` locale catalog requests from disk (Vitest has no asset server). */
export function stubCatalogFetch(): void {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const pathname = new URL(String(input), 'http://localhost').pathname;
    const body = await readFile(`${clientRoot}${pathname.replace(/^\//, '')}`, 'utf8');
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}
