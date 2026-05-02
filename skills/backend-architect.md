# Skill: Backend Architect

## Description
Design and implement NestJS backend architecture, module boundaries, dependency injection patterns, and system-level decisions.

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

## Code Patterns

### Service Pattern
```typescript
@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateShipmentDto): Promise<Shipment> {
    // Validate
    // Create
    // Emit event
    // Cache invalidate
  }
}
```

### Repository Pattern (when needed)
```typescript
@Injectable()
export class ShipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.prisma.shipment.findUnique({
      where: { trackingNumber },
    });
  }
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
- [ ] DTOs with class-validator decorators
- [ ] Proper error handling with custom exceptions
- [ ] Database transactions for multi-table operations
- [ ] Cache invalidation on mutations
- [ ] Event emission for side effects
- [ ] Audit logging for sensitive operations

## Common Pitfalls to Avoid
- Raw SQL queries (use Prisma unless performance critical)
- Circular dependencies between modules
- Synchronous external API calls in request path
- Missing database indexes on foreign keys
- N+1 query problems
- Not using transactions for financial operations

## Performance Rules
- Database queries must complete in < 50ms
- Use SELECT only needed fields
- Batch operations when possible
- Cache frequently accessed data
- Use database-level pagination

## Example Usage
User: "I need to create a new module for handling delivery zones"
→ Use this skill to design the ZoneModule with proper entities, DTOs, service, and controller following NestJS patterns.
