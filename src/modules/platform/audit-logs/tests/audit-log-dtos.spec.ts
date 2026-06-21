import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListAuditLogsQueryDto } from '../dtos';

describe('Audit log DTO validation', () => {
  it('rejects unsafe sort fields and invalid pagination', async () => {
    const dto = plainToInstance(ListAuditLogsQueryDto, {
      sortBy: 'oldValue',
      page: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sortBy')).toBe(true);
    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('validates UUID filters', async () => {
    const dto = plainToInstance(ListAuditLogsQueryDto, {
      actorUserId: 'not-a-uuid',
      resourceId: 'also-bad',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'actorUserId')).toBe(true);
    expect(errors.some((error) => error.property === 'resourceId')).toBe(true);
  });
});
