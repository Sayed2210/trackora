import { SetMetadata } from '@nestjs/common';

export const DANGEROUS_ACTION_KEY = 'dangerous_action';
export const DangerousAction = (reason: string) =>
  SetMetadata(DANGEROUS_ACTION_KEY, { reason });
