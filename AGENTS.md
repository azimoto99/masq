# AGENTS.md - Masq Monorepo Guide

## Structure
- `apps/api`: Fastify API, auth, mask/friends/DM/server/room/RTC routes, websocket, Prisma schema and migrations
- `apps/web`: React + Vite UI with auth, home, masks, friends, DMs, servers, room chat, and RTC panel
- `packages/shared`: shared zod schemas and exported TypeScript types
- `docker-compose.yml`: Postgres + Redis for local dev

## Commands
Run from repo root:
- `pnpm install`
- `pnpm dev` (starts docker, API, web)
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm prisma:migrate`

## API Conventions
- Validate request and response contracts with schemas from `@masq/shared`.
- Use JWT auth in httpOnly cookie (`AUTH_COOKIE_NAME`) with argon2 password hashing.
- API uses centralized error handling, request rate limiting, and structured pino logs.
- Never authorize room/chat actions by user identity directly. Use `maskId` ownership checks.
- Mask rules:
  - Max `3` masks per user.
  - Delete only if mask is not in an active room.
- Moderation rules:
  - Verify actor mask ownership and `HOST` role.
  - Only `MEMBER` masks can be muted/exiled.
- Realtime chat (`/ws`) rules:
  - Require authenticated socket handshake via JWT cookie.
  - Validate `JOIN_ROOM` / `SEND_MESSAGE` payloads with zod contracts.
  - Enforce mask ownership and room membership before join/send.
  - Persist messages in Postgres and broadcast mask-only identity fields.
  - Apply per-socket rate limiting to `SEND_MESSAGE`.
  - Sanitize message bodies server-side before persistence/broadcast.
- RTC (`/rtc/*`) rules:
  - Require `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in API env.
  - Validate payloads with shared zod contracts.
  - Enforce context auth before token issuance:
    - `SERVER_CHANNEL`: membership + active channel identity mask.
    - `DM_THREAD`: DM participant + friendship.
    - `EPHEMERAL_ROOM`: room membership + room not expired.
  - Mute/end permissions:
    - Server: `OWNER`/`ADMIN` only.
    - Ephemeral room: `HOST` only.
    - DM end: either participant.
  - Keep mask identity in LiveKit metadata only; never expose global identity in UI.

## Prisma Conventions
- Update `apps/api/prisma/schema.prisma` first.
- Create/apply migrations with `pnpm prisma:migrate`.
- Keep migration SQL deterministic and review FK statements.

## Frontend Conventions
- Use `apps/web/src/lib/api.ts` for API calls; include credentials for cookie auth.
- Login/register pages live in `apps/web/src/pages`.
- Home navigation is in `apps/web/src/pages/HomePage.tsx`.
- Mask selection is handled in `apps/web/src/pages/MasksPage.tsx`.
- Friends + DM UI is in `apps/web/src/pages/FriendsPage.tsx` and `apps/web/src/pages/DmPage.tsx`.
- Servers/channels/roles UI is in `apps/web/src/pages/ServersPage.tsx`.
- Realtime room chat UI is in `apps/web/src/pages/RoomChatPage.tsx`.
- Shared LiveKit UI is in `apps/web/src/components/RTCPanel.tsx` and reused by server, DM, and room pages.

## Notes
- Web proxy expects API on `http://localhost:4000`.
- Websocket endpoint is `/ws` with event-based messaging.
- RTC control endpoints are `/rtc/session*`; media transport is LiveKit URL returned by API.
- Message body max length is `1000` characters (shared schema constant).
