## Architecture

### Path Aliases
TypeScript aliases are configured in `tsconfig.json`:
- `@/*` → `src/*`
- `@common/*` → `src/common/*`
- `@modules/*` → `src/modules/*`
- `@infrastructure/*` → `src/infrastructure/*`
- `@config/*` → `src/config/*`

### Layers

**`src/modules/`** — Feature modules, each self-contained with:
- `entities/` — TypeORM entities
- `repositories/` — Data access extending `AbstractRepository<T>`
- `services/` — Business logic
- `controllers/` — HTTP handlers
- `dtos/` — Input validation with class-validator
- `tests/` — Unit specs (`.spec.ts`)

**`src/infrastructure/`** — Cross-cutting infrastructure:
- `cache/` — `RedisService` (ioredis) with get/set/cache/pub-sub/distributed locks
- `queue/` — BullMQ job queues
- `email/` — `MailerService` via `@nestjs-modules/mailer`
- `database/migrations/` — TypeORM migrations

**`src/common/`** — Shared utilities:
- `entities/base.entity.ts` — Base entity with UUID `id`, `createdAt`, `updatedAt`
- `database/abstract.repository.ts` — Generic CRUD base class; all repositories extend this
- `guards/` — JWT and roles guards (global)
- `interceptors/` — Transform (response wrapper), logging, cache
- `filters/` — HTTP and WebSocket exception filters
- `decorators/` — `@Public()` (skip auth), `@Roles()`
- `pipes/` — Validation and file validation

## Module Conventions

- Entities extend `BaseEntity` from `@common/entities/base.entity` (provides `id` [uuid], `createdAt`, `updatedAt`)
- Repositories extend `AbstractRepository<T>` from `@common/database/abstract.repository`
- Soft delete: entity needs `@DeleteDateColumn({ name: 'deleted_at', nullable: true })` + use `softDelete()` from repo
- IDs are **UUID v4** — use `ParseUUIDPipe` in controller params