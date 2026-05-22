/** Python service URL for Railway / local (host:port or full https URL) */
export function getPythonApiUrl(): string {
  const full = process.env.PYTHON_API_URL?.replace(/\/$/, '');
  if (full) return full;
  const host = process.env.PYTHON_AI_HOST || 'localhost';
  const port = process.env.PYTHON_AI_PORT || '8000';
  const scheme = process.env.PYTHON_AI_SCHEME || (port === '443' ? 'https' : 'http');
  return `${scheme}://${host}:${port}`;
}
