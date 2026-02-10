# Masq Monorepo

Masq is a mask-based social platform MVP with a Fastify API and React web client.

## Stack
- API: Fastify + WebSocket, Prisma (Postgres), ioredis (Redis)
- Auth: Argon2 password hashing + JWT access token in httpOnly cookie
- Security hardening: centralized error handling, request rate limiting, structured pino logging, message sanitization
- Web: React + Vite + Tailwind
- Shared: Zod schemas + shared types

## Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

## Quick Start
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start local services and apps:
   ```bash
   pnpm dev
   ```
3. Apply migrations:
   ```bash
   pnpm prisma:migrate
   ```

## Commands
- `pnpm dev`: starts docker dependencies + API + web
- `pnpm build`: builds all packages
- `pnpm typecheck`: runs TypeScript project checks across workspaces
- `pnpm lint`: lints all packages
- `pnpm test`: runs workspace tests
- `pnpm test:e2e`: runs Playwright smoke tests
- `pnpm format`: formats the repo with Prettier
- `pnpm prisma:migrate`: applies Prisma migrations
- `pnpm prisma:generate`: generates Prisma client

## API Endpoints
- `GET /api/health`
- `POST /auth/register` `{ email, password }`
- `POST /auth/login` `{ email, password }`
- `POST /auth/logout`
- `GET /me`
- `POST /masks` `{ displayName, color?, avatarSeed? }`
- `DELETE /masks/:maskId`
- `POST /dm/start` `{ friendUserId, initialMaskId }`
- `GET /dm/threads`
- `GET /dm/:threadId`
- `POST /dm/:threadId/mask` `{ maskId }`
- `GET /rooms?maskId=<uuid>`
- `POST /rooms` `{ maskId, title, kind, expiresAt?, locked?, fogLevel?, messageDecayMinutes? }`
- `POST /rooms/:roomId/join` `{ maskId }`
- `POST /rooms/:roomId/mute` `{ actorMaskId, targetMaskId, minutes }`
- `POST /rooms/:roomId/exile` `{ actorMaskId, targetMaskId }`
- `POST /rooms/:roomId/lock` `{ actorMaskId, locked }`
- `POST /friends/request` `{ toEmail | toUserId }`
- `POST /friends/request/:id/accept`
- `POST /friends/request/:id/decline`
- `POST /friends/request/:id/cancel`
- `DELETE /friends/:friendUserId`
- `GET /friends`
- `GET /friends/requests`
- `POST /servers` `{ name }`
- `GET /servers`
- `GET /servers/:serverId`
- `POST /servers/:serverId/channels` `{ name }`
- `DELETE /servers/:serverId/channels/:channelId`
- `POST /servers/:serverId/invites` `{ expiresMinutes?, maxUses? }`
- `POST /servers/join` `{ inviteCode, serverMaskId }`
- `POST /servers/:serverId/mask` `{ serverMaskId }`
- `PATCH /servers/:serverId/settings` `{ channelIdentityMode }`
- `GET /servers/:serverId/roles`
- `POST /servers/:serverId/roles`
- `PATCH /servers/:serverId/roles/:roleId`
- `POST /servers/:serverId/members/:userId/roles` `{ roleIds }`
- `DELETE /servers/:serverId/members/:userId`
- `POST /channels/:channelId/mask` `{ maskId }`
- `WS /ws` (JWT cookie-authenticated)

## Frontend Flow
- `/register`: create account
- `/login`: sign in
- `/home`: navigation tabs for masks, friends, DMs, servers, and rooms
- `/masks`: choose/create/delete masks (max 3 per user)
- `/friends`: send/accept/decline/cancel requests and manage friend list
- `/dm` + `/dm/:threadId`: DM list and realtime DM chat
- `/servers` + `/servers/:serverId/:channelId`: server list, invites, roles, and realtime channel chat
- `/rooms` + `/rooms/:roomId`: create/join room and realtime chat by mask

## Realtime Events
- `JOIN_ROOM { roomId, maskId }`
- `SEND_MESSAGE { roomId, maskId, body }`
- `ROOM_STATE { room, members, recentMessages, serverTime }`
- `NEW_MESSAGE { message }`
- `MEMBER_JOINED { roomId, member }`
- `MEMBER_LEFT { roomId, member }`
- `MODERATION_EVENT { roomId, actionType, ... }`
- `ROOM_EXPIRED { roomId }`
- `JOIN_DM { threadId, maskId }`
- `SEND_DM { threadId, maskId, body }`
- `DM_STATE { threadId, participants, recentMessages }`
- `NEW_DM_MESSAGE { threadId, message }`
- `JOIN_CHANNEL { channelId }`
- `SEND_CHANNEL_MESSAGE { channelId, body }`
- `CHANNEL_STATE { channel, members, recentMessages }`
- `NEW_CHANNEL_MESSAGE { message }`
- Message body limit is `1000` characters (validated + sanitized server-side)

## Environment
Create `apps/api/.env` for local overrides.

### Required in production
- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET` (long random secret)
- `CORS_ORIGINS` (comma-separated allowed origins)

### Full variable reference
```env
# Runtime
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
TRUST_PROXY=false

# Datastores
DATABASE_URL=postgresql://masq:masq@localhost:5432/masq?schema=public
REDIS_URL=redis://localhost:6379

# CORS
WEB_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
CORS_ALLOW_NO_ORIGIN=true

# Auth / JWT
JWT_SECRET=masq-dev-secret-change-me-change-me!
AUTH_COOKIE_NAME=masq_token
ACCESS_TOKEN_TTL_SECONDS=86400

# Cookies
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=

# API rate limit
API_RATE_LIMIT_MAX=120
API_RATE_LIMIT_WINDOW_MS=60000
```

## Deployment Notes
- Run behind HTTPS in production and set `COOKIE_SECURE=true`.
- If frontend and API are on different subdomains, set `COOKIE_SAME_SITE=none` and keep `COOKIE_SECURE=true`.
- Set `CORS_ORIGINS` to your exact frontend origins (no wildcards).
- Keep `TRUST_PROXY=true` when running behind a reverse proxy/load balancer.
- Run `pnpm prisma:migrate` as part of deployment.
- Expose websocket upgrades for `/ws` in your reverse proxy.

## E2E Smoke Test
- Playwright smoke test: `tests/e2e/smoke.spec.ts`
- Covers single-user room chat and two-user realtime room exchange
- Install browser binaries once:
  ```bash
  pnpm exec playwright install --with-deps
  ```
- Default `pnpm test:e2e` behavior starts docker + migrations + API + web using `playwright.config.ts`.
- To run against an already-running environment:
  ```bash
  E2E_BASE_URL=http://localhost:5173 pnpm test:e2e
  ```

## Repo Layout
- `apps/api`: Fastify API + Prisma + websocket + auth/masks/friends/dm/servers/rooms
- `apps/web`: Vite React client
- `packages/shared`: Zod schemas and shared types
- `tests/e2e`: Playwright smoke tests
