declare global {
  interface Window {
    APP_CONFIG?: {
      NODE_API?: string;
      PYTHON_API?: string;
    };
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function fromRuntime(key: 'NODE_API' | 'PYTHON_API'): string | undefined {
  const v = window.APP_CONFIG?.[key];
  return v && v.trim() ? normalizeUrl(v.trim()) : undefined;
}

function fromBuild(key: string): string | undefined {
  const raw =
    key === 'NODE_API'
      ? process.env.REACT_APP_NODE_API
      : process.env.REACT_APP_PYTHON_API;
  return raw?.trim() ? normalizeUrl(raw.trim()) : undefined;
}

function resolveApi(key: 'NODE_API' | 'PYTHON_API', localDefault: string): string {
  return fromRuntime(key) || fromBuild(key) || localDefault;
}

/** Node backend (auth, commands proxy) */
export const NODE_API = resolveApi('NODE_API', 'http://localhost:5000');

/** Python backend (voice, direct API) */
export const PYTHON_API = resolveApi('PYTHON_API', 'http://localhost:8000');
