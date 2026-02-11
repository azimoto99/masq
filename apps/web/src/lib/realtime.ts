const normalizeWsProtocol = (protocol: string) => {
  if (protocol === 'https:' || protocol === 'wss:') {
    return 'wss:';
  }

  return 'ws:';
};

const toRealtimeWsUrl = (base: string) => {
  const url = new URL(base, window.location.origin);
  url.protocol = normalizeWsProtocol(url.protocol);
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
};

export const buildWebSocketUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const configuredBase = configuredApiUrl?.trim();

  if (configuredBase) {
    try {
      return toRealtimeWsUrl(configuredBase);
    } catch {
      // fall through to same-origin realtime endpoint
    }
  }

  return toRealtimeWsUrl(window.location.origin);
};

export const createRealtimeSocket = () => {
  return new WebSocket(buildWebSocketUrl());
};
