import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../services/users.service';
import { UsersRepository } from '../repositories/users.repository';
import { User, UserRole } from '../entities/user.entity';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  phone: '01000000001',
  passwordHash: '$2a$12$hashedpasswordhere',
  role: UserRole.MERCHANT,
  name: 'Test User',
  avatarUrl: null,
  isActive: true,
  emailVerified: null,
  phoneVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let repository: UsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findActiveUsersForTenant: jest.fn().mockResolvedValue([mockUser]),
            findByIdForTenant: jest.fn().mockResolvedValue(mockUser),
            findByPhone: jest.fn().mockResolvedValue(mockUser),
            create: jest.fn().mockResolvedValue(mockUser),
            updateForTenant: jest.fn().mockResolvedValue(mockUser),
            softDeleteForTenant: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active users', async () => {
      const result = await service.findAll('tenant-1');
      expect(result).toEqual([mockUser]);
      expect(repository.findActiveUsersForTenant).toHaveBeenCalledWith(
        'tenant-1',
      );
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const result = await service.findById(mockUser.id, 'tenant-1');
      expect(result).toEqual(mockUser);
      expect(repository.findByIdForTenant).toHaveBeenCalledWith(
        mockUser.id,
        'tenant-1',
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      jest.spyOn(repository, 'findByIdForTenant').mockResolvedValueOnce(null);
      await expect(service.findById('missing-id', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPhone', () => {
    it('should return user by phone', async () => {
      const result = await service.findByPhone('01000000001');
      expect(result).toEqual(mockUser);
      expect(repository.findByPhone).toHaveBeenCalledWith('01000000001');
    });

    it('should return null for unknown phone', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(null);
      const result = await service.findByPhone('01099999999');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a user without hashing if no password', async () => {
      const data = { name: 'New User', phone: '01000000002' };
      const result = await service.create(data);
      expect(result).toEqual(mockUser);
      expect(repository.create).toHaveBeenCalledWith(data);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should hash password if provided', async () => {
      const data = {
        name: 'New User',
        phone: '01000000002',
        passwordHash: 'plain',
      };
      await service.create(data);
      expect(bcrypt.hash).toHaveBeenCalledWith('plain', 12);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed-password' }),
      );
    });
  });

  describe('update', () => {
    it('should update user and hash password if provided', async () => {
      const data = { name: 'Updated Name', passwordHash: 'newpass' };
      const result = await service.update(mockUser.id, data, 'tenant-1');
      expect(result).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 12);
      expect(repository.updateForTenant).toHaveBeenCalledWith(
        mockUser.id,
        'tenant-1',
        expect.objectContaining({ passwordHash: 'hashed-password' }),
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      jest.spyOn(repository, 'findByIdForTenant').mockResolvedValueOnce(null);
      await expect(
        service.update('missing-id', { name: 'Test' }, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      await service.remove(mockUser.id, 'tenant-1');
      expect(repository.softDeleteForTenant).toHaveBeenCalledWith(
        mockUser.id,
        'tenant-1',
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      jest.spyOn(repository, 'findByIdForTenant').mockResolvedValueOnce(null);
      await expect(service.remove('missing-id', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateCredentials', () => {
    it('should return user for valid credentials', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      const result = await service.validateCredentials(
        '01000000001',
        'password123',
      );
      expect(result).toEqual(mockUser);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        mockUser.passwordHash,
      );
    });

    it('should return null for invalid phone', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(null);
      const result = await service.validateCredentials(
        '01099999999',
        'password',
      );
      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      const result = await service.validateCredentials('01000000001', 'wrong');
      expect(result).toBeNull();
    });

    it('should return null if user has no passwordHash', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce({
        ...mockUser,
        passwordHash: null,
      });
      const result = await service.validateCredentials(
        '01000000001',
        'password',
      );
      expect(result).toBeNull();
    });
  });
});
