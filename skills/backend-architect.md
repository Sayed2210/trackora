# Skill: Backend Architect

## Description
Design and implement NestJS backend architecture, module boundaries, dependency injection patterns, and system-level decisions for Trackora.

## When to Use
- Creating new modules or services
- Designing API endpoints
- Refactoring existing code
- Performance optimization
- Choosing between architectural patterns

## Expertise Areas
- NestJS module design and dependency injection
- Prisma ORM patterns and query optimization
- PostgreSQL indexing and schema design
- Redis caching strategies
- BullMQ job processing patterns
- Event-driven architecture
- CQRS and read/write model separation

## Decision Framework
1. Does this fit the modular monolith? If not, justify why.
2. Is the database transaction safe? Financial ops must be ACID.
3. Does it handle offline scenarios? Courier PWA must work without network.
4. Is it MENA-optimized? Phone-first, Arabic RTL, EGP currency.
5. Can it scale? Indexing strategy, caching, queue usage.

## Module Structure (MODULE_CONVENTIONS)

Every feature module under `src/modules/` follows this structure:
```
module-name/
├── entities/         — Prisma model re-exports or TypeScript interfaces
├── repositories/     — Data access extending AbstractRepository<T>
├── services/         — Business logic
├── controllers/      — HTTP handlers
├── dtos/             — Input validation with class-validator
├── tests/            — Unit specs (*.spec.ts)
└── [module-name].module.ts
```

### Path Aliases
- `@/*` → `src/*`
- `@common/*` → `src/common/*`
- `@modules/*` → `src/modules/*`
- `@infrastructure/*` → `src/infrastructure/*`
- `@config/*` → `src/config/*`
- `@core/*` → `src/core/*`

## Code Patterns

### Repository Pattern (Required)
All repositories extend `AbstractRepository<T>` from `@common/database/abstract.repository`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Shipment } from '../entities/shipment.entity';

@Injectable()
export class ShipmentsRepository extends AbstractRepository<Shipment> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.shipment;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { isActive: false } });
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.delegate.findFirst({
      where: { ...this.baseWhere, trackingNumber },
    });
  }
}
```

### Service Pattern
Services use repositories, never Prisma directly:
```typescript
@Injectable()
export class ShipmentService {
  constructor(
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateShipmentDto): Promise<Shipment> {
    // Validate
    // Create via repository
    // Emit event
    // Cache invalidate
  }
}
```

### Controller Pattern
```typescript
@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  @Roles(UserRole.MERCHANT)
  async create(@Body() dto: CreateShipmentDto) { }
}
```

### Event Handler Pattern
```typescript
@OnEvent('shipment.delivered')
async handleShipmentDelivered(payload: ShipmentDeliveredEvent) {
  // Process side effects
  // Queue background jobs
}
```

## Validation Checklist
- [ ] Proper dependency injection (no direct instantiation)
- [ ] DTOs with class-validator decorators in `dtos/`
- [ ] Repository extends `AbstractRepository<T>` in `repositories/`
- [ ] Entity/type exported from `entities/`
- [ ] Proper error handling with custom exceptions
- [ ] Database transactions for multi-table operations
- [ ] Cache invalidation on mutations
- [ ] Event emission for side effects
- [ ] Audit logging for sensitive operations
- [ ] `ParseUUIDPipe` for `:id` route parameters
- [ ] `@Roles()` / `@Permissions()` on sensitive endpoints

## Common Pitfalls to Avoid
- Raw SQL queries (use Prisma unless performance critical)
- Circular dependencies between modules
- Synchronous external API calls in request path
- Missing database indexes on foreign keys
- N+1 query problems
- Not using transactions for financial operations
- Skipping the repository layer and using Prisma directly in controllers

## Performance Rules
- Database queries must complete in < 50ms
- Use SELECT only needed fields
- Batch operations when possible
- Cache frequently accessed data
- Use database-level pagination

## Example Usage
User: "I need to create a new module for handling delivery zones"
→ Use this skill to design the ZoneModule with proper entities, repositories, services, DTOs, and controller following MODULE_CONVENTIONS.
