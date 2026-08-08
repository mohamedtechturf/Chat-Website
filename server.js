const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 8080;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    
    // API endpoint for listing stickers dynamically
    if (reqPath === '/api/stickers') {
      try {
        const stickersDir = path.join(PUBLIC_DIR, 'images', 'stickers');
        if (!fs.existsSync(stickersDir)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ stickers: [] }));
          return;
        }
        const files = fs.readdirSync(stickersDir);
        const stickers = files
          .filter(f => f.toLowerCase().endsWith('.webp'))
          .map(f => ({
            name: f,
            url: `/images/stickers/${encodeURIComponent(f)}`
          }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ stickers }));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list stickers' }));
        return;
      }
    }
    
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(PUBLIC_DIR, path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, ''));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Server error');
  }
});

const wss = new WebSocket.Server({ server });
const users = new Map();
const nameSet = new Set();
const typingSet = new Set();

// simple in-memory message store
const messages = new Map();
let msgCounter = 1;

function makeId(){
  return `${Date.now()}-${msgCounter++}`;
}

function broadcast(obj, except) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN && c !== except) c.send(raw);
  });
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'join') {
      const name = String(msg.username || '').trim().slice(0, 20);
      if (!name) { ws.send(JSON.stringify({ type: 'joined', success: false, reason: 'Empty username' })); return; }
      if (nameSet.has(name)) { ws.send(JSON.stringify({ type: 'joined', success: false, reason: 'Username already taken' })); return; }
      users.set(ws, name); nameSet.add(name);
      // ensure typing set is clean for this user
      typingSet.delete(name);
      ws.send(JSON.stringify({ type: 'joined', success: true, username: name }));
      broadcast({ type: 'userlist', users: Array.from(nameSet) });
      broadcast({ type: 'system', text: `${name} joined the chat`, ts: Date.now() }, ws);
      // notify others of typing state (mostly no-op but keeps clients in sync)
      broadcast({ type: 'typingUpdate', users: Array.from(typingSet) }, ws);
      return;
    }
    if (msg.type === 'typing') {
      const name = users.get(ws) || null;
      if (!name) return;
      try {
        if (msg.typing) {
          typingSet.add(name);
        } else {
          typingSet.delete(name);
        }
        // broadcast typing update to others
        broadcast({ type: 'typingUpdate', users: Array.from(typingSet) }, ws);
      } catch (e) {}
      return;
    }
    if (msg.type === 'message') {
      const from = users.get(ws) || 'Unknown';
      const id = makeId();
      const text = String(msg.text || '');
      const replyTo = msg.replyTo || null;
      const rec = { id, from, type: 'message', text, replyTo, ts: Date.now(), deleted: false };
      messages.set(id, rec);
      broadcast(Object.assign({ type: 'message' }, rec));
      return;
    }

    if (msg.type === 'file') {
      const from = users.get(ws) || 'Unknown';
      const data = String(msg.data || '').slice(0, 50 * 1024 * 1024);
      const thumbnail = String(msg.thumbnail || '').slice(0, 2 * 1024 * 1024); // Limit thumbnail to 2MB
      const id = makeId();
      const rec = { id, from, type: 'file', filename: String(msg.filename || 'file'), mime: String(msg.mime || 'application/octet-stream'), data, thumbnail, text: String(msg.text || ''), ts: Date.now(), deleted: false };
      messages.set(id, rec);
      broadcast(Object.assign({ type: 'file' }, rec));
      return;
    }

    if (msg.type === 'sticker') {
      const from = users.get(ws) || 'Unknown';
      const id = makeId();
      const stickerUrl = String(msg.stickerUrl || '');
      const replyTo = msg.replyTo || null;
      const rec = { id, from, type: 'sticker', stickerUrl, replyTo, ts: Date.now(), deleted: false };
      messages.set(id, rec);
      broadcast(Object.assign({ type: 'sticker' }, rec));
      return;
    }

    if (msg.type === 'edit') {
      // { type: 'edit', id, text, fileEdit? }
      const from = users.get(ws) || null;
      const id = String(msg.id || '');
      if (!messages.has(id)) return;
      const rec = messages.get(id);
      if (!rec) return;
      if (rec.from !== from) {
        // ignore edits from non-owners
        return;
      }
      // allow editing only text messages
      if (rec.type === 'message') {
        rec.text = String(msg.text || '');
        rec.edited = true;
        rec.ts = Date.now();
        messages.set(id, rec);
        broadcast({ type: 'edit', id: rec.id, text: rec.text, ts: rec.ts });
        return;
      } else if (rec.type === 'file' && msg.fileEdit) {
        rec.text = String(msg.text || '');
        rec.edited = true;
        rec.ts = Date.now();
        messages.set(id, rec);
        broadcast({ type: 'edit', id: rec.id, text: rec.text, ts: rec.ts, fileEdit: true });
        return;
      }
      return;
    }

    if (msg.type === 'delete') {
      // { type: 'delete', id }
      const from = users.get(ws) || null;
      const id = String(msg.id || '');
      if (!messages.has(id)) return;
      const rec = messages.get(id);
      if (!rec) return;
      if (rec.from !== from) return;
      rec.deleted = true;
      rec.ts = Date.now();
      messages.set(id, rec);
      broadcast({ type: 'delete', id: rec.id, ts: rec.ts });
      return;
    }
  });

  ws.on('close', () => {
    const n = users.get(ws);
    if (n) {
      users.delete(ws);
      nameSet.delete(n);
      typingSet.delete(n);
      broadcast({ type: 'left', username: n });
      broadcast({ type: 'userlist', users: Array.from(nameSet) });
      broadcast({ type: 'typingUpdate', users: Array.from(typingSet) });
    }
  });
  ws.on('error', () => {});
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

// get non-internal IPv4 addresses
function getLocalIPv4s() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ iface: name, address: net.address });
      }
    }
  }
  return results;
}

// Start server listening on all interfaces
server.listen(PORT, '0.0.0.0', () => {

  const addrs = getLocalIPv4s();
  if (addrs.length) {
    console.log('Access Link:');
    addrs.forEach(a => {
      console.log(`  http://${a.address}:${PORT}  (interface: ${a.iface})`);
    });
  }
});
