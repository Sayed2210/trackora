import {
  Assignment as PrismaAssignment,
  AssignmentType,
  AssignmentStatus,
} from '@prisma/client';

export type Assignment = PrismaAssignment;
export { AssignmentType, AssignmentStatus };
