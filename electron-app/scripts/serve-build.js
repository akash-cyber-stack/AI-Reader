const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const buildDir = path.join(__dirname, '..', 'build');

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(buildDir, safePath === '/' ? 'index.html' : safePath);
  const resolvedPath = filePath.startsWith(buildDir) ? filePath : path.join(buildDir, 'index.html');

  fs.readFile(resolvedPath, (error, data) => {
    if (error) {
      fs.readFile(path.join(buildDir, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallbackData);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(resolvedPath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`AI Assistant UI served at http://localhost:${port}`);
});
