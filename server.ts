import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { loginUser, registerUser, verifySessionToken } from './server/authStore';
import {
  createRoomForUser,
  handleClientWsMessage,
  handleUserDisconnect,
  joinRoomByCodeOrId,
  leaveCurrentRoom,
  listOpenRooms,
  matchmakeUser,
  serializeRoomSummary,
  startMatchSimulationLoop,
  startRoomMatch,
} from './server/matchEngine';

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // Authentication Endpoints (Server-only secret signing)
  app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }
    const result = registerUser(username, password);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }
    const result = loginUser(username, password);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ user: result.user, token: result.token });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = verifySessionToken(token);
    if (!user) {
      res.status(401).json({ error: 'Session invalid or expired.' });
      return;
    }
    res.json({ user });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: listOpenRooms() });
  });

  // Mount Vite dev middleware in development or static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '/ws', 'http://localhost:3000');
    const token = url.searchParams.get('token') || '';
    const user = verifySessionToken(token);
    if (!user) {
      ws.send(JSON.stringify({ type: 'auth:error', error: 'Authentication required.' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.send(JSON.stringify({ type: 'auth:ok', user }));

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
        if (msg.type === 'room:create') {
          const room = createRoomForUser(
            user.id,
            user.username,
            ws,
            typeof msg.roomName === 'string' ? msg.roomName : undefined,
          );
          ws.send(JSON.stringify({ type: 'room:joined', room: serializeRoomSummary(room) }));
        } else if (msg.type === 'room:join') {
          const res = joinRoomByCodeOrId(
            user.id,
            user.username,
            ws,
            String(msg.code ?? ''),
          );
          if (!res.ok) {
            ws.send(JSON.stringify({ type: 'room:error', error: res.error }));
          } else {
            ws.send(JSON.stringify({ type: 'room:joined', room: serializeRoomSummary(res.room) }));
          }
        } else if (msg.type === 'room:matchmake') {
          const room = matchmakeUser(user.id, user.username, ws);
          ws.send(JSON.stringify({ type: 'room:joined', room: serializeRoomSummary(room) }));
        } else if (msg.type === 'room:leave') {
          leaveCurrentRoom(user.id);
          ws.send(JSON.stringify({ type: 'room:left' }));
        } else if (msg.type === 'room:start') {
          const res = startRoomMatch(user.id);
          if (!res.ok) {
            ws.send(JSON.stringify({ type: 'room:error', error: res.error }));
          }
        } else {
          handleClientWsMessage(user.id, ws, msg);
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      handleUserDisconnect(user.id, ws);
    });
  });

  startMatchSimulationLoop();

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`PROJECT BATTLE ROYALE server listening on http://0.0.0.0:${port}`);
  });
}

bootstrap();
