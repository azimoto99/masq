import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyServerOptions,
  type preHandlerHookHandler,
} from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart, { type MultipartFile } from '@fastify/multipart';
import websocket from '@fastify/websocket';
import argon2 from 'argon2';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import {
  ALL_SERVER_PERMISSIONS,
  ALLOWED_IMAGE_CONTENT_TYPES,
  AuthResponseSchema,
  ClientSocketEventSchema,
  CreateServerRequestSchema,
  CreateServerResponseSchema,
  CreateMaskRequestSchema,
  CreateMaskResponseSchema,
  SetMaskAvatarParamsSchema,
  SetMaskAvatarResponseSchema,
  CreateFriendRequestRequestSchema,
  CreateFriendRequestResponseSchema,
  CreateServerChannelRequestSchema,
  CreateServerChannelResponseSchema,
  CreateServerInviteRequestSchema,
  CreateServerInviteResponseSchema,
  CreateServerRoleRequestSchema,
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  CreateRtcSessionRequestSchema,
  CreateRtcSessionResponseSchema,
  DEFAULT_SERVER_ROLE_ADMIN_NAME,
  DEFAULT_SERVER_ROLE_MEMBER_NAME,
  DeleteServerChannelResponseSchema,
  DmStartResponseSchema,
  DmThreadParamsSchema,
  DmThreadResponseSchema,
  DmThreadsResponseSchema,
  EndRtcSessionRequestSchema,
  EndRtcSessionResponseSchema,
  DEFAULT_MESSAGE_DECAY_MINUTES,
  DEFAULT_MUTE_MINUTES,
  DeleteMaskParamsSchema,
  DeleteMaskResponseSchema,
  ExileRoomMemberRequestSchema,
  FriendActionResponseSchema,
  FriendRequestParamsSchema,
  FriendRequestsResponseSchema,
  FriendsListResponseSchema,
  FriendUserParamsSchema,
  HealthResponseSchema,
  UploadImageRequestSchema,
  UploadImageResponseSchema,
  UploadParamsSchema,
  MAX_IMAGE_FILENAME_LENGTH,
  GetServerResponseSchema,
  JoinServerRequestSchema,
  JoinServerResponseSchema,
  JoinRoomParamsSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
  ChannelMaskParamsSchema,
  KickServerMemberResponseSchema,
  ListRoomsQuerySchema,
  ListRoomsResponseSchema,
  ListServerRolesResponseSchema,
  ListServersResponseSchema,
  LockRoomRequestSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  MAX_RECENT_MESSAGES,
  MAX_MASKS_PER_USER,
  MAX_ROOM_MESSAGE_LENGTH,
  MAX_MUTE_MINUTES,
  MeResponseSchema,
  MuteRtcParticipantRequestSchema,
  MuteRtcParticipantResponseSchema,
  ModerateRoomParamsSchema,
  ModerateRoomResponseSchema,
  MuteRoomMemberRequestSchema,
  RegisterRequestSchema,
  ServerChannelParamsSchema,
  ServerMemberParamsSchema,
  ServerRoleParamsSchema,
  ServerRoleResponseSchema,
  ServerParamsSchema,
  SetServerMaskRequestSchema,
  SetServerMaskResponseSchema,
  SetChannelMaskRequestSchema,
  SetChannelMaskResponseSchema,
  SetServerMemberRolesRequestSchema,
  SetServerMemberRolesResponseSchema,
  SetDmMaskRequestSchema,
  SetDmMaskResponseSchema,
  LeaveRtcSessionResponseSchema,
  RtcSessionParamsSchema,
  ServerSocketEventSchema,
  StartDmRequestSchema,
  UpdateServerSettingsRequestSchema,
  UpdateServerSettingsResponseSchema,
  UpdateServerRoleRequestSchema,
  type RtcContextType,
  type UploadContextType,
  type UploadKind,
  type Channel,
  type ChannelMessage,
  type DmMessage,
  type ImageAttachment,
  type MembershipRole,
  type RoomMessage,
  type ServerPermission,
  type ServerChannelMemberState,
  type Room,
  type RoomListItem,
  type RoomMemberState,
  type ServerSocketEvent,
  type SocketMaskIdentity,
} from '@masq/shared';
import type { Env } from './env.js';
import type {
  ChannelRecord,
  DmMessageRecord,
  DmParticipantRecord,
  DmThreadRecord,
  FriendRequestRecord,
  FriendUserRecord,
  IncomingFriendRequestRecord,
  MaskRecord,
  MasqRepository,
  MessageRecord,
  OutgoingFriendRequestRecord,
  RedisClient,
  ServerInviteRecord,
  ServerListItemRecord,
  ServerMemberRecord,
  ServerMessageRecord,
  ServerRoleRecord,
  ServerRecord,
  RoomMembershipRecord,
  RoomModerationRecord,
  RoomRecord,
  UserRecord,
  VoiceParticipantRecord,
  VoiceSessionRecord,
  UploadRecord,
} from './domain/repository.js';

interface BuildAppOptions {
  env: Env;
  repo: MasqRepository;
  redis: RedisClient;
  logger?: FastifyServerOptions['logger'];
}

interface SocketSession {
  socket: WebSocket;
  userId: string;
  joinedRoomId?: string;
  joinedMember?: RoomMemberState;
  joinedDmThreadId?: string;
  joinedDmMaskId?: string;
  joinedChannelId?: string;
  joinedChannelMember?: ServerChannelMemberState;
  roomMessageTimestamps: number[];
  dmMessageTimestamps: number[];
  channelMessageTimestamps: number[];
}

const DEFAULT_MASK_COLOR = '#8ff5ff';
const IMAGE_CONTENT_TYPES = new Set(ALLOWED_IMAGE_CONTENT_TYPES);
type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];
const IMAGE_CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MESSAGE_RATE_LIMIT_WINDOW_MS = 4000;
const MESSAGE_RATE_LIMIT_COUNT = 8;
const DM_MESSAGE_RATE_LIMIT_WINDOW_MS = 4000;
const DM_MESSAGE_RATE_LIMIT_COUNT = 10;
const CHANNEL_MESSAGE_RATE_LIMIT_WINDOW_MS = 4000;
const CHANNEL_MESSAGE_RATE_LIMIT_COUNT = 10;
const WS_OPEN_STATE = 1;
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 8;

const generateFriendCode = (): string => {
  const entropy = randomBytes(FRIEND_CODE_LENGTH);
  let friendCode = '';
  for (let index = 0; index < FRIEND_CODE_LENGTH; index += 1) {
    const entropyIndex = entropy[index] % FRIEND_CODE_ALPHABET.length;
    friendCode += FRIEND_CODE_ALPHABET[entropyIndex];
  }
  return friendCode;
};

const serializeUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  friendCode: user.friendCode,
  createdAt: user.createdAt.toISOString(),
});

const serializeMask = (mask: MaskRecord) => ({
  id: mask.id,
  userId: mask.userId,
  displayName: mask.displayName,
  color: mask.color,
  avatarSeed: mask.avatarSeed,
  avatarUploadId: mask.avatarUploadId ?? null,
  createdAt: mask.createdAt.toISOString(),
});

const serializeServer = (server: ServerRecord) => ({
  id: server.id,
  name: server.name,
  ownerUserId: server.ownerUserId,
  channelIdentityMode: server.channelIdentityMode,
  createdAt: server.createdAt.toISOString(),
});

const serializeServerInvite = (invite: ServerInviteRecord) => ({
  id: invite.id,
  serverId: invite.serverId,
  code: invite.code,
  createdAt: invite.createdAt.toISOString(),
  expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
  maxUses: invite.maxUses,
  uses: invite.uses,
});

const normalizeServerPermissions = (permissions: readonly ServerPermission[]) => {
  const deduped = new Set<ServerPermission>();
  for (const permission of permissions) {
    if ((ALL_SERVER_PERMISSIONS as readonly string[]).includes(permission)) {
      deduped.add(permission);
    }
  }
  return Array.from(deduped.values());
};

const getServerPermissionsForMember = (member: ServerMemberRecord): ServerPermission[] => {
  if (member.role === 'OWNER' || member.role === 'ADMIN') {
    return [...ALL_SERVER_PERMISSIONS];
  }

  return normalizeServerPermissions(member.permissions);
};

const hasServerPermission = (member: ServerMemberRecord, permission: ServerPermission): boolean => {
  return getServerPermissionsForMember(member).includes(permission);
};

const hasAnyServerPermission = (
  member: ServerMemberRecord,
  permissions: readonly ServerPermission[],
): boolean => {
  const effective = getServerPermissionsForMember(member);
  return permissions.some((permission) => effective.includes(permission));
};

const resolveEffectiveChannelMask = async (
  repo: MasqRepository,
  server: ServerRecord,
  channel: ChannelRecord,
  membership: ServerMemberRecord,
): Promise<MaskRecord> => {
  if (server.channelIdentityMode !== 'CHANNEL_MASK') {
    return membership.serverMask;
  }

  const identity = await repo.findChannelMemberIdentity(channel.id, membership.userId);
  if (!identity) {
    return membership.serverMask;
  }

  return identity.mask;
};

const serializeServerRole = (role: ServerRoleRecord) => ({
  id: role.id,
  serverId: role.serverId,
  name: role.name,
  permissions: normalizeServerPermissions(role.permissions),
  createdAt: role.createdAt.toISOString(),
});

const serializeFriendUser = (user: FriendUserRecord) => ({
  id: user.id,
  email: user.email,
  friendCode: user.friendCode,
  defaultMask: user.defaultMask,
});

const serializeRoom = (room: RoomRecord): Room => ({
  id: room.id,
  title: room.title,
  kind: room.kind,
  locked: room.locked,
  fogLevel: room.fogLevel,
  messageDecayMinutes: room.messageDecayMinutes,
  expiresAt: room.expiresAt ? room.expiresAt.toISOString() : null,
  createdAt: room.createdAt.toISOString(),
});

const serializeRoomListItem = (item: {
  room: RoomRecord;
  role: MembershipRole;
  joinedAt: Date;
}): RoomListItem => ({
  ...serializeRoom(item.room),
  role: item.role,
  joinedAt: item.joinedAt.toISOString(),
});

const serializeSocketMaskIdentity = (mask: MaskRecord): SocketMaskIdentity => ({
  maskId: mask.id,
  displayName: mask.displayName,
  avatarSeed: mask.avatarSeed,
  color: mask.color,
  avatarUploadId: mask.avatarUploadId ?? null,
});

const serializeImageAttachment = (upload: UploadRecord | null): ImageAttachment | null => {
  if (!upload) {
    return null;
  }

  if (!IMAGE_CONTENT_TYPES.has(upload.contentType as AllowedImageContentType)) {
    return null;
  }

  return {
    id: upload.id,
    fileName: upload.fileName,
    contentType: upload.contentType as AllowedImageContentType,
    sizeBytes: upload.sizeBytes,
  };
};

const serializeUploadedImage = (upload: UploadRecord) => ({
  id: upload.id,
  ownerUserId: upload.ownerUserId,
  kind: upload.kind,
  contextType: upload.contextType,
  contextId: upload.contextId,
  fileName: upload.fileName,
  contentType: upload.contentType,
  sizeBytes: upload.sizeBytes,
  createdAt: upload.createdAt.toISOString(),
});

const serializeServerMember = (member: ServerMemberRecord) => ({
  serverId: member.serverId,
  userId: member.userId,
  role: member.role,
  roleIds: member.roleIds,
  permissions: getServerPermissionsForMember(member),
  joinedAt: member.joinedAt.toISOString(),
  serverMask: {
    id: member.serverMask.id,
    displayName: member.serverMask.displayName,
    color: member.serverMask.color,
    avatarSeed: member.serverMask.avatarSeed,
    avatarUploadId: member.serverMask.avatarUploadId ?? null,
  },
});

const serializeServerListItem = (item: ServerListItemRecord) => ({
  server: serializeServer(item.server),
  role: item.role,
  joinedAt: item.joinedAt.toISOString(),
  serverMask: {
    id: item.serverMask.id,
    displayName: item.serverMask.displayName,
    color: item.serverMask.color,
    avatarSeed: item.serverMask.avatarSeed,
    avatarUploadId: item.serverMask.avatarUploadId ?? null,
  },
});

const serializeChannel = (channel: ChannelRecord): Channel => ({
  id: channel.id,
  serverId: channel.serverId,
  name: channel.name,
  type: channel.type,
  createdAt: channel.createdAt.toISOString(),
});

const serializeServerChannelMember = (
  member: ServerMemberRecord,
  mask: MaskRecord = member.serverMask,
): ServerChannelMemberState => ({
  userId: member.userId,
  role: member.role,
  mask: serializeSocketMaskIdentity(mask),
});

const serializeRoomMember = (membership: RoomMembershipRecord): RoomMemberState => ({
  ...serializeSocketMaskIdentity(membership.mask),
  role: membership.role,
});

const serializeRealtimeMessage = (message: MessageRecord): RoomMessage => ({
  id: message.id,
  roomId: message.roomId,
  body: message.body,
  image: serializeImageAttachment(message.imageUpload),
  createdAt: message.createdAt.toISOString(),
  mask: serializeSocketMaskIdentity(message.mask),
});

const serializeDmThread = (thread: DmThreadRecord) => ({
  id: thread.id,
  userAId: thread.userAId,
  userBId: thread.userBId,
  createdAt: thread.createdAt.toISOString(),
});

const serializeDmParticipant = (participant: DmParticipantRecord) => ({
  userId: participant.userId,
  mask: serializeSocketMaskIdentity(participant.activeMask),
});

const serializeDmMessage = (message: DmMessageRecord): DmMessage => ({
  id: message.id,
  threadId: message.threadId,
  body: message.body,
  image: serializeImageAttachment(message.imageUpload),
  createdAt: message.createdAt.toISOString(),
  mask: serializeSocketMaskIdentity(message.mask),
});

const serializeServerMessage = (message: ServerMessageRecord): ChannelMessage => ({
  id: message.id,
  channelId: message.channelId,
  body: message.body,
  image: serializeImageAttachment(message.imageUpload),
  createdAt: message.createdAt.toISOString(),
  mask: serializeSocketMaskIdentity(message.mask),
});

const serializeVoiceSession = (session: VoiceSessionRecord) => ({
  id: session.id,
  contextType: session.contextType,
  contextId: session.contextId,
  livekitRoomName: session.livekitRoomName,
  createdAt: session.createdAt.toISOString(),
  endedAt: session.endedAt ? session.endedAt.toISOString() : null,
});

const serializeVoiceParticipant = (participant: VoiceParticipantRecord) => ({
  id: participant.id,
  voiceSessionId: participant.voiceSessionId,
  userId: participant.userId,
  maskId: participant.maskId,
  joinedAt: participant.joinedAt.toISOString(),
  leftAt: participant.leftAt ? participant.leftAt.toISOString() : null,
  isServerMuted: participant.isServerMuted,
  mask: {
    id: participant.mask.id,
    displayName: participant.mask.displayName,
    color: participant.mask.color,
    avatarSeed: participant.mask.avatarSeed,
  },
});

const serializeModeration = (moderation: RoomModerationRecord) => ({
  id: moderation.id,
  roomId: moderation.roomId,
  targetMaskId: moderation.targetMaskId,
  actionType: moderation.actionType,
  expiresAt: moderation.expiresAt ? moderation.expiresAt.toISOString() : null,
  createdAt: moderation.createdAt.toISOString(),
  actorMaskId: moderation.actorMaskId,
});

const serializeFriendRequest = (request: FriendRequestRecord) => ({
  id: request.id,
  fromUserId: request.fromUserId,
  toUserId: request.toUserId,
  status: request.status,
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});

const serializeIncomingFriendRequest = (item: IncomingFriendRequestRecord) => ({
  request: serializeFriendRequest(item.request),
  fromUser: serializeFriendUser(item.fromUser),
});

const serializeOutgoingFriendRequest = (item: OutgoingFriendRequestRecord) => ({
  request: serializeFriendRequest(item.request),
  toUser: serializeFriendUser(item.toUser),
});

const parseOrReply = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
  reply: FastifyReply,
): z.infer<TSchema> | null => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    reply.code(400).send({
      message: 'Validation failed',
      issues: parsed.error.flatten(),
    });
    return null;
  }

  return parsed.data;
};

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const sanitizeMessageBody = (body: string): string => {
  const normalized = body.normalize('NFKC');
  const withoutTags = normalized.replace(/<[^>]*>/g, ' ');
  const withoutInvisible = withoutTags.replace(/[\u200B-\u200F\uFEFF]/g, '');
  const withoutControlChars = Array.from(withoutInvisible)
    .map((character) => {
      const code = character.charCodeAt(0);
      if ((code >= 0 && code <= 31) || code === 127) {
        return ' ';
      }
      return character;
    })
    .join('');
  const collapsedWhitespace = withoutControlChars.replace(/\s+/g, ' ').trim();
  const escaped = escapeHtml(collapsedWhitespace);
  return escaped.slice(0, MAX_ROOM_MESSAGE_LENGTH);
};

const sanitizeImageFileName = (value: string): string => {
  const safe = path
    .basename(value)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, MAX_IMAGE_FILENAME_LENGTH)
    .trim();

  if (!safe) {
    return 'image';
  }

  return safe;
};

const getMultipartFieldString = (part: MultipartFile, fieldName: string): string | undefined => {
  const field = part.fields[fieldName];
  if (!field || typeof field !== 'object' || !('value' in field)) {
    return undefined;
  }

  const value = (field as { value?: unknown }).value;
  if (typeof value !== 'string') {
    return undefined;
  }

  return value;
};

const isRoomExpired = (room: RoomRecord, now: Date): boolean => {
  if (!room.expiresAt) {
    return false;
  }

  return room.expiresAt.getTime() <= now.getTime();
};

const orderUserPair = (userAId: string, userBId: string) => {
  if (userAId <= userBId) {
    return { userAId, userBId };
  }

  return { userAId: userBId, userBId: userAId };
};

export const buildApp = async ({ env, repo, redis, logger }: BuildAppOptions): Promise<FastifyInstance> => {
  const defaultLogger: FastifyServerOptions['logger'] =
    env.NODE_ENV === 'test'
      ? false
      : {
          level: env.LOG_LEVEL,
          base: { service: 'masq-api' },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
        };

  const app = Fastify({
    logger: logger ?? defaultLogger,
    disableRequestLogging: true,
    trustProxy: env.TRUST_PROXY,
    genReqId: () => randomUUID(),
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, env.CORS_ALLOW_NO_ORIGIN);
        return;
      }

      callback(null, env.CORS_ORIGINS.includes(origin));
    },
    credentials: true,
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: env.AUTH_COOKIE_NAME,
      signed: false,
    },
  });

  await app.register(rateLimit, {
    global: true,
    max: env.API_RATE_LIMIT_MAX,
    timeWindow: env.API_RATE_LIMIT_WINDOW_MS,
    skipOnError: true,
    errorResponseBuilder: (_request, context) => ({
      message: 'Rate limit exceeded',
      statusCode: 429,
      error: 'Too Many Requests',
      retryAfterSeconds: Math.max(1, Math.ceil(context.ttl / 1000)),
    }),
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_IMAGE_UPLOAD_BYTES,
      files: 1,
      fields: 8,
    },
  });

  await app.register(websocket);

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      'request_completed',
    );
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      message: 'Route not found',
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400
        ? error.statusCode
        : 500;

    request.log.error(
      {
        err: error,
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode,
      },
      'request_failed',
    );

    if (reply.sent) {
      return;
    }

    const message = statusCode >= 500 ? 'Internal server error' : error.message;
    reply.code(statusCode).send({
      message,
      requestId: request.id,
    });
  });

  const authCookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  } as const;

  const authenticate: preHandlerHookHandler = async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ message: 'Unauthorized' });
    }
  };

  const sessions = new Map<WebSocket, SocketSession>();
  const roomSockets = new Map<string, Set<WebSocket>>();
  const dmSockets = new Map<string, Set<WebSocket>>();
  const channelSockets = new Map<string, Set<WebSocket>>();
  const roomExpiryTimers = new Map<string, NodeJS.Timeout>();
  const uploadRoot = path.resolve(process.cwd(), env.UPLOADS_DIR);
  await mkdir(uploadRoot, { recursive: true });
  app.log.info({ uploadRoot }, 'upload_storage_ready');
  const livekitUrl = env.LIVEKIT_URL ?? null;
  const livekitApiKey = env.LIVEKIT_API_KEY ?? null;
  const livekitApiSecret = env.LIVEKIT_API_SECRET ?? null;
  const livekitConfigured = Boolean(livekitUrl && livekitApiKey && livekitApiSecret);
  const roomServiceClient = livekitConfigured
    ? new RoomServiceClient(livekitUrl as string, livekitApiKey as string, livekitApiSecret as string)
    : null;

  type AuthorizedRtcContext =
    | {
        contextType: 'SERVER_CHANNEL';
        contextId: string;
        channel: ChannelRecord;
        server: ServerRecord;
        member: ServerMemberRecord;
        mask: MaskRecord;
      }
    | {
        contextType: 'DM_THREAD';
        contextId: string;
        thread: DmThreadRecord;
        participant: DmParticipantRecord;
        mask: MaskRecord;
      }
    | {
        contextType: 'EPHEMERAL_ROOM';
        contextId: string;
        room: RoomRecord;
        membership: RoomMembershipRecord;
        mask: MaskRecord;
      };

  interface RtcParticipantMetadata {
    userId: string;
    maskId: string;
    displayName: string;
    color: string;
    avatarSeed: string;
    contextType: RtcContextType;
    contextId: string;
  }

  const ensureLivekitAvailable = (reply: FastifyReply) => {
    if (!livekitConfigured || !roomServiceClient || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      reply.code(503).send({
        message: 'LiveKit is not configured on this environment',
      });
      return null;
    }

    return {
      roomServiceClient,
      livekitUrl,
      livekitApiKey,
      livekitApiSecret,
    };
  };

  const parseRtcParticipantMetadata = (rawMetadata: string | undefined): RtcParticipantMetadata | null => {
    if (!rawMetadata) {
      return null;
    }

    let parsedMetadata: unknown;
    try {
      parsedMetadata = JSON.parse(rawMetadata);
    } catch {
      return null;
    }

    const metadataSchema = z.object({
      userId: z.string().uuid(),
      maskId: z.string().uuid(),
      displayName: z.string().min(1).max(40),
      color: z.string().min(1).max(32),
      avatarSeed: z.string().min(1).max(80),
      contextType: z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']),
      contextId: z.string().uuid(),
    });

    const parsed = metadataSchema.safeParse(parsedMetadata);
    return parsed.success ? parsed.data : null;
  };

  const sendSocketEvent = (socket: WebSocket, event: ServerSocketEvent) => {
    if (socket.readyState !== WS_OPEN_STATE) {
      return;
    }

    const serialized = ServerSocketEventSchema.parse(event);
    socket.send(JSON.stringify(serialized));
  };

  const sendSocketError = (socket: WebSocket, message: string) => {
    sendSocketEvent(socket, {
      type: 'ERROR',
      data: { message },
    });
  };

  const getRoomSockets = (roomId: string): Set<WebSocket> => {
    let sockets = roomSockets.get(roomId);
    if (!sockets) {
      sockets = new Set<WebSocket>();
      roomSockets.set(roomId, sockets);
    }

    return sockets;
  };

  const getDmSockets = (threadId: string): Set<WebSocket> => {
    let sockets = dmSockets.get(threadId);
    if (!sockets) {
      sockets = new Set<WebSocket>();
      dmSockets.set(threadId, sockets);
    }

    return sockets;
  };

  const getChannelSockets = (channelId: string): Set<WebSocket> => {
    let sockets = channelSockets.get(channelId);
    if (!sockets) {
      sockets = new Set<WebSocket>();
      channelSockets.set(channelId, sockets);
    }

    return sockets;
  };

  const broadcastToRoom = (roomId: string, event: ServerSocketEvent, excluded?: WebSocket) => {
    const sockets = roomSockets.get(roomId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (excluded && socket === excluded) {
        continue;
      }

      sendSocketEvent(socket, event);
    }
  };

  const broadcastToDm = (threadId: string, event: ServerSocketEvent, excluded?: WebSocket) => {
    const sockets = dmSockets.get(threadId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (excluded && socket === excluded) {
        continue;
      }

      sendSocketEvent(socket, event);
    }
  };

  const broadcastToChannel = (channelId: string, event: ServerSocketEvent, excluded?: WebSocket) => {
    const sockets = channelSockets.get(channelId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (excluded && socket === excluded) {
        continue;
      }

      sendSocketEvent(socket, event);
    }
  };

  const isMaskPresentInRoom = (roomId: string, maskId: string, excludedSocket?: WebSocket) => {
    const sockets = roomSockets.get(roomId);
    if (!sockets) {
      return false;
    }

    for (const socket of sockets) {
      if (excludedSocket && socket === excludedSocket) {
        continue;
      }

      const session = sessions.get(socket);
      if (session?.joinedMember?.maskId === maskId) {
        return true;
      }
    }

    return false;
  };

  const getConnectedRoomMembers = (roomId: string): RoomMemberState[] => {
    const sockets = roomSockets.get(roomId);
    if (!sockets) {
      return [];
    }

    const members = new Map<string, RoomMemberState>();
    for (const socket of sockets) {
      const session = sessions.get(socket);
      if (!session?.joinedMember) {
        continue;
      }

      members.set(session.joinedMember.maskId, session.joinedMember);
    }

    return Array.from(members.values());
  };

  const isUserPresentInChannel = (channelId: string, userId: string, excludedSocket?: WebSocket) => {
    const sockets = channelSockets.get(channelId);
    if (!sockets) {
      return false;
    }

    for (const socket of sockets) {
      if (excludedSocket && socket === excludedSocket) {
        continue;
      }

      const session = sessions.get(socket);
      if (session?.joinedChannelMember?.userId === userId) {
        return true;
      }
    }

    return false;
  };

  const getConnectedChannelMembers = (channelId: string): ServerChannelMemberState[] => {
    const sockets = channelSockets.get(channelId);
    if (!sockets) {
      return [];
    }

    const members = new Map<string, ServerChannelMemberState>();
    for (const socket of sockets) {
      const session = sessions.get(socket);
      if (!session?.joinedChannelMember) {
        continue;
      }

      members.set(session.joinedChannelMember.userId, session.joinedChannelMember);
    }

    return Array.from(members.values());
  };

  const buildRoomStatePayload = async (roomId: string) => {
    const room = await repo.findRoomById(roomId);
    if (!room) {
      return null;
    }

    const messages = await repo.listRoomMessages(roomId);
    return {
      room: serializeRoom(room),
      members: getConnectedRoomMembers(roomId),
      recentMessages: messages.map(serializeRealtimeMessage),
      serverTime: new Date().toISOString(),
    };
  };

  const emitRoomState = async (roomId: string, targetSocket?: WebSocket) => {
    const statePayload = await buildRoomStatePayload(roomId);
    if (!statePayload) {
      return;
    }

    if (targetSocket) {
      sendSocketEvent(targetSocket, {
        type: 'ROOM_STATE',
        data: statePayload,
      });
      return;
    }

    broadcastToRoom(roomId, {
      type: 'ROOM_STATE',
      data: statePayload,
    });
  };

  const buildDmStatePayload = async (threadId: string) => {
    const thread = await repo.findDmThreadById(threadId);
    if (!thread) {
      return null;
    }

    const [participants, allMessages] = await Promise.all([
      repo.listDmParticipants(thread.id),
      repo.listDmMessages(thread.id),
    ]);
    const recentMessages = allMessages.slice(-MAX_RECENT_MESSAGES);

    return {
      threadId: thread.id,
      participants: participants.map(serializeDmParticipant),
      recentMessages: recentMessages.map(serializeDmMessage),
    };
  };

  const emitDmState = async (threadId: string, targetSocket?: WebSocket) => {
    const statePayload = await buildDmStatePayload(threadId);
    if (!statePayload) {
      return;
    }

    if (targetSocket) {
      sendSocketEvent(targetSocket, {
        type: 'DM_STATE',
        data: statePayload,
      });
      return;
    }

    broadcastToDm(threadId, {
      type: 'DM_STATE',
      data: statePayload,
    });
  };

  const buildChannelStatePayload = async (channelId: string) => {
    const channel = await repo.findChannelById(channelId);
    if (!channel) {
      return null;
    }

    const messages = await repo.listServerMessages(channelId);
    return {
      channel: serializeChannel(channel),
      members: getConnectedChannelMembers(channelId),
      recentMessages: messages.slice(-MAX_RECENT_MESSAGES).map(serializeServerMessage),
    };
  };

  const emitChannelState = async (channelId: string, targetSocket?: WebSocket) => {
    const statePayload = await buildChannelStatePayload(channelId);
    if (!statePayload) {
      return;
    }

    if (targetSocket) {
      sendSocketEvent(targetSocket, {
        type: 'CHANNEL_STATE',
        data: statePayload,
      });
      return;
    }

    broadcastToChannel(channelId, {
      type: 'CHANNEL_STATE',
      data: statePayload,
    });
  };

  const emitModerationEvent = (
    roomId: string,
    payload: {
      actionType: 'MUTE' | 'EXILE' | 'LOCK';
      actorMaskId: string;
      targetMaskId?: string;
      expiresAt?: string | null;
      locked?: boolean;
    },
  ) => {
    broadcastToRoom(roomId, {
      type: 'MODERATION_EVENT',
      data: {
        roomId,
        actionType: payload.actionType,
        actorMaskId: payload.actorMaskId,
        targetMaskId: payload.targetMaskId,
        expiresAt: payload.expiresAt,
        locked: payload.locked,
        createdAt: new Date().toISOString(),
      },
    });
  };

  const leaveRoom = (session: SocketSession, shouldBroadcast = true) => {
    const roomId = session.joinedRoomId;
    const member = session.joinedMember;
    if (!roomId || !member) {
      return;
    }

    const sockets = roomSockets.get(roomId);
    if (sockets) {
      sockets.delete(session.socket);
      if (sockets.size === 0) {
        roomSockets.delete(roomId);
      }
    }

    session.joinedRoomId = undefined;
    session.joinedMember = undefined;

    if (!shouldBroadcast) {
      return;
    }

    const stillPresent = isMaskPresentInRoom(roomId, member.maskId);
    if (!stillPresent) {
      broadcastToRoom(roomId, {
        type: 'MEMBER_LEFT',
        data: {
          roomId,
          member,
        },
      });
    }
  };

  const leaveDm = (session: SocketSession) => {
    const threadId = session.joinedDmThreadId;
    if (!threadId) {
      return;
    }

    const sockets = dmSockets.get(threadId);
    if (sockets) {
      sockets.delete(session.socket);
      if (sockets.size === 0) {
        dmSockets.delete(threadId);
      }
    }

    session.joinedDmThreadId = undefined;
    session.joinedDmMaskId = undefined;
  };

  const leaveChannel = (session: SocketSession, shouldBroadcast = true) => {
    const channelId = session.joinedChannelId;
    const member = session.joinedChannelMember;
    if (!channelId || !member) {
      return;
    }

    const sockets = channelSockets.get(channelId);
    if (sockets) {
      sockets.delete(session.socket);
      if (sockets.size === 0) {
        channelSockets.delete(channelId);
      }
    }

    session.joinedChannelId = undefined;
    session.joinedChannelMember = undefined;

    if (!shouldBroadcast) {
      return;
    }

    const stillPresent = isUserPresentInChannel(channelId, member.userId);
    if (!stillPresent) {
      broadcastToChannel(channelId, {
        type: 'MEMBER_LEFT',
        data: {
          channelId,
          member,
        },
      });
    }
  };

  const disconnectMaskFromRoom = (roomId: string, targetMaskId: string) => {
    const sockets = roomSockets.get(roomId);
    if (!sockets) {
      return;
    }

    for (const socket of Array.from(sockets)) {
      const session = sessions.get(socket);
      if (!session || session.joinedRoomId !== roomId || session.joinedMember?.maskId !== targetMaskId) {
        continue;
      }

      sendSocketError(socket, 'You were exiled from this room');
      leaveRoom(session, false);
    }
  };

  const disconnectChannel = (channelId: string, message: string) => {
    const sockets = channelSockets.get(channelId);
    if (!sockets) {
      return;
    }

    for (const socket of Array.from(sockets)) {
      const session = sessions.get(socket);
      if (!session || session.joinedChannelId !== channelId) {
        continue;
      }

      sendSocketError(socket, message);
      leaveChannel(session, false);
    }
  };

  const disconnectUserFromServerChannels = async (serverId: string, userId: string) => {
    for (const session of sessions.values()) {
      if (session.joinedChannelMember?.userId !== userId || !session.joinedChannelId) {
        continue;
      }

      const channel = await repo.findChannelById(session.joinedChannelId);
      if (!channel || channel.serverId !== serverId) {
        continue;
      }

      sendSocketError(session.socket, 'You were removed from this server');
      leaveChannel(session);
      await emitChannelState(channel.id);
    }
  };

  const expireRoom = (roomId: string) => {
    const existingTimer = roomExpiryTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      roomExpiryTimers.delete(roomId);
    }

    broadcastToRoom(roomId, {
      type: 'ROOM_EXPIRED',
      data: { roomId },
    });

    void terminateVoiceSessionForContext('EPHEMERAL_ROOM', roomId);

    const sockets = roomSockets.get(roomId);
    if (!sockets) {
      return;
    }

    for (const socket of Array.from(sockets)) {
      const session = sessions.get(socket);
      if (session) {
        leaveRoom(session, false);
      }
    }
  };

  const ensureRoomExpiryTimer = (room: RoomRecord) => {
    if (!room.expiresAt) {
      return;
    }

    if (roomExpiryTimers.has(room.id)) {
      return;
    }

    const msUntilExpiry = room.expiresAt.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      expireRoom(room.id);
      return;
    }

    const timer = setTimeout(() => {
      expireRoom(room.id);
    }, msUntilExpiry);

    roomExpiryTimers.set(room.id, timer);
  };

  const isRoomMessageAllowed = (session: SocketSession) => {
    const now = Date.now();
    session.roomMessageTimestamps = session.roomMessageTimestamps.filter(
      (timestamp) => now - timestamp <= MESSAGE_RATE_LIMIT_WINDOW_MS,
    );

    if (session.roomMessageTimestamps.length >= MESSAGE_RATE_LIMIT_COUNT) {
      return false;
    }

    session.roomMessageTimestamps.push(now);
    return true;
  };

  const isDmMessageAllowed = (session: SocketSession) => {
    const now = Date.now();
    session.dmMessageTimestamps = session.dmMessageTimestamps.filter(
      (timestamp) => now - timestamp <= DM_MESSAGE_RATE_LIMIT_WINDOW_MS,
    );

    if (session.dmMessageTimestamps.length >= DM_MESSAGE_RATE_LIMIT_COUNT) {
      return false;
    }

    session.dmMessageTimestamps.push(now);
    return true;
  };

  const isChannelMessageAllowed = (session: SocketSession) => {
    const now = Date.now();
    session.channelMessageTimestamps = session.channelMessageTimestamps.filter(
      (timestamp) => now - timestamp <= CHANNEL_MESSAGE_RATE_LIMIT_WINDOW_MS,
    );

    if (session.channelMessageTimestamps.length >= CHANNEL_MESSAGE_RATE_LIMIT_COUNT) {
      return false;
    }

    session.channelMessageTimestamps.push(now);
    return true;
  };

  const resolveUploadAbsolutePath = (storagePath: string): string | null => {
    const resolvedPath = path.resolve(uploadRoot, storagePath);
    const relativePath = path.relative(uploadRoot, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return null;
    }

    return resolvedPath;
  };

  const authorizeUploadContext = async (input: {
    userId: string;
    contextType: UploadContextType;
    contextId: string;
    allowExpiredRoom?: boolean;
  }) => {
    if (input.contextType === 'SERVER_CHANNEL') {
      const channel = await repo.findChannelById(input.contextId);
      if (!channel) {
        return { ok: false as const, status: 404, message: 'Channel not found' };
      }

      const member = await repo.findServerMember(channel.serverId, input.userId);
      if (!member) {
        return { ok: false as const, status: 403, message: 'You are not a member of this server' };
      }

      return { ok: true as const };
    }

    if (input.contextType === 'DM_THREAD') {
      const [thread, participant] = await Promise.all([
        repo.findDmThreadById(input.contextId),
        repo.findDmParticipant(input.contextId, input.userId),
      ]);
      if (!thread) {
        return { ok: false as const, status: 404, message: 'DM thread not found' };
      }

      if (!participant) {
        return { ok: false as const, status: 403, message: 'Not authorized for this DM thread' };
      }

      return { ok: true as const };
    }

    const room = await repo.findRoomById(input.contextId);
    if (!room) {
      return { ok: false as const, status: 404, message: 'Room not found' };
    }

    if (!input.allowExpiredRoom && isRoomExpired(room, new Date())) {
      return { ok: false as const, status: 410, message: 'Room is expired' };
    }

    const masks = await repo.listMasksByUser(input.userId);
    for (const mask of masks) {
      const membership = await repo.findRoomMembershipWithMask(room.id, mask.id);
      if (membership) {
        return { ok: true as const };
      }
    }

    return { ok: false as const, status: 403, message: 'Not authorized for this room' };
  };

  const validateMessageImageUpload = async (input: {
    userId: string;
    imageUploadId: string | undefined;
    contextType: UploadContextType;
    contextId: string;
  }) => {
    if (!input.imageUploadId) {
      return {
        ok: true as const,
        upload: null as UploadRecord | null,
      };
    }

    const upload = await repo.findUploadById(input.imageUploadId);
    if (!upload) {
      return { ok: false as const, message: 'Attachment not found' };
    }

    if (upload.ownerUserId !== input.userId) {
      return { ok: false as const, message: 'Attachment is not owned by the authenticated user' };
    }

    if (upload.kind !== 'MESSAGE_IMAGE') {
      return { ok: false as const, message: 'Attachment type is not valid for messages' };
    }

    if (upload.contextType !== input.contextType || upload.contextId !== input.contextId) {
      return { ok: false as const, message: 'Attachment does not belong to this chat context' };
    }

    return {
      ok: true as const,
      upload,
    };
  };

  const storeUploadFromMultipart = async (input: {
    file: MultipartFile;
    ownerUserId: string;
    kind: UploadKind;
    contextType: UploadContextType | null;
    contextId: string | null;
    storagePrefix: string;
  }): Promise<{ upload: UploadRecord } | { error: { status: number; message: string } }> => {
    const contentType = input.file.mimetype.toLowerCase();
    if (!IMAGE_CONTENT_TYPES.has(contentType as (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number])) {
      return {
        error: {
          status: 400,
          message: `Unsupported image content type. Allowed: ${ALLOWED_IMAGE_CONTENT_TYPES.join(', ')}`,
        },
      };
    }

    const buffer = await input.file.toBuffer();
    if (buffer.length === 0) {
      return {
        error: {
          status: 400,
          message: 'Image file is empty',
        },
      };
    }

    if (buffer.length > env.MAX_IMAGE_UPLOAD_BYTES) {
      return {
        error: {
          status: 413,
          message: `Image exceeds maximum size (${env.MAX_IMAGE_UPLOAD_BYTES} bytes)`,
        },
      };
    }

    const extension = IMAGE_CONTENT_TYPE_EXTENSION_MAP[contentType] ?? 'bin';
    const storedFileName = `${randomUUID()}.${extension}`;
    const relativeStoragePath = path.join(input.storagePrefix, storedFileName);
    const absoluteStoragePath = resolveUploadAbsolutePath(relativeStoragePath);
    if (!absoluteStoragePath) {
      return {
        error: {
          status: 500,
          message: 'Failed to resolve upload storage path',
        },
      };
    }

    await mkdir(path.dirname(absoluteStoragePath), { recursive: true });
    await writeFile(absoluteStoragePath, buffer, { flag: 'wx' });

    try {
      const upload = await repo.createUpload({
        ownerUserId: input.ownerUserId,
        kind: input.kind,
        contextType: input.contextType,
        contextId: input.contextId,
        fileName: sanitizeImageFileName(input.file.filename),
        contentType,
        sizeBytes: buffer.length,
        storagePath: relativeStoragePath,
      });
      return { upload };
    } catch (error) {
      await unlink(absoluteStoragePath).catch(() => undefined);
      throw error;
    }
  };

  const authorizeHostActor = async (userId: string, roomId: string, actorMaskId: string) => {
    const actorMask = await repo.findMaskByIdForUser(actorMaskId, userId);
    if (!actorMask) {
      return { ok: false as const, status: 403, message: 'Actor mask is not owned by the authenticated user' };
    }

    const room = await repo.findRoomById(roomId);
    if (!room) {
      return { ok: false as const, status: 404, message: 'Room not found' };
    }

    if (isRoomExpired(room, new Date())) {
      return { ok: false as const, status: 410, message: 'Room is expired' };
    }

    const actorMembership = await repo.findRoomMembershipWithMask(roomId, actorMaskId);
    if (!actorMembership || actorMembership.role !== 'HOST') {
      return { ok: false as const, status: 403, message: 'Only room hosts can perform this action' };
    }

    return {
      ok: true as const,
      actorMask,
      room,
      actorMembership,
    };
  };

  const buildFriendUserRecord = async (userId: string): Promise<FriendUserRecord | null> => {
    const user = await repo.findUserById(userId);
    if (!user) {
      return null;
    }

    let defaultMask: FriendUserRecord['defaultMask'] = null;
    if (user.defaultMaskId) {
      const mask = await repo.findMaskByIdForUser(user.defaultMaskId, user.id);
      if (mask) {
        defaultMask = {
          id: mask.id,
          displayName: mask.displayName,
          color: mask.color,
          avatarSeed: mask.avatarSeed,
          avatarUploadId: mask.avatarUploadId ?? null,
        };
      }
    }

    return {
      id: user.id,
      email: user.email,
      friendCode: user.friendCode,
      defaultMask,
    };
  };

  const getPeerUserIdForThread = (thread: DmThreadRecord, userId: string): string | null => {
    if (thread.userAId === userId) {
      return thread.userBId;
    }

    if (thread.userBId === userId) {
      return thread.userAId;
    }

    return null;
  };

  const buildDmThreadResponsePayload = async (thread: DmThreadRecord, userId: string) => {
    const peerUserId = getPeerUserIdForThread(thread, userId);
    if (!peerUserId) {
      return null;
    }

    const [peer, participants, messages] = await Promise.all([
      buildFriendUserRecord(peerUserId),
      repo.listDmParticipants(thread.id),
      repo.listDmMessages(thread.id),
    ]);
    if (!peer) {
      return null;
    }

    const meParticipant = participants.find((participant) => participant.userId === userId);
    if (!meParticipant) {
      return null;
    }

    return {
      thread: serializeDmThread(thread),
      peer: serializeFriendUser(peer),
      participants: participants.map(serializeDmParticipant),
      messages: messages.map(serializeDmMessage),
      activeMask: serializeSocketMaskIdentity(meParticipant.activeMask),
    };
  };

  const authorizeRtcContext = async (input: {
    userId: string;
    contextType: RtcContextType;
    contextId: string;
    maskId: string;
  }) => {
    const mask = await repo.findMaskByIdForUser(input.maskId, input.userId);
    if (!mask) {
      return {
        ok: false as const,
        status: 403,
        message: 'Mask does not belong to the authenticated user',
      };
    }

    if (input.contextType === 'SERVER_CHANNEL') {
      const channel = await repo.findChannelById(input.contextId);
      if (!channel) {
        return {
          ok: false as const,
          status: 404,
          message: 'Channel not found',
        };
      }

      const [server, member] = await Promise.all([
        repo.findServerById(channel.serverId),
        repo.findServerMember(channel.serverId, input.userId),
      ]);

      if (!server) {
        return {
          ok: false as const,
          status: 404,
          message: 'Server not found',
        };
      }

      if (!member) {
        return {
          ok: false as const,
          status: 403,
          message: 'You are not a member of this server',
        };
      }

      const effectiveMask = await resolveEffectiveChannelMask(repo, server, channel, member);
      if (effectiveMask.id !== mask.id) {
        return {
          ok: false as const,
          status: 403,
          message: 'Mask does not match your active channel identity',
        };
      }

      return {
        ok: true as const,
        value: {
          contextType: input.contextType,
          contextId: input.contextId,
          channel,
          server,
          member,
          mask,
        } satisfies AuthorizedRtcContext,
      };
    }

    if (input.contextType === 'DM_THREAD') {
      const thread = await repo.findDmThreadById(input.contextId);
      if (!thread) {
        return {
          ok: false as const,
          status: 404,
          message: 'DM thread not found',
        };
      }

      const participant = await repo.findDmParticipant(thread.id, input.userId);
      if (!participant) {
        return {
          ok: false as const,
          status: 403,
          message: 'Not authorized for this DM thread',
        };
      }

      const peerUserId = getPeerUserIdForThread(thread, input.userId);
      if (!peerUserId) {
        return {
          ok: false as const,
          status: 403,
          message: 'Not authorized for this DM thread',
        };
      }

      const friendship = await repo.findFriendshipBetweenUsers(input.userId, peerUserId);
      if (!friendship) {
        return {
          ok: false as const,
          status: 403,
          message: 'Only friends can join DM calls',
        };
      }

      return {
        ok: true as const,
        value: {
          contextType: input.contextType,
          contextId: input.contextId,
          thread,
          participant,
          mask,
        } satisfies AuthorizedRtcContext,
      };
    }

    const room = await repo.findRoomById(input.contextId);
    if (!room) {
      return {
        ok: false as const,
        status: 404,
        message: 'Room not found',
      };
    }

    if (isRoomExpired(room, new Date())) {
      return {
        ok: false as const,
        status: 410,
        message: 'Room is expired',
      };
    }

    const membership = await repo.findRoomMembershipWithMask(room.id, mask.id);
    if (!membership) {
      return {
        ok: false as const,
        status: 403,
        message: 'Mask is not a member of this room',
      };
    }

    return {
      ok: true as const,
      value: {
        contextType: input.contextType,
        contextId: input.contextId,
        room,
        membership,
        mask,
      } satisfies AuthorizedRtcContext,
    };
  };

  const buildRtcRoomName = (contextType: RtcContextType, contextId: string): string => {
    return `masq-${contextType.toLowerCase()}-${contextId}-${randomUUID().slice(0, 8)}`;
  };

  const deleteLivekitRoomIfConfigured = async (roomName: string) => {
    if (!roomServiceClient) {
      return;
    }

    try {
      await roomServiceClient.deleteRoom(roomName);
    } catch (error) {
      app.log.warn(
        {
          error,
          roomName,
        },
        'Failed to delete LiveKit room',
      );
    }
  };

  const terminateVoiceSession = async (session: VoiceSessionRecord, endedAt: Date = new Date()) => {
    if (session.endedAt) {
      return session;
    }

    const activeParticipants = await repo.listActiveVoiceParticipants(session.id);
    const users = new Set(activeParticipants.map((participant) => participant.userId));
    for (const userId of users) {
      await repo.markVoiceParticipantsLeft(session.id, userId, endedAt);
    }

    const endedSession = await repo.endVoiceSession(session.id, endedAt);
    await deleteLivekitRoomIfConfigured(session.livekitRoomName);
    return endedSession;
  };

  const terminateVoiceSessionForContext = async (contextType: RtcContextType, contextId: string) => {
    const session = await repo.findActiveVoiceSessionByContext(contextType, contextId);
    if (!session) {
      return null;
    }

    return terminateVoiceSession(session, new Date());
  };

  const createRtcToken = async (input: {
    livekitApiKey: string;
    livekitApiSecret: string;
    session: VoiceSessionRecord;
    userId: string;
    mask: MaskRecord;
    contextType: RtcContextType;
    contextId: string;
    canPublish: boolean;
  }) => {
    const identity = `${input.userId}:${input.mask.id}:${randomUUID().slice(0, 8)}`;
    const metadata = JSON.stringify({
      userId: input.userId,
      maskId: input.mask.id,
      displayName: input.mask.displayName,
      color: input.mask.color,
      avatarSeed: input.mask.avatarSeed,
      contextType: input.contextType,
      contextId: input.contextId,
    } satisfies RtcParticipantMetadata);

    const accessToken = new AccessToken(input.livekitApiKey, input.livekitApiSecret, {
      identity,
      name: input.mask.displayName,
      metadata,
    });

    accessToken.addGrant({
      roomJoin: true,
      room: input.session.livekitRoomName,
      canPublish: input.canPublish,
      canPublishData: true,
      canSubscribe: true,
    });

    return accessToken.toJwt();
  };

  app.get('/api/health', { config: { rateLimit: false } }, async (_, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await repo.pingDb();
      dbOk = true;
    } catch (error) {
      app.log.error({ error }, 'Database health check failed');
    }

    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch (error) {
      app.log.error({ error }, 'Redis health check failed');
    }

    const payload = HealthResponseSchema.parse({
      ok: dbOk && redisOk,
      db: dbOk,
      redis: redisOk,
      time: new Date().toISOString(),
    });

    reply.code(payload.ok ? 200 : 503);
    return payload;
  });

  app.post('/auth/register', async (request, reply) => {
    const body = parseOrReply(RegisterRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const normalizedEmail = body.email.toLowerCase();
    const existing = await repo.findUserByEmail(normalizedEmail);
    if (existing) {
      reply.code(409);
      return { message: 'Email already registered' };
    }

    const passwordHash = await argon2.hash(body.password);
    let user: UserRecord | null = null;
    for (let attempt = 0; attempt < 8 && !user; attempt += 1) {
      try {
        user = await repo.createUser({
          email: normalizedEmail,
          friendCode: generateFriendCode(),
          passwordHash,
        });
      } catch (error) {
        const errorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (errorCode === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    if (!user) {
      const duplicateEmail = await repo.findUserByEmail(normalizedEmail);
      if (duplicateEmail) {
        reply.code(409);
        return { message: 'Email already registered' };
      }

      reply.code(500);
      return { message: 'Failed to generate a unique friend code' };
    }

    const token = await reply.jwtSign(
      {
        sub: user.id,
        email: user.email,
      },
      { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
    );

    reply.setCookie(env.AUTH_COOKIE_NAME, token, {
      ...authCookieOptions,
      maxAge: env.ACCESS_TOKEN_TTL_SECONDS,
    });

    reply.code(201);
    return AuthResponseSchema.parse({ user: serializeUser(user) });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = parseOrReply(LoginRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const normalizedEmail = body.email.toLowerCase();
    const user = await repo.findUserByEmail(normalizedEmail);
    if (!user) {
      reply.code(401);
      return { message: 'Invalid credentials' };
    }

    const passwordMatch = await argon2.verify(user.passwordHash, body.password);
    if (!passwordMatch) {
      reply.code(401);
      return { message: 'Invalid credentials' };
    }

    const token = await reply.jwtSign(
      {
        sub: user.id,
        email: user.email,
      },
      { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
    );

    reply.setCookie(env.AUTH_COOKIE_NAME, token, {
      ...authCookieOptions,
      maxAge: env.ACCESS_TOKEN_TTL_SECONDS,
    });

    return AuthResponseSchema.parse({ user: serializeUser(user) });
  });

  app.post('/auth/logout', { preHandler: [authenticate] }, async (_, reply) => {
    reply.clearCookie(env.AUTH_COOKIE_NAME, authCookieOptions);

    return LogoutResponseSchema.parse({ success: true });
  });

  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    const user = await repo.findUserById(userId);

    if (!user) {
      reply.clearCookie(env.AUTH_COOKIE_NAME, authCookieOptions);
      reply.code(401);
      return { message: 'Unauthorized' };
    }

    const masks = await repo.listMasksByUser(userId);
    return MeResponseSchema.parse({
      user: serializeUser(user),
      masks: masks.map(serializeMask),
    });
  });

  app.post('/uploads/image', { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.isMultipart()) {
      reply.code(400);
      return { message: 'Expected multipart/form-data request' };
    }

    const multipartFile = await request.file();
    if (!multipartFile) {
      reply.code(400);
      return { message: 'Image file is required' };
    }

    const payload = parseOrReply(
      UploadImageRequestSchema,
      {
        contextType: getMultipartFieldString(multipartFile, 'contextType'),
        contextId: getMultipartFieldString(multipartFile, 'contextId'),
      },
      reply,
    );
    if (!payload) {
      return;
    }

    const contextAuthorization = await authorizeUploadContext({
      userId: request.user.sub,
      contextType: payload.contextType,
      contextId: payload.contextId,
    });
    if (!contextAuthorization.ok) {
      reply.code(contextAuthorization.status);
      return { message: contextAuthorization.message };
    }

    const stored = await storeUploadFromMultipart({
      file: multipartFile,
      ownerUserId: request.user.sub,
      kind: 'MESSAGE_IMAGE',
      contextType: payload.contextType,
      contextId: payload.contextId,
      storagePrefix: path.join('message-image', payload.contextType.toLowerCase(), payload.contextId),
    });
    if ('error' in stored) {
      reply.code(stored.error.status);
      return { message: stored.error.message };
    }

    reply.code(201);
    return UploadImageResponseSchema.parse({
      upload: serializeUploadedImage(stored.upload),
    });
  });

  app.get('/uploads/:uploadId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(UploadParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const upload = await repo.findUploadById(params.uploadId);
    if (!upload) {
      reply.code(404);
      return { message: 'Upload not found' };
    }

    if (upload.kind === 'MESSAGE_IMAGE') {
      if (!upload.contextType || !upload.contextId) {
        reply.code(403);
        return { message: 'Upload is not available for this context' };
      }

      const contextAuthorization = await authorizeUploadContext({
        userId: request.user.sub,
        contextType: upload.contextType,
        contextId: upload.contextId,
        allowExpiredRoom: true,
      });
      if (!contextAuthorization.ok) {
        reply.code(contextAuthorization.status);
        return { message: contextAuthorization.message };
      }
    }

    const absolutePath = resolveUploadAbsolutePath(upload.storagePath);
    if (!absolutePath) {
      reply.code(404);
      return { message: 'Upload file not found' };
    }

    try {
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) {
        reply.code(404);
        return { message: 'Upload file not found' };
      }
    } catch {
      reply.code(404);
      return { message: 'Upload file not found' };
    }

    reply.header('Content-Type', upload.contentType);
    reply.header('Content-Length', String(upload.sizeBytes));
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.send(createReadStream(absolutePath));
  });

  app.post('/friends/request', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(CreateFriendRequestRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const fromUserId = request.user.sub;
    const normalizedFriendCode = body.friendCode ? body.friendCode.trim().toUpperCase() : null;
    const targetUser = body.toUserId
      ? await repo.findUserById(body.toUserId)
      : await repo.findUserByFriendCode(normalizedFriendCode ?? '');

    if (!targetUser) {
      reply.code(404);
      return { message: 'Target user not found' };
    }

    if (targetUser.id === fromUserId) {
      reply.code(400);
      return { message: 'You cannot send a friend request to yourself' };
    }

    const existingFriendship = await repo.findFriendshipBetweenUsers(fromUserId, targetUser.id);
    if (existingFriendship) {
      reply.code(409);
      return { message: 'Already friends' };
    }

    const existingPairRequest = await repo.findFriendRequestBetweenUsers(fromUserId, targetUser.id);
    if (existingPairRequest?.status === 'PENDING') {
      if (existingPairRequest.fromUserId === fromUserId) {
        reply.code(409);
        return { message: 'Friend request already pending' };
      }

      reply.code(409);
      return { message: 'You already have an incoming friend request from this user' };
    }

    const friendRequest = await repo.upsertFriendRequest({
      fromUserId,
      toUserId: targetUser.id,
      status: 'PENDING',
    });

    reply.code(201);
    return CreateFriendRequestResponseSchema.parse({
      request: serializeFriendRequest(friendRequest),
    });
  });

  app.post('/friends/request/:id/accept', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(FriendRequestParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const friendRequest = await repo.findFriendRequestById(params.id);
    if (!friendRequest) {
      reply.code(404);
      return { message: 'Friend request not found' };
    }

    if (friendRequest.toUserId !== userId) {
      reply.code(403);
      return { message: 'You cannot accept this request' };
    }

    if (friendRequest.status !== 'PENDING') {
      reply.code(409);
      return { message: 'Friend request is no longer pending' };
    }

    await repo.createFriendship(friendRequest.fromUserId, friendRequest.toUserId);
    await repo.updateFriendRequestStatus(friendRequest.id, 'ACCEPTED');

    return FriendActionResponseSchema.parse({ success: true });
  });

  app.post('/friends/request/:id/decline', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(FriendRequestParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const friendRequest = await repo.findFriendRequestById(params.id);
    if (!friendRequest) {
      reply.code(404);
      return { message: 'Friend request not found' };
    }

    if (friendRequest.toUserId !== userId) {
      reply.code(403);
      return { message: 'You cannot decline this request' };
    }

    if (friendRequest.status !== 'PENDING') {
      reply.code(409);
      return { message: 'Friend request is no longer pending' };
    }

    await repo.updateFriendRequestStatus(friendRequest.id, 'DECLINED');
    return FriendActionResponseSchema.parse({ success: true });
  });

  app.post('/friends/request/:id/cancel', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(FriendRequestParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const friendRequest = await repo.findFriendRequestById(params.id);
    if (!friendRequest) {
      reply.code(404);
      return { message: 'Friend request not found' };
    }

    if (friendRequest.fromUserId !== userId) {
      reply.code(403);
      return { message: 'You cannot cancel this request' };
    }

    if (friendRequest.status !== 'PENDING') {
      reply.code(409);
      return { message: 'Friend request is no longer pending' };
    }

    await repo.updateFriendRequestStatus(friendRequest.id, 'CANCELED');
    return FriendActionResponseSchema.parse({ success: true });
  });

  app.delete('/friends/:friendUserId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(FriendUserParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    if (params.friendUserId === userId) {
      reply.code(400);
      return { message: 'You cannot unfriend yourself' };
    }

    const deleted = await repo.deleteFriendshipBetweenUsers(userId, params.friendUserId);
    if (!deleted) {
      reply.code(404);
      return { message: 'Friendship not found' };
    }

    return FriendActionResponseSchema.parse({ success: true });
  });

  app.get('/friends', { preHandler: [authenticate] }, async (request) => {
    const friends = await repo.listFriendsForUser(request.user.sub);
    return FriendsListResponseSchema.parse({
      friends: friends.map(serializeFriendUser),
    });
  });

  app.get('/friends/requests', { preHandler: [authenticate] }, async (request) => {
    const [incoming, outgoing] = await Promise.all([
      repo.listIncomingFriendRequests(request.user.sub),
      repo.listOutgoingFriendRequests(request.user.sub),
    ]);

    return FriendRequestsResponseSchema.parse({
      incoming: incoming.map(serializeIncomingFriendRequest),
      outgoing: outgoing.map(serializeOutgoingFriendRequest),
    });
  });

  app.post('/dm/start', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(StartDmRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    if (body.friendUserId === userId) {
      reply.code(400);
      return { message: 'You cannot start a DM with yourself' };
    }

    const mask = await repo.findMaskByIdForUser(body.initialMaskId, userId);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const [friendUser, friendship] = await Promise.all([
      repo.findUserById(body.friendUserId),
      repo.findFriendshipBetweenUsers(userId, body.friendUserId),
    ]);

    if (!friendUser) {
      reply.code(404);
      return { message: 'Friend user not found' };
    }

    if (!friendship) {
      reply.code(403);
      return { message: 'Only friends can start direct messages' };
    }

    let friendMaskId: string | null = null;
    if (friendUser.defaultMaskId) {
      const defaultMask = await repo.findMaskByIdForUser(friendUser.defaultMaskId, friendUser.id);
      friendMaskId = defaultMask?.id ?? null;
    }

    if (!friendMaskId) {
      const friendMasks = await repo.listMasksByUser(friendUser.id);
      friendMaskId = friendMasks[0]?.id ?? null;
    }

    if (!friendMaskId) {
      reply.code(409);
      return { message: 'Friend does not have a mask to join DM' };
    }

    const pair = orderUserPair(userId, friendUser.id);
    let thread = await repo.findDmThreadBetweenUsers(pair.userAId, pair.userBId);
    const created = !thread;
    if (!thread) {
      thread = await repo.createDmThread(pair.userAId, pair.userBId);
    }

    await repo.upsertDmParticipant({
      threadId: thread.id,
      userId,
      activeMaskId: mask.id,
    });

    const existingPeerParticipant = await repo.findDmParticipant(thread.id, friendUser.id);
    if (!existingPeerParticipant) {
      await repo.upsertDmParticipant({
        threadId: thread.id,
        userId: friendUser.id,
        activeMaskId: friendMaskId,
      });
    }

    const state = await buildDmStatePayload(thread.id);
    if (!state) {
      reply.code(500);
      return { message: 'Could not build DM state' };
    }

    if (created) {
      reply.code(201);
    }

    return DmStartResponseSchema.parse({
      thread: serializeDmThread(thread),
      participants: state.participants,
      recentMessages: state.recentMessages,
    });
  });

  app.get('/dm/threads', { preHandler: [authenticate] }, async (request) => {
    const userId = request.user.sub;
    const threads = await repo.listDmThreadsForUser(userId);

    const mapped = await Promise.all(
      threads.map(async (thread) => {
        const peerUserId = getPeerUserIdForThread(thread, userId);
        if (!peerUserId) {
          return null;
        }

        const [peer, meParticipant, messages] = await Promise.all([
          buildFriendUserRecord(peerUserId),
          repo.findDmParticipant(thread.id, userId),
          repo.listDmMessages(thread.id),
        ]);

        if (!peer || !meParticipant) {
          return null;
        }

        const lastMessage = messages[messages.length - 1] ?? null;
        return {
          thread: serializeDmThread(thread),
          peer: serializeFriendUser(peer),
          activeMask: serializeSocketMaskIdentity(meParticipant.activeMask),
          lastMessage: lastMessage ? serializeDmMessage(lastMessage) : null,
        };
      }),
    );

    return DmThreadsResponseSchema.parse({
      threads: mapped.filter((item): item is NonNullable<typeof item> => item !== null),
    });
  });

  app.get('/dm/:threadId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(DmThreadParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const thread = await repo.findDmThreadById(params.threadId);
    if (!thread) {
      reply.code(404);
      return { message: 'DM thread not found' };
    }

    const isParticipant = getPeerUserIdForThread(thread, userId) !== null;
    if (!isParticipant) {
      reply.code(403);
      return { message: 'Not authorized for this DM thread' };
    }

    const participant = await repo.findDmParticipant(thread.id, userId);
    if (!participant) {
      reply.code(403);
      return { message: 'Not authorized for this DM thread' };
    }

    const payload = await buildDmThreadResponsePayload(thread, userId);
    if (!payload) {
      reply.code(404);
      return { message: 'DM thread state unavailable' };
    }

    return DmThreadResponseSchema.parse(payload);
  });

  app.post('/dm/:threadId/mask', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(DmThreadParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(SetDmMaskRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const mask = await repo.findMaskByIdForUser(body.maskId, userId);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const thread = await repo.findDmThreadById(params.threadId);
    if (!thread) {
      reply.code(404);
      return { message: 'DM thread not found' };
    }

    const isParticipant = getPeerUserIdForThread(thread, userId) !== null;
    if (!isParticipant) {
      reply.code(403);
      return { message: 'Not authorized for this DM thread' };
    }

    const participant = await repo.findDmParticipant(thread.id, userId);
    if (!participant) {
      reply.code(403);
      return { message: 'Not authorized for this DM thread' };
    }

    const updated = await repo.upsertDmParticipant({
      threadId: thread.id,
      userId,
      activeMaskId: mask.id,
    });

    const sockets = dmSockets.get(thread.id);
    if (sockets) {
      for (const socket of sockets) {
        const socketSession = sessions.get(socket);
        if (!socketSession) {
          continue;
        }

        if (socketSession.userId === userId && socketSession.joinedDmThreadId === thread.id) {
          socketSession.joinedDmMaskId = mask.id;
        }
      }
    }

    await emitDmState(thread.id);

    return SetDmMaskResponseSchema.parse({
      success: true,
      activeMask: serializeSocketMaskIdentity(updated.activeMask),
    });
  });

  app.post('/rtc/session', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(CreateRtcSessionRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const livekit = ensureLivekitAvailable(reply);
    if (!livekit) {
      return;
    }

    const userId = request.user.sub;
    const authorizedContext = await authorizeRtcContext({
      userId,
      contextType: body.contextType,
      contextId: body.contextId,
      maskId: body.maskId,
    });
    if (!authorizedContext.ok) {
      reply.code(authorizedContext.status);
      return { message: authorizedContext.message };
    }

    let session = await repo.findActiveVoiceSessionByContext(body.contextType, body.contextId);
    if (!session) {
      session = await repo.createVoiceSession({
        contextType: body.contextType,
        contextId: body.contextId,
        livekitRoomName: buildRtcRoomName(body.contextType, body.contextId),
      });
    }

    const existingParticipants = await repo.listActiveVoiceParticipants(session.id);
    const existingMuted =
      existingParticipants.find(
        (participant) =>
          participant.userId === userId &&
          participant.maskId === authorizedContext.value.mask.id &&
          participant.isServerMuted,
      )?.isServerMuted ?? false;

    const joinedAt = new Date();
    await repo.markVoiceParticipantsLeft(session.id, userId, joinedAt);
    await repo.createVoiceParticipant({
      voiceSessionId: session.id,
      userId,
      maskId: authorizedContext.value.mask.id,
      isServerMuted: existingMuted,
    });

    const participants = await repo.listActiveVoiceParticipants(session.id);
    const me = participants.find(
      (participant) =>
        participant.userId === userId && participant.maskId === authorizedContext.value.mask.id,
    );
    const canPublish = !(me?.isServerMuted ?? false);

    const token = await createRtcToken({
      livekitApiKey: livekit.livekitApiKey,
      livekitApiSecret: livekit.livekitApiSecret,
      session,
      userId,
      mask: authorizedContext.value.mask,
      contextType: body.contextType,
      contextId: body.contextId,
      canPublish,
    });

    return CreateRtcSessionResponseSchema.parse({
      voiceSessionId: session.id,
      livekitRoomName: session.livekitRoomName,
      token,
      livekitUrl: livekit.livekitUrl,
      participants: participants.map(serializeVoiceParticipant),
    });
  });

  app.post('/rtc/session/:id/leave', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(RtcSessionParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const session = await repo.findVoiceSessionById(params.id);
    if (!session) {
      reply.code(404);
      return { message: 'Voice session not found' };
    }

    if (session.endedAt) {
      return LeaveRtcSessionResponseSchema.parse({ success: true });
    }

    const activeParticipants = await repo.listActiveVoiceParticipants(session.id);
    const isParticipant = activeParticipants.some((participant) => participant.userId === userId);
    if (!isParticipant) {
      reply.code(403);
      return { message: 'Not authorized for this voice session' };
    }

    await repo.markVoiceParticipantsLeft(session.id, userId, new Date());

    const remainingParticipants = await repo.listActiveVoiceParticipants(session.id);
    if (remainingParticipants.length === 0) {
      await terminateVoiceSession(session);
    }

    return LeaveRtcSessionResponseSchema.parse({ success: true });
  });

  app.post('/rtc/session/:id/mute', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(RtcSessionParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(MuteRtcParticipantRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const livekit = ensureLivekitAvailable(reply);
    if (!livekit) {
      return;
    }

    const userId = request.user.sub;
    const session = await repo.findVoiceSessionById(params.id);
    if (!session || session.endedAt) {
      reply.code(404);
      return { message: 'Voice session not found' };
    }

    const actorAuthorization = await authorizeRtcContext({
      userId,
      contextType: session.contextType,
      contextId: session.contextId,
      maskId: body.actorMaskId,
    });
    if (!actorAuthorization.ok) {
      reply.code(actorAuthorization.status);
      return { message: actorAuthorization.message };
    }

    if (session.contextType === 'DM_THREAD') {
      reply.code(400);
      return { message: 'DM voice calls do not support server mute' };
    }

    if (session.contextType === 'SERVER_CHANNEL') {
      if (actorAuthorization.value.contextType !== 'SERVER_CHANNEL') {
        reply.code(403);
        return { message: 'Actor is not authorized for this server channel' };
      }

      const actorRole = actorAuthorization.value.member.role;
      if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
        reply.code(403);
        return { message: 'Only server owners/admins can mute participants' };
      }
    }

    if (session.contextType === 'EPHEMERAL_ROOM') {
      if (actorAuthorization.value.contextType !== 'EPHEMERAL_ROOM') {
        reply.code(403);
        return { message: 'Actor is not authorized for this room' };
      }

      if (actorAuthorization.value.membership.role !== 'HOST') {
        reply.code(403);
        return { message: 'Only room hosts can mute participants' };
      }
    }

    if (body.actorMaskId === body.targetMaskId) {
      reply.code(400);
      return { message: 'Cannot mute your own mask' };
    }

    const activeParticipants = await repo.listActiveVoiceParticipants(session.id);
    const targetParticipant = activeParticipants.find((participant) => participant.maskId === body.targetMaskId);
    if (!targetParticipant) {
      reply.code(404);
      return { message: 'Target participant is not active in this voice session' };
    }

    try {
      const livekitParticipants = await livekit.roomServiceClient.listParticipants(session.livekitRoomName);
      const matchingIdentities = livekitParticipants
        .filter((participant) => {
          const metadata = parseRtcParticipantMetadata(participant.metadata);
          return metadata?.maskId === body.targetMaskId;
        })
        .map((participant) => participant.identity);

      for (const identity of matchingIdentities) {
        await livekit.roomServiceClient.updateParticipant(session.livekitRoomName, identity, {
          permission: {
            canPublish: false,
            canPublishData: true,
            canSubscribe: true,
          },
        });
      }
    } catch (error) {
      app.log.error(
        {
          error,
          sessionId: session.id,
          targetMaskId: body.targetMaskId,
        },
        'Failed to apply LiveKit mute policy',
      );
      reply.code(502);
      return { message: 'Failed to apply mute policy to media session' };
    }

    await repo.setVoiceParticipantsMuted(session.id, body.targetMaskId, true);
    const participants = await repo.listActiveVoiceParticipants(session.id);

    return MuteRtcParticipantResponseSchema.parse({
      success: true,
      participants: participants.map(serializeVoiceParticipant),
    });
  });

  app.post('/rtc/session/:id/end', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(RtcSessionParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(EndRtcSessionRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const session = await repo.findVoiceSessionById(params.id);
    if (!session || session.endedAt) {
      reply.code(404);
      return { message: 'Voice session not found' };
    }

    const actorAuthorization = await authorizeRtcContext({
      userId,
      contextType: session.contextType,
      contextId: session.contextId,
      maskId: body.actorMaskId,
    });
    if (!actorAuthorization.ok) {
      reply.code(actorAuthorization.status);
      return { message: actorAuthorization.message };
    }

    if (session.contextType === 'SERVER_CHANNEL') {
      if (actorAuthorization.value.contextType !== 'SERVER_CHANNEL') {
        reply.code(403);
        return { message: 'Actor is not authorized for this server channel' };
      }

      const actorRole = actorAuthorization.value.member.role;
      if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
        reply.code(403);
        return { message: 'Only server owners/admins can end calls' };
      }
    }

    if (session.contextType === 'EPHEMERAL_ROOM') {
      if (actorAuthorization.value.contextType !== 'EPHEMERAL_ROOM') {
        reply.code(403);
        return { message: 'Actor is not authorized for this room' };
      }

      if (actorAuthorization.value.membership.role !== 'HOST') {
        reply.code(403);
        return { message: 'Only room hosts can end calls' };
      }
    }

    const ended = await terminateVoiceSession(session);
    return EndRtcSessionResponseSchema.parse({
      success: true,
      session: serializeVoiceSession(ended),
    });
  });

  app.post('/servers', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(CreateServerRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const user = await repo.findUserById(userId);
    if (!user) {
      reply.code(401);
      return { message: 'Unauthorized' };
    }

    const normalizedName = body.name.trim();
    if (!normalizedName) {
      reply.code(400);
      return { message: 'Server name cannot be empty' };
    }

    let ownerMask = user.defaultMaskId ? await repo.findMaskByIdForUser(user.defaultMaskId, userId) : null;
    if (!ownerMask) {
      const masks = await repo.listMasksByUser(userId);
      ownerMask = masks[0] ?? null;
    }

    if (!ownerMask) {
      reply.code(400);
      return { message: 'Create a mask before creating a server' };
    }

    const server = await repo.createServer({
      name: normalizedName,
      ownerUserId: userId,
    });

    await repo.addServerMember({
      serverId: server.id,
      userId,
      role: 'OWNER',
      serverMaskId: ownerMask.id,
    });

    await repo.createServerRole({
      serverId: server.id,
      name: DEFAULT_SERVER_ROLE_ADMIN_NAME,
      permissions: [...ALL_SERVER_PERMISSIONS],
    });

    await repo.createServerRole({
      serverId: server.id,
      name: DEFAULT_SERVER_ROLE_MEMBER_NAME,
      permissions: [],
    });

    await repo.createServerChannel({
      serverId: server.id,
      name: 'general',
      type: 'TEXT',
    });

    reply.code(201);
    return CreateServerResponseSchema.parse({
      server: serializeServer(server),
    });
  });

  app.get('/servers', { preHandler: [authenticate] }, async (request) => {
    const servers = await repo.listServersForUser(request.user.sub);
    return ListServersResponseSchema.parse({
      servers: servers.map(serializeServerListItem),
    });
  });

  app.post('/servers/join', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(JoinServerRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const mask = await repo.findMaskByIdForUser(body.serverMaskId, userId);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const invite = await repo.findServerInviteByCode(body.inviteCode.toUpperCase());
    if (!invite) {
      reply.code(404);
      return { message: 'Invite code not found' };
    }

    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      reply.code(410);
      return { message: 'Invite has expired' };
    }

    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      reply.code(410);
      return { message: 'Invite has reached max uses' };
    }

    const existing = await repo.findServerMember(invite.serverId, userId);
    if (existing) {
      reply.code(409);
      return { message: 'Already a member of this server' };
    }

    await repo.addServerMember({
      serverId: invite.serverId,
      userId,
      role: 'MEMBER',
      serverMaskId: mask.id,
    });

    let defaultMemberRole = await repo.findServerRoleByName(
      invite.serverId,
      DEFAULT_SERVER_ROLE_MEMBER_NAME,
    );
    if (!defaultMemberRole) {
      try {
        defaultMemberRole = await repo.createServerRole({
          serverId: invite.serverId,
          name: DEFAULT_SERVER_ROLE_MEMBER_NAME,
          permissions: [],
        });
      } catch {
        defaultMemberRole = await repo.findServerRoleByName(
          invite.serverId,
          DEFAULT_SERVER_ROLE_MEMBER_NAME,
        );
      }
    }

    if (defaultMemberRole) {
      await repo.setServerMemberRoles(invite.serverId, userId, [defaultMemberRole.id]);
    }

    await repo.incrementServerInviteUses(invite.id);

    return JoinServerResponseSchema.parse({
      success: true,
      serverId: invite.serverId,
    });
  });

  app.get('/servers/:serverId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    const [channels, members] = await Promise.all([
      repo.listServerChannels(server.id),
      repo.listServerMembers(server.id),
    ]);

    return GetServerResponseSchema.parse({
      server: serializeServer(server),
      channels: channels.map(serializeChannel),
      members: members.map(serializeServerMember),
      myPermissions: getServerPermissionsForMember(membership),
    });
  });

  app.patch('/servers/:serverId/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(UpdateServerSettingsRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'ManageMembers')) {
      reply.code(403);
      return { message: 'Missing ManageMembers permission' };
    }

    const updatedServer = await repo.updateServerSettings(params.serverId, {
      channelIdentityMode: body.channelIdentityMode,
    });

    const channels = await repo.listServerChannels(params.serverId);
    for (const session of sessions.values()) {
      if (!session.joinedChannelId) {
        continue;
      }

      const joinedChannel = channels.find((channel) => channel.id === session.joinedChannelId);
      if (!joinedChannel) {
        continue;
      }

      const joinedMembership = await repo.findServerMember(params.serverId, session.userId);
      if (!joinedMembership) {
        continue;
      }

      const mask = await resolveEffectiveChannelMask(repo, updatedServer, joinedChannel, joinedMembership);
      session.joinedChannelMember = serializeServerChannelMember(joinedMembership, mask);
      await emitChannelState(joinedChannel.id);
    }

    return UpdateServerSettingsResponseSchema.parse({
      success: true,
      server: serializeServer(updatedServer),
    });
  });

  app.get('/servers/:serverId/roles', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    const roles = await repo.listServerRoles(params.serverId);
    return ListServerRolesResponseSchema.parse({
      roles: roles.map(serializeServerRole),
      myPermissions: getServerPermissionsForMember(membership),
    });
  });

  app.post('/servers/:serverId/roles', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(CreateServerRoleRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'ManageMembers')) {
      reply.code(403);
      return { message: 'Missing ManageMembers permission' };
    }

    const normalizedName = body.name.trim();
    if (!normalizedName) {
      reply.code(400);
      return { message: 'Role name cannot be empty' };
    }

    try {
      const role = await repo.createServerRole({
        serverId: params.serverId,
        name: normalizedName,
        permissions: normalizeServerPermissions(body.permissions),
      });
      reply.code(201);
      return ServerRoleResponseSchema.parse({
        role: serializeServerRole(role),
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const message = error instanceof Error ? error.message : '';
      if (code === 'P2002' || /already exists/i.test(message)) {
        reply.code(409);
        return { message: 'Role name already exists in this server' };
      }
      throw error;
    }
  });

  app.patch('/servers/:serverId/roles/:roleId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerRoleParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(UpdateServerRoleRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const [server, membership, existingRole] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
      repo.findServerRoleById(params.serverId, params.roleId),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'ManageMembers')) {
      reply.code(403);
      return { message: 'Missing ManageMembers permission' };
    }

    if (!existingRole) {
      reply.code(404);
      return { message: 'Role not found' };
    }

    const updates: {
      name?: string;
      permissions?: ServerPermission[];
    } = {};

    if (body.name !== undefined) {
      const normalizedName = body.name.trim();
      if (!normalizedName) {
        reply.code(400);
        return { message: 'Role name cannot be empty' };
      }
      updates.name = normalizedName;
    }

    if (body.permissions !== undefined) {
      updates.permissions = normalizeServerPermissions(body.permissions);
    }

    try {
      const role = await repo.updateServerRole(params.serverId, params.roleId, updates);
      return ServerRoleResponseSchema.parse({
        role: serializeServerRole(role),
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const message = error instanceof Error ? error.message : '';
      if (code === 'P2002' || /already exists/i.test(message)) {
        reply.code(409);
        return { message: 'Role name already exists in this server' };
      }
      if (/not found/i.test(message)) {
        reply.code(404);
        return { message: 'Role not found' };
      }
      throw error;
    }
  });

  app.post('/servers/:serverId/members/:userId/roles', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerMemberParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(SetServerMemberRolesRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const [server, actorMembership, targetMembership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
      repo.findServerMember(params.serverId, params.userId),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!actorMembership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(actorMembership, 'ManageMembers')) {
      reply.code(403);
      return { message: 'Missing ManageMembers permission' };
    }

    if (!targetMembership) {
      reply.code(404);
      return { message: 'Member not found' };
    }

    if (targetMembership.role === 'OWNER') {
      reply.code(400);
      return { message: 'Owner roles are fixed and cannot be reassigned' };
    }

    const uniqueRoleIds = Array.from(new Set(body.roleIds));
    if (uniqueRoleIds.length > 0) {
      const roles = await repo.listServerRoles(params.serverId);
      const roleIdSet = new Set(roles.map((role) => role.id));
      const hasUnknown = uniqueRoleIds.some((roleId) => !roleIdSet.has(roleId));
      if (hasUnknown) {
        reply.code(400);
        return { message: 'One or more roles do not belong to this server' };
      }
    }

    const updated = await repo.setServerMemberRoles(params.serverId, params.userId, uniqueRoleIds);

    for (const socketSession of sessions.values()) {
      if (socketSession.userId !== params.userId || !socketSession.joinedChannelId) {
        continue;
      }

      const joinedChannel = await repo.findChannelById(socketSession.joinedChannelId);
      if (!joinedChannel || joinedChannel.serverId !== params.serverId) {
        continue;
      }

      socketSession.joinedChannelMember = serializeServerChannelMember(updated);
      await emitChannelState(joinedChannel.id);
    }

    return SetServerMemberRolesResponseSchema.parse({
      success: true,
      member: serializeServerMember(updated),
    });
  });

  app.post('/servers/:serverId/channels', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(CreateServerChannelRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'ManageChannels')) {
      reply.code(403);
      return { message: 'Missing ManageChannels permission' };
    }

    const normalizedName = body.name.trim();
    if (!normalizedName) {
      reply.code(400);
      return { message: 'Channel name cannot be empty' };
    }

    try {
      const channel = await repo.createServerChannel({
        serverId: params.serverId,
        name: normalizedName,
        type: 'TEXT',
      });

      reply.code(201);
      return CreateServerChannelResponseSchema.parse({
        channel: serializeChannel(channel),
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const message = error instanceof Error ? error.message : '';
      if (code === 'P2002' || /already exists/i.test(message)) {
        reply.code(409);
        return { message: 'Channel name already exists in this server' };
      }

      throw error;
    }
  });

  app.delete('/servers/:serverId/channels/:channelId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerChannelParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'ManageChannels')) {
      reply.code(403);
      return { message: 'Missing ManageChannels permission' };
    }

    const deleted = await repo.deleteServerChannel(params.serverId, params.channelId);
    if (!deleted) {
      reply.code(404);
      return { message: 'Channel not found' };
    }

    disconnectChannel(params.channelId, 'Channel was deleted by server owner');

    return DeleteServerChannelResponseSchema.parse({
      success: true,
    });
  });

  app.post('/servers/:serverId/invites', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(CreateServerInviteRequestSchema, request.body ?? {}, reply);
    if (!body) {
      return;
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!hasServerPermission(membership, 'CreateInvites')) {
      reply.code(403);
      return { message: 'Missing CreateInvites permission' };
    }

    const expiresAt = body.expiresMinutes
      ? new Date(Date.now() + body.expiresMinutes * 60 * 1000)
      : null;

    let createdInvite: ServerInviteRecord | null = null;
    for (let attempt = 0; attempt < 5 && !createdInvite; attempt += 1) {
      const code = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      try {
        createdInvite = await repo.createServerInvite({
          serverId: params.serverId,
          code,
          expiresAt,
          maxUses: body.maxUses ?? null,
        });
      } catch (error) {
        const errorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (errorCode === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    if (!createdInvite) {
      reply.code(500);
      return { message: 'Failed to generate unique invite code' };
    }

    reply.code(201);
    return CreateServerInviteResponseSchema.parse({
      invite: serializeServerInvite(createdInvite),
    });
  });

  app.post('/servers/:serverId/mask', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(SetServerMaskRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const mask = await repo.findMaskByIdForUser(body.serverMaskId, userId);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const membership = await repo.findServerMember(params.serverId, userId);
    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    const updated = await repo.updateServerMemberMask(params.serverId, userId, mask.id);
    const server = await repo.findServerById(params.serverId);

    for (const socketSession of sessions.values()) {
      if (!socketSession || socketSession.userId !== userId || !socketSession.joinedChannelId) {
        continue;
      }

      const joinedChannel = await repo.findChannelById(socketSession.joinedChannelId);
      if (!joinedChannel || joinedChannel.serverId !== params.serverId || !server) {
        continue;
      }

      const effectiveMask = await resolveEffectiveChannelMask(repo, server, joinedChannel, updated);
      socketSession.joinedChannelMember = serializeServerChannelMember(updated, effectiveMask);
      await emitChannelState(joinedChannel.id);
    }

    return SetServerMaskResponseSchema.parse({
      success: true,
      member: serializeServerMember(updated),
    });
  });

  app.post('/channels/:channelId/mask', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ChannelMaskParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(SetChannelMaskRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const [channel, mask] = await Promise.all([
      repo.findChannelById(params.channelId),
      repo.findMaskByIdForUser(body.maskId, userId),
    ]);

    if (!channel) {
      reply.code(404);
      return { message: 'Channel not found' };
    }

    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const [server, membership] = await Promise.all([
      repo.findServerById(channel.serverId),
      repo.findServerMember(channel.serverId, userId),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!membership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (server.channelIdentityMode !== 'CHANNEL_MASK') {
      reply.code(400);
      return { message: 'Channel mask selection is only available in CHANNEL_MASK mode' };
    }

    await repo.upsertChannelMemberIdentity(channel.id, userId, mask.id);

    for (const session of sessions.values()) {
      if (session.userId !== userId || session.joinedChannelId !== channel.id) {
        continue;
      }

      session.joinedChannelMember = serializeServerChannelMember(membership, mask);
      await emitChannelState(channel.id);
    }

    return SetChannelMaskResponseSchema.parse({
      success: true,
      mask: serializeSocketMaskIdentity(mask),
    });
  });

  app.delete('/servers/:serverId/members/:userId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ServerMemberParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const [server, actorMembership, targetMembership] = await Promise.all([
      repo.findServerById(params.serverId),
      repo.findServerMember(params.serverId, request.user.sub),
      repo.findServerMember(params.serverId, params.userId),
    ]);

    if (!server) {
      reply.code(404);
      return { message: 'Server not found' };
    }

    if (!actorMembership) {
      reply.code(403);
      return { message: 'You are not a member of this server' };
    }

    if (!targetMembership) {
      reply.code(404);
      return { message: 'Member not found' };
    }

    if (!hasAnyServerPermission(actorMembership, ['ManageMembers', 'ModerateChat'])) {
      reply.code(403);
      return { message: 'Missing ModerateChat or ManageMembers permission' };
    }

    if (params.userId === request.user.sub) {
      reply.code(400);
      return { message: 'You cannot kick yourself' };
    }

    if (targetMembership.role === 'OWNER') {
      reply.code(400);
      return { message: 'Cannot kick the server owner' };
    }

    const removed = await repo.removeServerMember(params.serverId, params.userId);
    if (!removed) {
      reply.code(404);
      return { message: 'Member not found' };
    }

    await disconnectUserFromServerChannels(params.serverId, params.userId);

    return KickServerMemberResponseSchema.parse({
      success: true,
    });
  });

  app.post('/masks', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(CreateMaskRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const userId = request.user.sub;
    const count = await repo.countMasksByUser(userId);
    if (count >= MAX_MASKS_PER_USER) {
      reply.code(400);
      return { message: `Mask limit reached (${MAX_MASKS_PER_USER})` };
    }

    const mask = await repo.createMask({
      userId,
      displayName: body.displayName,
      color: body.color ?? DEFAULT_MASK_COLOR,
      avatarSeed: body.avatarSeed ?? randomUUID(),
    });

    const user = await repo.findUserById(userId);
    if (user && !user.defaultMaskId) {
      await repo.updateUserDefaultMask(userId, mask.id);
    }

    reply.code(201);
    return CreateMaskResponseSchema.parse({ mask: serializeMask(mask) });
  });

  app.post('/masks/:maskId/avatar', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(SetMaskAvatarParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const mask = await repo.findMaskByIdForUser(params.maskId, request.user.sub);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    if (!request.isMultipart()) {
      reply.code(400);
      return { message: 'Expected multipart/form-data request' };
    }

    const multipartFile = await request.file();
    if (!multipartFile) {
      reply.code(400);
      return { message: 'Avatar image file is required' };
    }

    const stored = await storeUploadFromMultipart({
      file: multipartFile,
      ownerUserId: request.user.sub,
      kind: 'MASK_AVATAR',
      contextType: null,
      contextId: null,
      storagePrefix: path.join('mask-avatar', request.user.sub, mask.id),
    });
    if ('error' in stored) {
      reply.code(stored.error.status);
      return { message: stored.error.message };
    }

    let updatedMask: MaskRecord;
    try {
      updatedMask = await repo.setMaskAvatarUpload(mask.id, stored.upload.id);
    } catch (error) {
      const uploadedPath = resolveUploadAbsolutePath(stored.upload.storagePath);
      if (uploadedPath) {
        await unlink(uploadedPath).catch(() => undefined);
      }
      throw error;
    }

    if (mask.avatarUploadId && mask.avatarUploadId !== stored.upload.id) {
      const previousUpload = await repo.findUploadById(mask.avatarUploadId);
      if (previousUpload?.ownerUserId === request.user.sub && previousUpload.kind === 'MASK_AVATAR') {
        const previousPath = resolveUploadAbsolutePath(previousUpload.storagePath);
        if (previousPath) {
          await unlink(previousPath).catch(() => undefined);
        }
      }
    }

    return SetMaskAvatarResponseSchema.parse({
      success: true,
      mask: serializeMask(updatedMask),
    });
  });

  app.delete('/masks/:maskId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(DeleteMaskParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const userId = request.user.sub;
    const mask = await repo.findMaskByIdForUser(params.maskId, userId);
    if (!mask) {
      reply.code(404);
      return { message: 'Mask not found' };
    }

    const activeMembership = await repo.maskHasActiveRoomMembership(mask.id, new Date());
    if (activeMembership) {
      reply.code(409);
      return { message: 'Mask is in an active room and cannot be deleted' };
    }

    await repo.deleteMask(mask.id);

    const user = await repo.findUserById(userId);
    if (user?.defaultMaskId === mask.id) {
      const remainingMasks = await repo.listMasksByUser(userId);
      const nextDefaultMaskId = remainingMasks[0]?.id ?? null;
      await repo.updateUserDefaultMask(userId, nextDefaultMaskId);
    }

    return DeleteMaskResponseSchema.parse({ success: true });
  });

  app.get('/rooms', { preHandler: [authenticate] }, async (request, reply) => {
    const query = parseOrReply(ListRoomsQuerySchema, request.query, reply);
    if (!query) {
      return;
    }

    const mask = await repo.findMaskByIdForUser(query.maskId, request.user.sub);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const rooms = await repo.listRoomsForMask(query.maskId, new Date());
    return ListRoomsResponseSchema.parse({
      rooms: rooms.map(serializeRoomListItem),
    });
  });

  app.post('/rooms', { preHandler: [authenticate] }, async (request, reply) => {
    const body = parseOrReply(CreateRoomRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const mask = await repo.findMaskByIdForUser(body.maskId, request.user.sub);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
    } else if (body.kind === 'EPHEMERAL') {
      expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2);
    }

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      reply.code(400);
      return { message: 'Invalid expiresAt value' };
    }

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      reply.code(400);
      return { message: 'expiresAt must be in the future' };
    }

    const fogLevel = body.fogLevel ?? 0;
    const messageDecayMinutes = body.messageDecayMinutes ?? DEFAULT_MESSAGE_DECAY_MINUTES;

    const room = await repo.createRoom({
      title: body.title,
      kind: body.kind,
      locked: body.locked ?? false,
      fogLevel,
      messageDecayMinutes,
      expiresAt,
    });

    await repo.addRoomMembership({
      roomId: room.id,
      maskId: mask.id,
      role: 'HOST',
    });

    reply.code(201);
    return CreateRoomResponseSchema.parse({
      room: serializeRoom(room),
    });
  });

  app.post('/rooms/:roomId/join', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(JoinRoomParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(JoinRoomRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const mask = await repo.findMaskByIdForUser(body.maskId, request.user.sub);
    if (!mask) {
      reply.code(403);
      return { message: 'Mask does not belong to the authenticated user' };
    }

    const room = await repo.findRoomById(params.roomId);
    if (!room) {
      reply.code(404);
      return { message: 'Room not found' };
    }

    if (isRoomExpired(room, new Date())) {
      reply.code(410);
      return { message: 'Room is expired' };
    }

    const existingMembership = await repo.findRoomMembershipWithMask(room.id, mask.id);
    if (room.locked && !existingMembership) {
      reply.code(423);
      return { message: 'Room is locked' };
    }

    if (!existingMembership) {
      await repo.addRoomMembership({
        roomId: room.id,
        maskId: mask.id,
        role: 'MEMBER',
      });
    }

    return JoinRoomResponseSchema.parse({ success: true });
  });

  app.post('/rooms/:roomId/mute', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ModerateRoomParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(MuteRoomMemberRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const auth = await authorizeHostActor(request.user.sub, params.roomId, body.actorMaskId);
    if (!auth.ok) {
      reply.code(auth.status);
      return { message: auth.message };
    }

    if (body.targetMaskId === body.actorMaskId) {
      reply.code(400);
      return { message: 'Host cannot mute themselves' };
    }

    const targetMembership = await repo.findRoomMembershipWithMask(params.roomId, body.targetMaskId);
    if (!targetMembership) {
      reply.code(404);
      return { message: 'Target mask is not in this room' };
    }

    if (targetMembership.role !== 'MEMBER') {
      reply.code(400);
      return { message: 'Only member masks can be muted' };
    }

    const minutes = Math.max(1, Math.min(body.minutes ?? DEFAULT_MUTE_MINUTES, MAX_MUTE_MINUTES));
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    const moderation = await repo.createRoomModeration({
      roomId: params.roomId,
      targetMaskId: body.targetMaskId,
      actionType: 'MUTE',
      expiresAt,
      actorMaskId: body.actorMaskId,
    });

    emitModerationEvent(params.roomId, {
      actionType: 'MUTE',
      actorMaskId: body.actorMaskId,
      targetMaskId: body.targetMaskId,
      expiresAt: expiresAt.toISOString(),
    });

    await emitRoomState(params.roomId);

    return ModerateRoomResponseSchema.parse({
      success: true,
      moderation: serializeModeration(moderation),
    });
  });

  app.post('/rooms/:roomId/exile', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ModerateRoomParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(ExileRoomMemberRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const auth = await authorizeHostActor(request.user.sub, params.roomId, body.actorMaskId);
    if (!auth.ok) {
      reply.code(auth.status);
      return { message: auth.message };
    }

    if (body.actorMaskId === body.targetMaskId) {
      reply.code(400);
      return { message: 'Host cannot exile themselves' };
    }

    const targetMembership = await repo.findRoomMembershipWithMask(params.roomId, body.targetMaskId);
    if (!targetMembership) {
      reply.code(404);
      return { message: 'Target mask is not in this room' };
    }

    if (targetMembership.role !== 'MEMBER') {
      reply.code(400);
      return { message: 'Only member masks can be exiled' };
    }

    await repo.removeRoomMembership(params.roomId, body.targetMaskId);

    const moderation = await repo.createRoomModeration({
      roomId: params.roomId,
      targetMaskId: body.targetMaskId,
      actionType: 'EXILE',
      expiresAt: null,
      actorMaskId: body.actorMaskId,
    });

    disconnectMaskFromRoom(params.roomId, body.targetMaskId);

    emitModerationEvent(params.roomId, {
      actionType: 'EXILE',
      actorMaskId: body.actorMaskId,
      targetMaskId: body.targetMaskId,
    });

    await emitRoomState(params.roomId);

    return ModerateRoomResponseSchema.parse({
      success: true,
      moderation: serializeModeration(moderation),
    });
  });

  app.post('/rooms/:roomId/lock', { preHandler: [authenticate] }, async (request, reply) => {
    const params = parseOrReply(ModerateRoomParamsSchema, request.params, reply);
    if (!params) {
      return;
    }

    const body = parseOrReply(LockRoomRequestSchema, request.body, reply);
    if (!body) {
      return;
    }

    const auth = await authorizeHostActor(request.user.sub, params.roomId, body.actorMaskId);
    if (!auth.ok) {
      reply.code(auth.status);
      return { message: auth.message };
    }

    const room = await repo.setRoomLocked(params.roomId, body.locked);

    emitModerationEvent(params.roomId, {
      actionType: 'LOCK',
      actorMaskId: body.actorMaskId,
      locked: body.locked,
    });

    await emitRoomState(params.roomId);

    return ModerateRoomResponseSchema.parse({
      success: true,
      room: serializeRoom(room),
    });
  });

  app.get('/ws', { websocket: true, preValidation: [authenticate] }, async (connection, request) => {
    const session: SocketSession = {
      socket: connection.socket,
      userId: request.user.sub,
      roomMessageTimestamps: [],
      dmMessageTimestamps: [],
      channelMessageTimestamps: [],
    };

    sessions.set(connection.socket, session);

    const handleJoinRoom = async (roomId: string, maskId: string) => {
      const mask = await repo.findMaskByIdForUser(maskId, session.userId);
      if (!mask) {
        sendSocketError(connection.socket, 'Mask is not owned by the authenticated user');
        return;
      }

      const room = await repo.findRoomById(roomId);
      if (!room) {
        sendSocketError(connection.socket, 'Room not found');
        return;
      }

      if (isRoomExpired(room, new Date())) {
        expireRoom(room.id);
        sendSocketEvent(connection.socket, {
          type: 'ROOM_EXPIRED',
          data: { roomId: room.id },
        });
        return;
      }

      const membership = await repo.findRoomMembershipWithMask(room.id, mask.id);
      if (!membership) {
        sendSocketError(connection.socket, 'Mask is not a member of this room');
        return;
      }

      const wasPresent = isMaskPresentInRoom(room.id, mask.id, connection.socket);
      leaveRoom(session);

      session.joinedRoomId = room.id;
      session.joinedMember = serializeRoomMember(membership);
      getRoomSockets(room.id).add(connection.socket);

      ensureRoomExpiryTimer(room);
      await emitRoomState(room.id, connection.socket);

      if (!wasPresent && session.joinedMember) {
        broadcastToRoom(
          room.id,
          {
            type: 'MEMBER_JOINED',
            data: {
              roomId: room.id,
              member: session.joinedMember,
            },
          },
          connection.socket,
        );
      }

      await emitRoomState(room.id);
    };

    const handleSendMessage = async (
      roomId: string,
      maskId: string,
      body: string,
      imageUploadId?: string,
    ) => {
      if (!session.joinedRoomId || !session.joinedMember) {
        sendSocketError(connection.socket, 'Join a room before sending messages');
        return;
      }

      if (session.joinedRoomId !== roomId || session.joinedMember.maskId !== maskId) {
        sendSocketError(connection.socket, 'Message does not match active room or mask');
        return;
      }

      const room = await repo.findRoomById(roomId);
      if (!room) {
        sendSocketError(connection.socket, 'Room not found');
        leaveRoom(session);
        return;
      }

      if (isRoomExpired(room, new Date())) {
        expireRoom(room.id);
        return;
      }

      const membership = await repo.findRoomMembershipWithMask(roomId, maskId);
      if (!membership || membership.mask.userId !== session.userId) {
        sendSocketError(connection.socket, 'Mask is not authorized for this room');
        return;
      }

      const activeMute = await repo.findActiveMute(roomId, maskId, new Date());
      if (activeMute) {
        sendSocketError(
          connection.socket,
          `Muted until ${activeMute.expiresAt ? activeMute.expiresAt.toISOString() : 'unknown'}`,
        );
        return;
      }

      if (!isRoomMessageAllowed(session)) {
        sendSocketError(connection.socket, 'Rate limit exceeded. Slow down message sending.');
        return;
      }

      const sanitizedBody = sanitizeMessageBody(body);
      const uploadValidation = await validateMessageImageUpload({
        userId: session.userId,
        imageUploadId,
        contextType: 'EPHEMERAL_ROOM',
        contextId: roomId,
      });
      if (!uploadValidation.ok) {
        sendSocketError(connection.socket, uploadValidation.message);
        return;
      }

      if (!sanitizedBody && !uploadValidation.upload) {
        sendSocketError(connection.socket, 'Message body is empty after sanitization');
        return;
      }

      const created = await repo.createMessage({
        roomId,
        maskId,
        body: sanitizedBody,
        imageUploadId: uploadValidation.upload?.id,
      });

      broadcastToRoom(roomId, {
        type: 'NEW_MESSAGE',
        data: {
          message: serializeRealtimeMessage(created),
        },
      });
    };

    const handleJoinDm = async (threadId: string, maskId: string) => {
      const mask = await repo.findMaskByIdForUser(maskId, session.userId);
      if (!mask) {
        sendSocketError(connection.socket, 'Mask is not owned by the authenticated user');
        return;
      }

      const thread = await repo.findDmThreadById(threadId);
      if (!thread) {
        sendSocketError(connection.socket, 'DM thread not found');
        return;
      }

      if (getPeerUserIdForThread(thread, session.userId) === null) {
        sendSocketError(connection.socket, 'Not authorized for this DM thread');
        return;
      }

      const participant = await repo.findDmParticipant(thread.id, session.userId);
      if (!participant) {
        sendSocketError(connection.socket, 'Not authorized for this DM thread');
        return;
      }

      await repo.upsertDmParticipant({
        threadId: thread.id,
        userId: session.userId,
        activeMaskId: mask.id,
      });

      leaveDm(session);
      session.joinedDmThreadId = thread.id;
      session.joinedDmMaskId = mask.id;
      getDmSockets(thread.id).add(connection.socket);

      await emitDmState(thread.id, connection.socket);
      await emitDmState(thread.id);
    };

    const handleSendDm = async (
      threadId: string,
      maskId: string,
      body: string,
      imageUploadId?: string,
    ) => {
      if (!session.joinedDmThreadId || !session.joinedDmMaskId) {
        sendSocketError(connection.socket, 'Join a DM before sending messages');
        return;
      }

      if (session.joinedDmThreadId !== threadId || session.joinedDmMaskId !== maskId) {
        sendSocketError(connection.socket, 'Message does not match active DM or mask');
        return;
      }

      const thread = await repo.findDmThreadById(threadId);
      if (!thread) {
        sendSocketError(connection.socket, 'DM thread not found');
        leaveDm(session);
        return;
      }

      if (getPeerUserIdForThread(thread, session.userId) === null) {
        sendSocketError(connection.socket, 'Not authorized for this DM thread');
        leaveDm(session);
        return;
      }

      const participant = await repo.findDmParticipant(thread.id, session.userId);
      if (!participant) {
        sendSocketError(connection.socket, 'Not authorized for this DM thread');
        leaveDm(session);
        return;
      }

      if (participant.activeMaskId !== maskId) {
        sendSocketError(connection.socket, 'Mask does not match DM participant state');
        return;
      }

      const mask = await repo.findMaskByIdForUser(maskId, session.userId);
      if (!mask) {
        sendSocketError(connection.socket, 'Mask is not owned by the authenticated user');
        return;
      }

      if (!isDmMessageAllowed(session)) {
        sendSocketError(connection.socket, 'Rate limit exceeded. Slow down message sending.');
        return;
      }

      const sanitizedBody = sanitizeMessageBody(body);
      const uploadValidation = await validateMessageImageUpload({
        userId: session.userId,
        imageUploadId,
        contextType: 'DM_THREAD',
        contextId: threadId,
      });
      if (!uploadValidation.ok) {
        sendSocketError(connection.socket, uploadValidation.message);
        return;
      }

      if (!sanitizedBody && !uploadValidation.upload) {
        sendSocketError(connection.socket, 'Message body is empty after sanitization');
        return;
      }

      const created = await repo.createDmMessage({
        threadId,
        maskId,
        body: sanitizedBody,
        imageUploadId: uploadValidation.upload?.id,
      });

      broadcastToDm(threadId, {
        type: 'NEW_DM_MESSAGE',
        data: {
          threadId,
          message: serializeDmMessage(created),
        },
      });
    };

    const handleJoinChannel = async (channelId: string) => {
      const channel = await repo.findChannelById(channelId);
      if (!channel) {
        sendSocketError(connection.socket, 'Channel not found');
        return;
      }

      const [server, membership] = await Promise.all([
        repo.findServerById(channel.serverId),
        repo.findServerMember(channel.serverId, session.userId),
      ]);
      if (!server || !membership) {
        sendSocketError(connection.socket, 'You are not a member of this server');
        return;
      }

      const effectiveMask = await resolveEffectiveChannelMask(repo, server, channel, membership);

      const wasPresent = isUserPresentInChannel(channel.id, session.userId, connection.socket);
      leaveChannel(session);

      session.joinedChannelId = channel.id;
      session.joinedChannelMember = serializeServerChannelMember(membership, effectiveMask);
      getChannelSockets(channel.id).add(connection.socket);

      await emitChannelState(channel.id, connection.socket);

      if (!wasPresent && session.joinedChannelMember) {
        broadcastToChannel(
          channel.id,
          {
            type: 'MEMBER_JOINED',
            data: {
              channelId: channel.id,
              member: session.joinedChannelMember,
            },
          },
          connection.socket,
        );
      }

      await emitChannelState(channel.id);
    };

    const handleSendChannelMessage = async (
      channelId: string,
      body: string,
      imageUploadId?: string,
    ) => {
      if (!session.joinedChannelId || !session.joinedChannelMember) {
        sendSocketError(connection.socket, 'Join a channel before sending messages');
        return;
      }

      if (session.joinedChannelId !== channelId) {
        sendSocketError(connection.socket, 'Message does not match active channel');
        return;
      }

      const channel = await repo.findChannelById(channelId);
      if (!channel) {
        sendSocketError(connection.socket, 'Channel not found');
        leaveChannel(session);
        return;
      }

      const [server, membership] = await Promise.all([
        repo.findServerById(channel.serverId),
        repo.findServerMember(channel.serverId, session.userId),
      ]);
      if (!server || !membership) {
        sendSocketError(connection.socket, 'You are not a member of this server');
        leaveChannel(session);
        return;
      }

      if (!isChannelMessageAllowed(session)) {
        sendSocketError(connection.socket, 'Rate limit exceeded. Slow down message sending.');
        return;
      }

      const sanitizedBody = sanitizeMessageBody(body);
      const uploadValidation = await validateMessageImageUpload({
        userId: session.userId,
        imageUploadId,
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
      });
      if (!uploadValidation.ok) {
        sendSocketError(connection.socket, uploadValidation.message);
        return;
      }

      if (!sanitizedBody && !uploadValidation.upload) {
        sendSocketError(connection.socket, 'Message body is empty after sanitization');
        return;
      }

      const effectiveMask = await resolveEffectiveChannelMask(repo, server, channel, membership);
      const effectiveMaskRecord = await repo.findMaskByIdForUser(effectiveMask.id, session.userId);
      if (!effectiveMaskRecord) {
        sendSocketError(connection.socket, 'Mask is not owned by the authenticated user');
        return;
      }

      session.joinedChannelMember = serializeServerChannelMember(membership, effectiveMaskRecord);

      const created = await repo.createServerMessage({
        channelId,
        maskId: effectiveMaskRecord.id,
        body: sanitizedBody,
        imageUploadId: uploadValidation.upload?.id,
      });

      broadcastToChannel(channelId, {
        type: 'NEW_CHANNEL_MESSAGE',
        data: {
          message: serializeServerMessage(created),
        },
      });
    };

    connection.socket.on('message', (rawData) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(String(rawData));
      } catch {
        sendSocketError(connection.socket, 'Invalid JSON payload');
        return;
      }

      const parsedEvent = ClientSocketEventSchema.safeParse(parsedJson);
      if (!parsedEvent.success) {
        sendSocketError(connection.socket, 'Invalid socket event payload');
        return;
      }

      if (parsedEvent.data.type === 'JOIN_ROOM') {
        void handleJoinRoom(parsedEvent.data.data.roomId, parsedEvent.data.data.maskId);
        return;
      }

      if (parsedEvent.data.type === 'SEND_MESSAGE') {
        void handleSendMessage(
          parsedEvent.data.data.roomId,
          parsedEvent.data.data.maskId,
          parsedEvent.data.data.body,
          parsedEvent.data.data.imageUploadId,
        );
        return;
      }

      if (parsedEvent.data.type === 'JOIN_DM') {
        void handleJoinDm(parsedEvent.data.data.threadId, parsedEvent.data.data.maskId);
        return;
      }

      if (parsedEvent.data.type === 'SEND_DM') {
        void handleSendDm(
          parsedEvent.data.data.threadId,
          parsedEvent.data.data.maskId,
          parsedEvent.data.data.body,
          parsedEvent.data.data.imageUploadId,
        );
        return;
      }

      if (parsedEvent.data.type === 'JOIN_CHANNEL') {
        void handleJoinChannel(parsedEvent.data.data.channelId);
        return;
      }

      if (parsedEvent.data.type === 'SEND_CHANNEL_MESSAGE') {
        void handleSendChannelMessage(
          parsedEvent.data.data.channelId,
          parsedEvent.data.data.body,
          parsedEvent.data.data.imageUploadId,
        );
      }
    });

    connection.socket.on('close', () => {
      leaveRoom(session);
      leaveDm(session);
      leaveChannel(session);
      sessions.delete(connection.socket);
    });
  });

  return app;
};

