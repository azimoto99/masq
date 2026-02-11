import type { PrismaClient } from '@prisma/client';
import type { ServerPermission } from '@masq/shared';
import type {
  AddRoomMembershipInput,
  AddServerMemberInput,
  CreateChannelInput,
  CreateServerRoleInput,
  CreateServerInput,
  CreateServerInviteInput,
  CreateServerMessageInput,
  CreateUploadInput,
  CreateVoiceParticipantInput,
  CreateVoiceSessionInput,
  CreateMaskInput,
  CreateDmMessageInput,
  CreateMessageInput,
  CreateRoomModerationInput,
  CreateRoomInput,
  CreateUserInput,
  FriendUserRecord,
  MasqRepository,
  UpsertDmParticipantInput,
  UpsertFriendRequestInput,
} from './repository.js';

const orderUserPair = (userAId: string, userBId: string) => {
  if (userAId <= userBId) {
    return { userAId, userBId };
  }

  return {
    userAId: userBId,
    userBId: userAId,
  };
};

const serializeFriendUser = (user: {
  id: string;
  email: string;
  defaultMask: {
    id: string;
    displayName: string;
    color: string;
    avatarSeed: string;
    avatarUploadId: string | null;
  } | null;
}): FriendUserRecord => ({
  id: user.id,
  email: user.email,
  defaultMask: user.defaultMask
    ? {
        id: user.defaultMask.id,
        displayName: user.defaultMask.displayName,
        color: user.defaultMask.color,
        avatarSeed: user.defaultMask.avatarSeed,
        avatarUploadId: user.defaultMask.avatarUploadId,
      }
    : null,
});

const SERVER_PERMISSIONS: ServerPermission[] = [
  'ManageChannels',
  'ManageMembers',
  'CreateInvites',
  'ModerateChat',
];

const toServerPermissions = (value: unknown): ServerPermission[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const permissions = new Set<ServerPermission>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      continue;
    }

    if (SERVER_PERMISSIONS.includes(candidate as ServerPermission)) {
      permissions.add(candidate as ServerPermission);
    }
  }

  return Array.from(permissions.values());
};

const serializeServerMember = (membership: {
  serverId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: Date;
  serverMaskId: string;
  serverMask: {
    id: string;
    userId: string;
    displayName: string;
    color: string;
    avatarSeed: string;
    avatarUploadId: string | null;
    createdAt: Date;
  };
  memberRoles: Array<{
    roleId: string;
    role: {
      permissions: unknown;
    };
  }>;
}) => {
  const roleIds = membership.memberRoles.map((memberRole) => memberRole.roleId);
  const permissionSet = new Set<ServerPermission>();
  for (const memberRole of membership.memberRoles) {
    for (const permission of toServerPermissions(memberRole.role.permissions)) {
      permissionSet.add(permission);
    }
  }

  return {
    serverId: membership.serverId,
    userId: membership.userId,
    role: membership.role,
    roleIds,
    permissions: Array.from(permissionSet.values()),
    joinedAt: membership.joinedAt,
    serverMaskId: membership.serverMaskId,
    serverMask: membership.serverMask,
  };
};

export const createPrismaRepository = (prisma: PrismaClient): MasqRepository => {
  return {
    async pingDb() {
      await prisma.$queryRaw`SELECT 1`;
    },

    findUserByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },

    findUserById(id: string) {
      return prisma.user.findUnique({ where: { id } });
    },

    updateUserDefaultMask(userId: string, defaultMaskId: string | null) {
      return prisma.user.update({
        where: { id: userId },
        data: { defaultMaskId },
      });
    },

    createUser(input: CreateUserInput) {
      return prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
        },
      });
    },

    listMasksByUser(userId: string) {
      return prisma.mask.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    },

    countMasksByUser(userId: string) {
      return prisma.mask.count({ where: { userId } });
    },

    createMask(input: CreateMaskInput) {
      return prisma.mask.create({
        data: {
          userId: input.userId,
          displayName: input.displayName,
          color: input.color,
          avatarSeed: input.avatarSeed,
          avatarUploadId: input.avatarUploadId ?? null,
        },
      });
    },

    setMaskAvatarUpload(maskId: string, avatarUploadId: string | null) {
      return prisma.mask.update({
        where: { id: maskId },
        data: {
          avatarUploadId,
        },
      });
    },

    createServer(input: CreateServerInput) {
      return prisma.server.create({
        data: {
          name: input.name,
          ownerUserId: input.ownerUserId,
        },
      });
    },

    updateServerSettings(serverId: string, settings: { channelIdentityMode: 'SERVER_MASK' | 'CHANNEL_MASK' }) {
      return prisma.server.update({
        where: { id: serverId },
        data: {
          channelIdentityMode: settings.channelIdentityMode,
        },
      });
    },

    async listServersForUser(userId: string) {
      const memberships = await prisma.serverMember.findMany({
        where: { userId },
        include: {
          server: true,
          serverMask: true,
        },
        orderBy: {
          joinedAt: 'desc',
        },
      });

      return memberships.map((membership) => ({
        server: membership.server,
        role: membership.role,
        joinedAt: membership.joinedAt,
        serverMask: membership.serverMask,
      }));
    },

    findServerById(serverId: string) {
      return prisma.server.findUnique({
        where: { id: serverId },
      });
    },

    async findServerMember(serverId: string, userId: string) {
      const membership = await prisma.serverMember.findUnique({
        where: {
          serverId_userId: {
            serverId,
            userId,
          },
        },
        include: {
          serverMask: true,
          memberRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!membership) {
        return null;
      }

      return serializeServerMember(membership);
    },

    async listServerMembers(serverId: string) {
      const memberships = await prisma.serverMember.findMany({
        where: { serverId },
        include: {
          serverMask: true,
          memberRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });

      return memberships.map(serializeServerMember);
    },

    async addServerMember(input: AddServerMemberInput) {
      const membership = await prisma.serverMember.upsert({
        where: {
          serverId_userId: {
            serverId: input.serverId,
            userId: input.userId,
          },
        },
        update: {
          role: input.role,
          serverMaskId: input.serverMaskId,
        },
        create: {
          serverId: input.serverId,
          userId: input.userId,
          role: input.role,
          serverMaskId: input.serverMaskId,
        },
        include: {
          serverMask: true,
          memberRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      return serializeServerMember(membership);
    },

    async updateServerMemberMask(serverId: string, userId: string, serverMaskId: string) {
      const membership = await prisma.serverMember.update({
        where: {
          serverId_userId: {
            serverId,
            userId,
          },
        },
        data: {
          serverMaskId,
        },
        include: {
          serverMask: true,
          memberRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      return serializeServerMember(membership);
    },

    async setServerMemberRoles(serverId: string, userId: string, roleIds: string[]) {
      await prisma.$transaction(async (tx) => {
        await tx.serverMemberRole.deleteMany({
          where: {
            serverId,
            userId,
          },
        });

        if (roleIds.length > 0) {
          await tx.serverMemberRole.createMany({
            data: roleIds.map((roleId) => ({
              serverId,
              userId,
              roleId,
            })),
            skipDuplicates: true,
          });
        }
      });

      const updated = await prisma.serverMember.findUnique({
        where: {
          serverId_userId: {
            serverId,
            userId,
          },
        },
        include: {
          serverMask: true,
          memberRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!updated) {
        throw new Error('Server membership not found');
      }

      return serializeServerMember(updated);
    },

    async removeServerMember(serverId: string, userId: string) {
      const deleted = await prisma.serverMember.deleteMany({
        where: {
          serverId,
          userId,
        },
      });
      return deleted.count > 0;
    },

    async createServerRole(input: CreateServerRoleInput) {
      const role = await prisma.serverRole.create({
        data: {
          serverId: input.serverId,
          name: input.name,
          permissions: input.permissions,
        },
      });

      return {
        ...role,
        permissions: toServerPermissions(role.permissions),
      };
    },

    async updateServerRole(serverId: string, roleId: string, updates: { name?: string; permissions?: ServerPermission[] }) {
      const existing = await prisma.serverRole.findFirst({
        where: {
          id: roleId,
          serverId,
        },
      });

      if (!existing) {
        throw new Error('Server role not found');
      }

      const role = await prisma.serverRole.update({
        where: { id: roleId },
        data: {
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.permissions !== undefined ? { permissions: updates.permissions } : {}),
        },
      });

      return {
        ...role,
        permissions: toServerPermissions(role.permissions),
      };
    },

    async findServerRoleByName(serverId: string, name: string) {
      const role = await prisma.serverRole.findUnique({
        where: {
          serverId_name: {
            serverId,
            name,
          },
        },
      });

      if (!role) {
        return null;
      }

      return {
        ...role,
        permissions: toServerPermissions(role.permissions),
      };
    },

    async findServerRoleById(serverId: string, roleId: string) {
      const role = await prisma.serverRole.findFirst({
        where: {
          id: roleId,
          serverId,
        },
      });

      if (!role) {
        return null;
      }

      return {
        ...role,
        permissions: toServerPermissions(role.permissions),
      };
    },

    async listServerRoles(serverId: string) {
      const roles = await prisma.serverRole.findMany({
        where: { serverId },
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      });

      return roles.map((role) => ({
        ...role,
        permissions: toServerPermissions(role.permissions),
      }));
    },

    createServerInvite(input: CreateServerInviteInput) {
      return prisma.serverInvite.create({
        data: {
          serverId: input.serverId,
          code: input.code,
          expiresAt: input.expiresAt,
          maxUses: input.maxUses,
        },
      });
    },

    findServerInviteByCode(code: string) {
      return prisma.serverInvite.findUnique({
        where: { code },
      });
    },

    incrementServerInviteUses(inviteId: string) {
      return prisma.serverInvite.update({
        where: { id: inviteId },
        data: {
          uses: {
            increment: 1,
          },
        },
      });
    },

    createServerChannel(input: CreateChannelInput) {
      return prisma.channel.create({
        data: {
          serverId: input.serverId,
          name: input.name,
          type: input.type,
        },
      });
    },

    async deleteServerChannel(serverId: string, channelId: string) {
      const deleted = await prisma.channel.deleteMany({
        where: {
          id: channelId,
          serverId,
        },
      });
      return deleted.count > 0;
    },

    findChannelById(channelId: string) {
      return prisma.channel.findUnique({
        where: { id: channelId },
      });
    },

    findChannelMemberIdentity(channelId: string, userId: string) {
      return prisma.channelMemberIdentity.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
        include: {
          mask: true,
        },
      });
    },

    upsertChannelMemberIdentity(channelId: string, userId: string, maskId: string) {
      return prisma.channelMemberIdentity.upsert({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
        update: {
          maskId,
        },
        create: {
          channelId,
          userId,
          maskId,
        },
        include: {
          mask: true,
        },
      });
    },

    listServerChannels(serverId: string) {
      return prisma.channel.findMany({
        where: { serverId },
        orderBy: {
          createdAt: 'asc',
        },
      });
    },

    listServerMessages(channelId: string) {
      return prisma.serverMessage.findMany({
        where: { channelId },
        include: {
          mask: true,
          imageUpload: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    },

    createServerMessage(input: CreateServerMessageInput) {
      return prisma.serverMessage.create({
        data: {
          channelId: input.channelId,
          maskId: input.maskId,
          body: input.body,
          imageUploadId: input.imageUploadId ?? null,
        },
        include: {
          mask: true,
          imageUpload: true,
        },
      });
    },

    createUpload(input: CreateUploadInput) {
      return prisma.upload.create({
        data: {
          ownerUserId: input.ownerUserId,
          kind: input.kind,
          contextType: input.contextType,
          contextId: input.contextId,
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          storagePath: input.storagePath,
        },
      });
    },

    findUploadById(uploadId: string) {
      return prisma.upload.findUnique({
        where: { id: uploadId },
      });
    },

    findMaskByIdForUser(maskId: string, userId: string) {
      return prisma.mask.findFirst({
        where: {
          id: maskId,
          userId,
        },
      });
    },

    async maskHasActiveRoomMembership(maskId: string, now: Date) {
      const membership = await prisma.roomMembership.findFirst({
        where: {
          maskId,
          room: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        select: { maskId: true },
      });

      return membership !== null;
    },

    async deleteMask(maskId: string) {
      await prisma.mask.delete({ where: { id: maskId } });
    },

    async listRoomsForMask(maskId: string, now: Date) {
      const memberships = await prisma.roomMembership.findMany({
        where: {
          maskId,
          room: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        include: { room: true },
        orderBy: {
          room: {
            createdAt: 'desc',
          },
        },
      });

      return memberships.map((membership) => ({
        room: membership.room,
        role: membership.role,
        joinedAt: membership.joinedAt,
      }));
    },

    createRoom(input: CreateRoomInput) {
      return prisma.room.create({
        data: {
          title: input.title,
          kind: input.kind,
          locked: input.locked,
          fogLevel: input.fogLevel,
          messageDecayMinutes: input.messageDecayMinutes,
          expiresAt: input.expiresAt,
        },
      });
    },

    addRoomMembership(input: AddRoomMembershipInput) {
      return prisma.roomMembership.upsert({
        where: {
          roomId_maskId: {
            roomId: input.roomId,
            maskId: input.maskId,
          },
        },
        update: {},
        create: {
          roomId: input.roomId,
          maskId: input.maskId,
          role: input.role,
        },
        include: {
          mask: true,
        },
      });
    },

    async removeRoomMembership(roomId: string, maskId: string) {
      await prisma.roomMembership.deleteMany({
        where: {
          roomId,
          maskId,
        },
      });
    },

    findRoomById(roomId: string) {
      return prisma.room.findUnique({ where: { id: roomId } });
    },

    setRoomLocked(roomId: string, locked: boolean) {
      return prisma.room.update({
        where: { id: roomId },
        data: { locked },
      });
    },

    findRoomMembershipWithMask(roomId: string, maskId: string) {
      return prisma.roomMembership.findUnique({
        where: {
          roomId_maskId: {
            roomId,
            maskId,
          },
        },
        include: {
          mask: true,
        },
      });
    },

    async listRoomMessages(roomId: string) {
      return prisma.message.findMany({
        where: { roomId },
        include: {
          mask: true,
          imageUpload: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    },

    createMessage(input: CreateMessageInput) {
      return prisma.message.create({
        data: {
          roomId: input.roomId,
          maskId: input.maskId,
          body: input.body,
          imageUploadId: input.imageUploadId ?? null,
        },
        include: {
          mask: true,
          imageUpload: true,
        },
      });
    },

    createRoomModeration(input: CreateRoomModerationInput) {
      return prisma.roomModeration.create({
        data: {
          roomId: input.roomId,
          targetMaskId: input.targetMaskId,
          actionType: input.actionType,
          expiresAt: input.expiresAt,
          actorMaskId: input.actorMaskId,
        },
      });
    },

    findActiveMute(roomId: string, targetMaskId: string, now: Date) {
      return prisma.roomModeration.findFirst({
        where: {
          roomId,
          targetMaskId,
          actionType: 'MUTE',
          expiresAt: {
            gt: now,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    findFriendRequestById(id: string) {
      return prisma.friendRequest.findUnique({ where: { id } });
    },

    findFriendRequestBetweenUsers(userAId: string, userBId: string) {
      return prisma.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: userAId, toUserId: userBId },
            { fromUserId: userBId, toUserId: userAId },
          ],
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    },

    upsertFriendRequest(input: UpsertFriendRequestInput) {
      return prisma.friendRequest.upsert({
        where: {
          fromUserId_toUserId: {
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
          },
        },
        update: {
          status: input.status,
        },
        create: {
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          status: input.status,
        },
      });
    },

    updateFriendRequestStatus(id, status) {
      return prisma.friendRequest.update({
        where: { id },
        data: { status },
      });
    },

    findFriendshipBetweenUsers(userAId: string, userBId: string) {
      const pair = orderUserPair(userAId, userBId);
      return prisma.friendship.findUnique({
        where: {
          userAId_userBId: pair,
        },
        select: { id: true },
      });
    },

    createFriendship(userAId: string, userBId: string) {
      const pair = orderUserPair(userAId, userBId);
      return prisma.friendship.upsert({
        where: {
          userAId_userBId: pair,
        },
        update: {},
        create: pair,
      });
    },

    async deleteFriendshipBetweenUsers(userAId: string, userBId: string) {
      const pair = orderUserPair(userAId, userBId);
      const deleted = await prisma.friendship.deleteMany({
        where: pair,
      });
      return deleted.count > 0;
    },

    async listFriendsForUser(userId: string) {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: {
            include: {
              defaultMask: true,
            },
          },
          userB: {
            include: {
              defaultMask: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return friendships
        .map((friendship) => (friendship.userAId === userId ? friendship.userB : friendship.userA))
        .map(serializeFriendUser);
    },

    async listIncomingFriendRequests(userId: string) {
      const requests = await prisma.friendRequest.findMany({
        where: {
          toUserId: userId,
          status: 'PENDING',
        },
        include: {
          fromUser: {
            include: {
              defaultMask: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return requests.map((request) => ({
        request,
        fromUser: serializeFriendUser(request.fromUser),
      }));
    },

    async listOutgoingFriendRequests(userId: string) {
      const requests = await prisma.friendRequest.findMany({
        where: {
          fromUserId: userId,
          status: 'PENDING',
        },
        include: {
          toUser: {
            include: {
              defaultMask: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return requests.map((request) => ({
        request,
        toUser: serializeFriendUser(request.toUser),
      }));
    },

    findDmThreadById(threadId: string) {
      return prisma.dMThread.findUnique({
        where: { id: threadId },
      });
    },

    findDmThreadBetweenUsers(userAId: string, userBId: string) {
      const pair = orderUserPair(userAId, userBId);
      return prisma.dMThread.findUnique({
        where: {
          userAId_userBId: pair,
        },
      });
    },

    createDmThread(userAId: string, userBId: string) {
      const pair = orderUserPair(userAId, userBId);
      return prisma.dMThread.upsert({
        where: {
          userAId_userBId: pair,
        },
        update: {},
        create: pair,
      });
    },

    listDmThreadsForUser(userId: string) {
      return prisma.dMThread.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    upsertDmParticipant(input: UpsertDmParticipantInput) {
      return prisma.dMParticipant.upsert({
        where: {
          threadId_userId: {
            threadId: input.threadId,
            userId: input.userId,
          },
        },
        update: {
          activeMaskId: input.activeMaskId,
        },
        create: {
          threadId: input.threadId,
          userId: input.userId,
          activeMaskId: input.activeMaskId,
        },
        include: {
          activeMask: true,
        },
      });
    },

    findDmParticipant(threadId: string, userId: string) {
      return prisma.dMParticipant.findUnique({
        where: {
          threadId_userId: {
            threadId,
            userId,
          },
        },
        include: {
          activeMask: true,
        },
      });
    },

    listDmParticipants(threadId: string) {
      return prisma.dMParticipant.findMany({
        where: { threadId },
        include: {
          activeMask: true,
        },
        orderBy: {
          userId: 'asc',
        },
      });
    },

    listDmMessages(threadId: string) {
      return prisma.dMMessage.findMany({
        where: { threadId },
        include: {
          mask: true,
          imageUpload: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    },

    createDmMessage(input: CreateDmMessageInput) {
      return prisma.dMMessage.create({
        data: {
          threadId: input.threadId,
          maskId: input.maskId,
          body: input.body,
          imageUploadId: input.imageUploadId ?? null,
        },
        include: {
          mask: true,
          imageUpload: true,
        },
      });
    },

    findVoiceSessionById(voiceSessionId: string) {
      return prisma.voiceSession.findUnique({
        where: { id: voiceSessionId },
      });
    },

    findActiveVoiceSessionByContext(contextType, contextId) {
      return prisma.voiceSession.findFirst({
        where: {
          contextType,
          contextId,
          endedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    createVoiceSession(input: CreateVoiceSessionInput) {
      return prisma.voiceSession.create({
        data: {
          contextType: input.contextType,
          contextId: input.contextId,
          livekitRoomName: input.livekitRoomName,
        },
      });
    },

    endVoiceSession(voiceSessionId: string, endedAt: Date) {
      return prisma.voiceSession.update({
        where: { id: voiceSessionId },
        data: { endedAt },
      });
    },

    createVoiceParticipant(input: CreateVoiceParticipantInput) {
      return prisma.voiceParticipant.create({
        data: {
          voiceSessionId: input.voiceSessionId,
          userId: input.userId,
          maskId: input.maskId,
          isServerMuted: input.isServerMuted ?? false,
        },
        include: {
          mask: true,
        },
      });
    },

    listActiveVoiceParticipants(voiceSessionId: string) {
      return prisma.voiceParticipant.findMany({
        where: {
          voiceSessionId,
          leftAt: null,
        },
        include: {
          mask: true,
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });
    },

    async markVoiceParticipantsLeft(voiceSessionId: string, userId: string, leftAt: Date) {
      const updated = await prisma.voiceParticipant.updateMany({
        where: {
          voiceSessionId,
          userId,
          leftAt: null,
        },
        data: {
          leftAt,
        },
      });

      return updated.count;
    },

    async setVoiceParticipantsMuted(voiceSessionId: string, targetMaskId: string, isServerMuted: boolean) {
      const updated = await prisma.voiceParticipant.updateMany({
        where: {
          voiceSessionId,
          maskId: targetMaskId,
          leftAt: null,
        },
        data: {
          isServerMuted,
        },
      });

      return updated.count;
    },
  };
};


