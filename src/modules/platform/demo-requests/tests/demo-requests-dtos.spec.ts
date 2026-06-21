import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DemoRequestStatus } from '@prisma/client';
import {
  ListDemoRequestsQueryDto,
  UpdateDemoRequestDto,
  DemoRequestIdParamDto,
  DemoRequestSortField,
  DemoRequestSortDirection,
} from '../dtos';

describe('Demo Requests DTO validation', () => {
  describe('ListDemoRequestsQueryDto', () => {
    it('applies defaults for page, limit, sortBy, sortOrder', () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, {});

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.sortBy).toBe(DemoRequestSortField.CREATED_AT);
      expect(dto.sortOrder).toBe(DemoRequestSortDirection.DESC);
    });

    it('rejects page < 1', async () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, { page: 0 });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejects invalid status enum', async () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, {
        status: 'INVALID_STATUS',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('accepts valid status and businessType', async () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, {
        status: DemoRequestStatus.NEW,
        businessType: 'E-commerce',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects invalid sortBy enum', async () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, {
        sortBy: 'invalidField',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
    });

    it('rejects invalid sortOrder enum', async () => {
      const dto = plainToInstance(ListDemoRequestsQueryDto, {
        sortOrder: 'up',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
    });
  });

  describe('UpdateDemoRequestDto', () => {
    it('accepts all three updatable fields', async () => {
      const dto = plainToInstance(UpdateDemoRequestDto, {
        status: DemoRequestStatus.CONTACTED,
        notes: 'Called the lead',
        contactedAt: '2026-06-20T10:00:00.000Z',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('accepts empty body (all fields optional)', async () => {
      const dto = plainToInstance(UpdateDemoRequestDto, {});

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects invalid status enum', async () => {
      const dto = plainToInstance(UpdateDemoRequestDto, {
        status: 'WRONG',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('rejects notes exceeding 5000 characters', async () => {
      const dto = plainToInstance(UpdateDemoRequestDto, {
        notes: 'x'.repeat(5001),
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });

  describe('DemoRequestIdParamDto', () => {
    it('rejects non-UUID id', async () => {
      const dto = plainToInstance(DemoRequestIdParamDto, { id: 'not-a-uuid' });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'id')).toBe(true);
    });

    it('accepts a valid UUID id', async () => {
      const dto = plainToInstance(DemoRequestIdParamDto, {
        id: '123e4567-e89b-42d3-a456-426614174000',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
