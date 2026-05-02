# Skill: Prisma PostgreSQL Expert

## Description
Expert in Prisma ORM, PostgreSQL database design, query optimization, migrations, and schema management for the Trackora logistics platform.

## When to Use
- Designing or modifying database schemas
- Writing complex Prisma queries
- Creating migrations
- Optimizing query performance
- Setting up indexes
- Choosing between relations and JSON fields

## Prisma Patterns

### Decimal for Money
```prisma
model Transaction {
  amount Decimal @db.Decimal(10, 2)
}
```
```typescript
// Never use number/float for money
const amount = new Decimal('450.50');
```

### JSON for Flexible Data
```prisma
model Shipment {
  address Json  // Structured but not queried directly
}
```
```typescript
// Query by JSON content (PostgreSQL specific)
const shipments = await prisma.shipment.findMany({
  where: {
    address: {
      path: ['governorate'],
      string_contains: 'Cairo'
    }
  }
});
```

### Self-Referential Relations
```prisma
model Zone {
  id       String  @id @default(uuid())
  parentId String?
  parent   Zone?   @relation("ZoneHierarchy", fields: [parentId], references: [id])
  children Zone[]  @relation("ZoneHierarchy")
}
```

### Cascade Deletes
```prisma
model ShipmentStatusLog {
  shipment   Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
}
```

## Repository Pattern with Prisma

All data access goes through repositories extending `AbstractRepository<T>`:

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

### AbstractRepository Base Class
```typescript
// src/common/database/abstract.repository.ts
export abstract class AbstractRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  protected abstract get delegate(): any;
  protected get baseWhere(): any { return {}; }

  async findAll(): Promise<T[]> {
    return this.delegate.findMany({ where: this.baseWhere });
  }

  async findById(id: string): Promise<T | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, id } });
  }

  async create(data: any): Promise<T> {
    return this.delegate.create({ data });
  }

  async update(id: string, data: any): Promise<T> {
    return this.delegate.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
```

## Query Optimization

### Avoid N+1
```typescript
// BAD: N+1 problem
const shipments = await prisma.shipment.findMany();
for (const s of shipments) {
  const merchant = await prisma.merchant.findUnique({ where: { id: s.merchantId } });
}

// GOOD: Include relation
const shipments = await prisma.shipment.findMany({
  include: { merchant: true }
});
```

### Select Only Needed Fields
```typescript
const shipments = await prisma.shipment.findMany({
  select: {
    id: true,
    trackingNumber: true,
    status: true,
    customerName: true,
  }
});
```

### Use Transactions
```typescript
await prisma.$transaction(async (tx) => {
  const wallet = await tx.wallet.findUnique({ where: { id } });
  await tx.transaction.create({ data: { ... } });
  await tx.wallet.update({ where: { id }, data: { ... } });
});
```

## Indexing Strategy

### Must-Have Indexes
```sql
-- Lookups by tracking number
CREATE INDEX idx_shipment_tracking ON "Shipment"("trackingNumber");

-- Filter by merchant + status (most common query)
CREATE INDEX idx_shipment_merchant_status ON "Shipment"("merchantId", "status");

-- Filter by courier + status
CREATE INDEX idx_shipment_courier_status ON "Shipment"("assignedCourierId", "status");

-- Time-series queries
CREATE INDEX idx_shipment_created_at ON "Shipment"("createdAt");

-- Full-text search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_shipment_search ON "Shipment" 
  USING gin(to_tsvector('simple', "addressText" || ' ' || "customerName"));
```

### Composite Indexes
```sql
-- Zone-based dispatch queries
CREATE INDEX idx_shipment_zone_status_date ON "Shipment"("zoneId", "status", "preferredDeliveryDate");

-- Transaction lookups by wallet + date
CREATE INDEX idx_transaction_wallet_date ON "Transaction"("walletId", "createdAt" DESC);
```

## Migration Best Practices

### Safe Migration Pattern
```bash
# 1. Create migration
npx prisma migrate dev --name add_courier_performance_score

# 2. Review generated SQL before applying
# Check: migrations/20240502120000_add_courier_performance_score/migration.sql

# 3. Apply to production during low-traffic window
npx prisma migrate deploy

# 4. Verify
npx prisma migrate status
```

### Backward-Compatible Changes
- **Adding columns:** Always nullable or with default
- **Adding indexes:** `CONCURRENTLY` in production
- **Renaming columns:** Add new, migrate data, remove old (3-step)
- **Dropping columns:** Mark deprecated first, remove later

### Dangerous Operations (Require Maintenance Window)
- Dropping tables
- Adding foreign keys on large tables
- Changing column types
- Adding unique constraints on existing data

## Performance Checklist
- [ ] Query completes in < 50ms (check with EXPLAIN)
- [ ] Proper indexes on WHERE, JOIN, ORDER BY columns
- [ ] No SELECT * on large tables
- [ ] Pagination on all list endpoints
- [ ] Connection pooling (PgBouncer)
- [ ] Read replicas for reporting queries
- [ ] Repositories extend AbstractRepository<T> (no Prisma in services)

## Common Issues & Solutions

### Issue: Slow count queries
**Solution:** Use estimated count for pagination
```typescript
const count = await prisma.$queryRaw`
  SELECT reltuples::BIGINT as count 
  FROM pg_class 
  WHERE relname = 'Shipment'
`;
```

### Issue: Deadlocks in concurrent updates
**Solution:** Consistent lock ordering, short transactions
```typescript
// Always lock in same order: wallet first, then shipment
await prisma.$transaction(async (tx) => {
  await tx.wallet.findUnique({ where: { id: walletId } }); // lock
  await tx.shipment.findUnique({ where: { id: shipmentId } }); // lock
});
```

### Issue: Migration fails in production
**Solution:** Use `prisma migrate deploy` (not dev). Test on staging first.

## Example Usage
User: "I need to add a new field to track courier rating by customers"
→ Use this skill to design the schema change, create a safe migration, add appropriate indexes, and create the repository following MODULE_CONVENTIONS.
