type PackagedWindow = typeof globalThis & { SENTINELA_ASSETS?: Record<string, string> };

export function assetUrl(path: string) {
  return (globalThis as PackagedWindow).SENTINELA_ASSETS?.[path] || path;
}

export function hasEmbeddedAssets() {
  return Boolean((globalThis as PackagedWindow).SENTINELA_ASSETS);
}
