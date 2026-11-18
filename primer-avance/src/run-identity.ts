export async function sha256(bytes: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function cropIdentity(methodHash: string, bounds: number[], scenes: { id: string; date: string; bands: Record<string, string> }[]) {
  const signature = JSON.stringify({
    version: 2,
    method_sha256: methodHash,
    bounds,
    scenes: scenes.map(({ id, date, bands }) => ({
      id, date, bands: Object.entries(bands).sort(([a], [b]) => a.localeCompare(b, 'en')),
    })),
  });
  return 'recorte-' + (await sha256(new TextEncoder().encode(signature))).slice(0, 32);
}
