'use strict';
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const nextDir = path.join(__dirname, 'apps', 'web');
let app;
try {
  app = require(path.join(nextDir, 'node_modules', 'next'))({ dev: false, dir: nextDir });
} catch (e) {
  app = require('next')({ dev: false, dir: nextDir });
}
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res, parse(req.url, true)))
    .listen(process.env.PORT || 3000);
});
