import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ImpersonationStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/prisma/prisma.service';
import { WebSocketService } from './websocket.service';
import { getPermissionsForRole } from '@common/constants/permissions.constant';
import { resolveEffectiveTenantId } from '@common/tenant/effective-tenant';
import { ImpersonationContext } from '@common/interfaces/request-context.interface';

interface SocketAuth {
  token?: string;
}

interface SocketData {
  userId: string;
  role: UserRole;
  merchantId: string | null;
  courierId: string | null;
  tenantId: string;
}

@WSGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'],
    credentials: true,
  },
  namespace: '/ws',
})
export class WebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  private static readonly ADMIN_ROLES: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.FINANCE_ADMIN,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsService: WebSocketService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(
        `Client ${client.id} connected without token, disconnecting`,
      );
      client.emit('error', { message: 'Authentication token required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: UserRole;
        impersonationContext?: ImpersonationContext;
      }>(token);
      const userId: string = payload.sub;
      let role: UserRole = payload.role;

      const user = await this.prisma.user.findUnique({
        where: { id: userId, isActive: true },
        include: { merchant: true, courier: true },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found or inactive, disconnecting`);
        client.emit('error', { message: 'User not found or inactive' });
        client.disconnect(true);
        return;
      }
      role = user.role;

      if (payload.impersonationContext) {
        const session = await this.prisma.impersonationSession.findUnique({
          where: { id: payload.impersonationContext.sessionId },
        });
        if (
          !session ||
          session.status !== ImpersonationStatus.ACTIVE ||
          session.expiresAt <= new Date() ||
          session.actorUserId !== payload.impersonationContext.actorUserId ||
          session.targetUserId !== user.id ||
          session.tenantId !== payload.impersonationContext.tenantId ||
          user.tenantId !== session.tenantId
        ) {
          throw new Error('Invalid impersonation context');
        }
      }

      const tenantId = resolveEffectiveTenantId({
        userId: user.id,
        role: user.role,
        permissions: getPermissionsForRole(user.role),
        tenantId: payload.impersonationContext?.tenantId ?? user.tenantId,
        impersonationContext: payload.impersonationContext,
      });

      client.data = {
        userId,
        role,
        merchantId: user.merchant?.id || null,
        courierId: user.courier?.id || null,
        tenantId,
      };

      await this.joinRoleRooms(client);

      this.logger.log(`Client ${client.id} connected as ${role} (${userId})`);
      client.emit('connection:established', { userId, role });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Client ${client.id} auth failed: ${msg}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:tracking')
  async handleSubscribeTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { trackingNumber: string },
  ): Promise<void> {
    const { tenantId } = client.data as SocketData;
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber: data.trackingNumber, tenantId },
      select: { id: true },
    });
    if (!shipment) {
      client.emit('error', { message: 'Shipment not found' });
      return;
    }
    const room = `tenant:${tenantId}:shipment:${data.trackingNumber}`;
    await client.join(room);
    client.emit('subscribed', { room });
  }

  @SubscribeMessage('unsubscribe:tracking')
  async handleUnsubscribeTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { trackingNumber: string },
  ): Promise<void> {
    const { tenantId } = client.data as SocketData;
    const room = `tenant:${tenantId}:shipment:${data.trackingNumber}`;
    await client.leave(room);
    client.emit('unsubscribed', { room });
  }

  @SubscribeMessage('sync:missed')
  async handleSyncMissed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lastEventId: string; rooms?: string[] },
  ): Promise<void> {
    const socketData = client.data as SocketData;
    const { userId, role, merchantId, courierId } = socketData;
    const rooms = this.getDefaultRooms(
      userId,
      role,
      merchantId,
      courierId,
      socketData.tenantId,
    );

    for (const roomId of rooms) {
      const events = await this.wsService.getMissedEvents(
        roomId,
        data.lastEventId,
      );
      for (const event of events) {
        client.emit(event.event, event.data);
      }
    }

    client.emit('sync:missed:complete', { count: rooms.length });
  }

  private async joinRoleRooms(client: Socket): Promise<void> {
    const socketData = client.data as SocketData;
    const { userId, role, merchantId, courierId, tenantId } = socketData;

    if (merchantId) {
      await client.join(`tenant:${tenantId}:merchant:${merchantId}`);
    }

    if (courierId) {
      await client.join(`tenant:${tenantId}:courier:${courierId}`);
    }

    if (WebSocketGateway.ADMIN_ROLES.includes(role)) {
      await client.join(`tenant:${tenantId}:admin:dashboard`);
    }

    await client.join(`tenant:${tenantId}:user:${userId}`);
  }

  private getDefaultRooms(
    userId: string,
    role: UserRole,
    merchantId: string | null,
    courierId: string | null,
    tenantId: string,
  ): string[] {
    const rooms: string[] = [`tenant:${tenantId}:user:${userId}`];
    if (merchantId) rooms.push(`tenant:${tenantId}:merchant:${merchantId}`);
    if (courierId) rooms.push(`tenant:${tenantId}:courier:${courierId}`);
    if (WebSocketGateway.ADMIN_ROLES.includes(role)) {
      rooms.push(`tenant:${tenantId}:admin:dashboard`);
    }
    return rooms;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake?.auth as SocketAuth | undefined;
    if (auth?.token) {
      return auth.token.replace(/^Bearer\s+/i, '');
    }

    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, '');
    }

    return null;
  }
}
