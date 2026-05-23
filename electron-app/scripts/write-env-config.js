/**
 * Writes public/env-config.js from Vercel/Railway env vars at build time.
 */
const fs = require('fs');
const path = require('path');

const config = {
  NODE_API: process.env.REACT_APP_NODE_API || '',
  PYTHON_API: process.env.REACT_APP_PYTHON_API || ''
};

const out = path.join(__dirname, '..', 'public', 'env-config.js');
const body = `window.APP_CONFIG=${JSON.stringify(config)};\n`;
fs.writeFileSync(out, body, 'utf8');
console.log('Wrote env-config.js', config);
