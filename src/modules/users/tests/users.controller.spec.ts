import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserRole } from '../entities/user.entity';

const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockGuard = { canActivate: jest.fn(() => true) };

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test User',
  phone: '01000000001',
  role: UserRole.MERCHANT,
  isActive: true,
  createdAt: new Date().toISOString(),
};

describe('UsersController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        userId: 'admin-1',
        role: 'SUPER_ADMIN',
        tenantId: 'tenant-1',
        permissions: [],
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should return all users', async () => {
      mockUsersService.findAll.mockResolvedValue([mockUser]);

      const res = await request(app.getHttpServer()).get('/users').expect(200);

      expect(res.body).toEqual([mockUser]);
      expect(mockUsersService.findAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .get('/users/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(res.body).toEqual(mockUser);
      expect(mockUsersService.findById).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'tenant-1',
      );
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user', async () => {
      const updated = { ...mockUser, name: 'Updated' };
      mockUsersService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/users/123e4567-e89b-12d3-a456-426614174000')
        .send({ name: 'Updated' })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockUsersService.update).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { name: 'Updated' },
        'tenant-1',
      );
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete('/users/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(res.body).toEqual({ message: 'User deleted successfully' });
      expect(mockUsersService.remove).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'tenant-1',
      );
    });
  });
});
