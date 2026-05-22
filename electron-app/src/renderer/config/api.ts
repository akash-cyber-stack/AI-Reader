/** API bases — set REACT_APP_* in Vercel env when backends are hosted elsewhere */
export const NODE_API =
  process.env.REACT_APP_NODE_API?.replace(/\/$/, '') || 'http://localhost:5000';

export const PYTHON_API =
  process.env.REACT_APP_PYTHON_API?.replace(/\/$/, '') || 'http://localhost:8000';
