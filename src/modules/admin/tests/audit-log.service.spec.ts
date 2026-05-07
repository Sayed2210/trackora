import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../services/audit-log.service';
import { PrismaService } from '@core/prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: PrismaService;

  const mockAuditLog = {
    id: 'log-1',
    userId: 'user-1',
    action: 'UPDATE',
    entityType: 'Shipment',
    entityId: 'ship-1',
    oldValue: { status: 'PENDING' },
    newValue: { status: 'DELIVERED' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
  };

  const mockPrisma = {
    auditLog: {
      findMany: jest.fn().mockResolvedValue([mockAuditLog]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockAuditLog),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const result = await service.findAll({});

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should apply filters correctly', async () => {
      await service.findAll({
        userId: 'user-1',
        action: 'update',
        entityType: 'Shipment',
        entityId: 'ship-1',
        from: new Date('2024-05-01'),
        to: new Date('2024-05-31'),
        page: 2,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            action: { contains: 'update', mode: 'insensitive' },
            entityType: 'Shipment',
            entityId: 'ship-1',
            createdAt: {
              gte: new Date('2024-05-01'),
              lte: new Date('2024-05-31'),
            },
          }),
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should apply only from date', async () => {
      await service.findAll({ from: new Date('2024-05-01') });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2024-05-01') },
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create an audit log', async () => {
      const result = await service.create({
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'Shipment',
        entityId: 'ship-1',
        oldValue: { status: 'PENDING' },
        newValue: { status: 'DELIVERED' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'UPDATE',
          entityType: 'Shipment',
          entityId: 'ship-1',
          oldValue: { status: 'PENDING' },
          newValue: { status: 'DELIVERED' },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should handle optional fields as null', async () => {
      await service.create({
        action: 'CREATE',
        entityType: 'Merchant',
        entityId: 'merchant-1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'CREATE',
          entityType: 'Merchant',
          entityId: 'merchant-1',
          oldValue: undefined,
          newValue: undefined,
          ipAddress: null,
          userAgent: null,
        },
      });
    });
  });
});
