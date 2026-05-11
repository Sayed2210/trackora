# Trackora Frontend Architecture & Implementation Plan

> **Version:** 1.0
> **Date:** 2026-05-05
> **Scope:** Full-stack frontend architecture for Trackora Logistics & COD Shipment Management SaaS
> **Backend Alignment:** NestJS REST API (`/v1`) as documented in `docs/API_SPEC.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Clean Architecture Layers](#4-clean-architecture-layers)
5. [State Management](#5-state-management)
6. [API Integration & Repository Pattern](#6-api-integration--repository-pattern)
7. [Real-Time Layer](#7-real-time-layer)
8. [Auth & RBAC](#8-auth--rbac)
9. [Visual Identity & Theming](#9-visual-identity--theming)
10. [Internationalization (i18n)](#10-internationalization-i18n)
11. [Feature Design](#11-feature-design)
12. [Courier Offline-First System](#12-courier-offline-first-system)
13. [Performance & Scalability](#13-performance--scalability)
14. [Testing Strategy](#14-testing-strategy)
15. [Implementation Phases](#15-implementation-phases)
16. [Naming Conventions](#16-naming-conventions)
17. [Best Practices Checklist](#17-best-practices-checklist)

---

## 1. Executive Summary

This document defines the complete frontend architecture for Trackora, a Logistics & COD Shipment Management SaaS targeting the MENA region. The frontend is designed as an **Nx monorepo** with three distinct applications, all aligned with the existing NestJS backend API.

### Key Decisions

| Concern | Decision | Justification |
|---------|----------|---------------|
| **Monorepo Tool** | Nx 19+ | Enterprise-grade dependency graph, build caching, module boundary enforcement |
| **Framework** | Angular 18+ | Mature ecosystem, excellent TypeScript support, PWA capabilities |
| **UI Library** | PrimeNG 17+ | Native standalone support, excellent data table/chart components, built-in RTL |
| **CSS Grid** | PrimeFlex 3+ | Flexbox grid system integrated with PrimeNG ecosystem |
| **State Management** | Hybrid: NgRx (global) + Signals (feature) + Dexie (offline) | Optimal balance of predictability and performance; courier PWA cannot afford NgRx overhead on 3G |
| **Change Detection** | `OnPush` everywhere + Signals | Mandatory for performance at scale (300K daily shipments) |
| **Component Model** | Standalone components | Simplifies lazy loading, tree-shaking, cross-lib imports |
| **Maps** | Leaflet + OpenStreetMap | 100% free, no API keys, Arabic label support |
| **Real-Time** | SSE now, WebSocket ready | Backend will add WS/SSE; frontend abstracted for both |
| **Offline Storage** | Dexie.js (IndexedDB wrapper) | Clean API, TypeScript-friendly, much simpler than raw IDB |
| **i18n** | `@ngx-translate/core` + MessageFormat | Runtime switching, Arabic pluralization support |
| **Default Language** | Arabic (`ar`) | MENA-first product; English secondary |
| **Fonts** | Montserrat (headers), Open Sans (body), Cairo (Arabic) | Geometric, highly legible, optimized for dense data tables |

---

## 2. Tech Stack

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@angular/core` | 18+ | Framework |
| `@angular/common` | 18+ | Pipes, directives, common utilities |
| `@angular/router` | 18+ | Routing with standalone `loadComponent()` |
| `@angular/forms` | 18+ | Reactive forms |
| `@angular/platform-browser` | 18+ | Browser rendering |
| `@angular/service-worker` | 18+ | PWA support (courier app) |
| `primeng` | 17+ | UI component library |
| `primeflex` | 3+ | CSS flexbox grid utilities |
| `primeicons` | 7+ | Icon set |
| `@ngrx/store` | 18+ | Global state management |
| `@ngrx/effects` | 18+ | Side effects handling |
| `@ngrx/entity` | 18+ | Entity collection management |
| `@ngx-translate/core` | 15+ | Runtime translation |
| `ngx-translate-messageformat-compiler` | 7+ | ICU MessageFormat pluralization |
| `dexie` | 4+ | IndexedDB wrapper for offline store |
| `leaflet` | 1.9+ | Map rendering |
| `@types/leaflet` | 1.9+ | Leaflet TypeScript types |
| `decimal.js` | 10+ | Decimal arithmetic for financial values |
| `chart.js` | 4+ | Charts (via PrimeNG `p-chart`) |
| `rxjs` | 7+ | Reactive programming |
| `tslib` | 2+ | TypeScript runtime helpers |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nx` | 19+ | Monorepo management |
| `@nx/angular` | 19+ | Nx Angular plugin |
| `@nx/jest` | 19+ | Jest configuration for Nx |
| `@nx/playwright` | 19+ | E2E testing |
| `jest` | 29+ | Unit testing |
| `@angular-devkit/build-angular` | 18+ | Angular CLI builder |
| `typescript` | 5.4+ | TypeScript compiler |
| `eslint` | 9+ | Linting |
| `@nx/eslint-plugin` | 19+ | Nx ESLint rules |
| `prettier` | 3+ | Code formatting |

---

## 3. Monorepo Structure

```
trackora-frontend/
├── apps/
│   ├── courier/                    # PWA: mobile-first, offline-first, minimal bundle
│   ├── merchant/                   # Merchant portal: dashboards, analytics, wallet
│   └── admin/                      # Admin dashboard: dispatch, operations, finance
│
├── libs/
│   ├── core/                       # Singleton services, auth, API, interceptors, state
│   │   ├── auth/                   # JWT auth, token storage, refresh logic
│   │   ├── api/                    # ApiClient, interceptors, error mapping
│   │   ├── realtime/               # SSE/WebSocket abstraction layer
│   │   ├── state/                  # NgRx global store slices
│   │   └── config/                 # App config, language service, feature flags
│   │
│   ├── shared/
│   │   ├── domain/                 # Pure TypeScript: entities, enums, business rules
│   │   ├── ui/                     # PrimeNG wrappers, custom components, pipes, directives
│   │   ├── utils/                  # Validators, formatters, pure helper functions
│   │   └── data-access/            # Repository pattern, mappers, DTOs
│   │
│   └── features/
│       ├── auth-feature/           # Login, password reset, settings
│       ├── shipments-feature/      # Shipment CRUD, list, detail, timeline, bulk upload
│       ├── assignments-feature/    # Dispatch board, manual/auto assignment
│       ├── courier-tasks-feature/  # Task list, status updates, offline sync
│       ├── wallet-feature/         # Balance view, transaction history
│       ├── payouts-feature/        # Payout requests, approval workflow
│       ├── tracking-feature/       # Public tracking page (no auth)
│       └── analytics-feature/      # Dashboards, charts, reports
│
├── tools/
│   └── generators/                 # Custom Nx schematics for feature scaffolding
│
├── nx.json                         # Nx configuration
├── tsconfig.base.json              # Base TypeScript config with path aliases
└── package.json
```

### Nx Module Boundaries

Enforced via ESLint (`@nx/enforce-module-boundaries`):

```json
{
  "sourceTag": "type:app",
  "onlyDependOnLibsWithTags": ["type:feature", "type:core", "type:shared"]
},
{
  "sourceTag": "type:feature",
  "onlyDependOnLibsWithTags": ["type:shared", "type:core"]
},
{
  "sourceTag": "type:shared",
  "onlyDependOnLibsWithTags": ["type:shared"]
},
{
  "sourceTag": "scope:courier",
  "onlyDependOnLibsWithTags": ["scope:shared", "scope:courier"]
}
```

### Path Aliases (`tsconfig.base.json`)

```json
{
  "paths": {
    "@trackora/core": ["libs/core/src/index.ts"],
    "@trackora/shared/domain": ["libs/shared/domain/src/index.ts"],
    "@trackora/shared/ui": ["libs/shared/ui/src/index.ts"],
    "@trackora/shared/utils": ["libs/shared/utils/src/index.ts"],
    "@trackora/shared/data-access": ["libs/shared/data-access/src/index.ts"],
    "@trackora/auth-feature": ["libs/features/auth-feature/src/index.ts"],
    "@trackora/shipments-feature": ["libs/features/shipments-feature/src/index.ts"],
    "@trackora/assignments-feature": ["libs/features/assignments-feature/src/index.ts"],
    "@trackora/courier-tasks-feature": ["libs/features/courier-tasks-feature/src/index.ts"],
    "@trackora/wallet-feature": ["libs/features/wallet-feature/src/index.ts"],
    "@trackora/payouts-feature": ["libs/features/payouts-feature/src/index.ts"],
    "@trackora/tracking-feature": ["libs/features/tracking-feature/src/index.ts"],
    "@trackora/analytics-feature": ["libs/features/analytics-feature/src/index.ts"]
  }
}
```

---

## 4. Clean Architecture Layers

Every feature library follows strict Clean Architecture with four layers:

### Layer Dependency Rule

```
Presentation → Application → Infrastructure → Domain
```

No layer may skip or go backward. The Domain layer has zero Angular dependencies.

### 4.1 Domain Layer (`domain/`)

Contains:
- **Entities**: Pure TypeScript interfaces representing business objects
- **Enums**: Mirrors backend enums exactly (`ShipmentStatus`, `TransactionType`, etc.)
- **Value Objects**: `Address`, `Money` (using Decimal.js), `PhoneNumber`
- **Business Rules**: State machine validator, Egyptian phone regex, COD validation rules

**Key Rule**: No Angular imports. No RxJS. Pure TypeScript only.

### 4.2 Application Layer (`application/`)

Contains:
- **Facades**: Single entry point for UI layer. Exposes readonly Signals.
- **Use Cases**: Encapsulate business operations (CreateShipment, UpdateStatus, etc.)

**Key Rule**: Facades only call repositories. They never call `HttpClient` directly.

### 4.3 Infrastructure Layer (`infrastructure/`)

Contains:
- **Repositories**: HTTP calls via `ApiClient`. One per domain entity.
- **Mappers**: Convert DTOs → Domain entities and vice versa.
- **DTOs**: TypeScript interfaces matching backend request/response shapes.
- **Offline Store**: Dexie database schema and operations (courier feature only).

**Key Rule**: DTOs never leak past the repository. Mappers are mandatory.

### 4.4 Presentation Layer (`presentation/`)

Contains:
- **Pages**: Smart components (routed). Inject facades.
- **Components**: Dumb components. Receive data via `@Input()` signals.
- **Dialogs**: Modal overlays for confirmations, forms, detail views.

**Key Rule**: Components never inject repositories. Only facades.

---

## 5. State Management

### 5.1 Global State (NgRx Store)

Managed in `libs/core/state/`. Only for cross-cutting concerns:

| Store Slice | Contents | Persistence |
|-------------|----------|-------------|
| `auth` | User profile, access token, refresh token | `sessionStorage` (access), `localStorage` encrypted (refresh) |
| `layout` | Sidebar open/closed, theme, direction (LTR/RTL), language | `localStorage` |
| `notifications` | Toast queue, unread notification count | In-memory |
| `permissions` | Computed permission matrix from JWT | Derived from auth slice |

### 5.2 Feature State (Angular Signals)

Each feature exposes a Facade service using `signal()`:

```typescript
@Injectable()
export class ShipmentFacade {
  // Private writable signals
  private readonly _shipments = signal<Shipment[]>([]);
  private readonly _loading = signal(false);
  private readonly _filters = signal<ShipmentFilters>({});
  private readonly _meta = signal<PaginationMeta | null>(null);

  // Public readonly signals
  readonly shipments = this._shipments.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly meta = this._meta.asReadonly();

  // Computed signals
  readonly hasMorePages = computed(() => {
    const m = this._meta();
    return m ? m.page < m.totalPages : false;
  });

  constructor(private readonly repo: ShipmentRepository) {}

  async loadShipments(filters?: Partial<ShipmentFilters>): Promise<void> {
    this._loading.set(true);
    const merged = { ...this._filters(), ...filters };
    this._filters.set(merged);

    const result = await firstValueFrom(this.repo.findAll(merged));
    this._shipments.set(result.data);
    this._meta.set(result.meta ?? null);
    this._loading.set(false);
  }

  // Optimistic update for courier status changes
  optimisticUpdateStatus(id: string, newStatus: ShipmentStatus): void {
    this._shipments.update(list =>
      list.map(s => s.id === id ? { ...s, status: newStatus } : s)
    );
  }

  rollbackStatus(id: string, previousStatus: ShipmentStatus): void {
    this._shipments.update(list =>
      list.map(s => s.id === id ? { ...s, status: previousStatus } : s)
    );
  }
}
```

### 5.3 Offline State (Dexie.js)

Courier app uses a local Dexie database for offline operations. See [Section 12](#12-courier-offline-first-system) for full specification.

---

## 6. API Integration & Repository Pattern

### 6.1 Central API Client

```typescript
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly baseUrl = '';

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, { params })
      .pipe(map(res => this.unwrap(res)));
  }

  post<T>(path: string, body: unknown): Observable<T> { ... }
  patch<T>(path: string, body: unknown): Observable<T> { ... }
  delete<T>(path: string): Observable<T> { ... }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (!res.success) throw ApiError.fromResponse(res.error!);
    return res.data;
  }
}
```

### 6.2 API Envelope Types

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta | CursorMeta;
  error?: ApiError;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CursorMeta {
  limit: number;
  nextCursor?: string;
  hasNextPage: boolean;
}

interface ApiError {
  code: string;
  message: string;
  details?: FieldError[];
}

interface FieldError {
  field: string;
  message: string;
}
```

### 6.3 HTTP Interceptors

| Order | Interceptor | Responsibility |
|-------|-------------|----------------|
| 1 | `AuthInterceptor` | Attach `Authorization: Bearer <token>`. Queue requests during token refresh. Handle 401 → trigger refresh or logout. |
| 2 | `BaseUrlInterceptor` | Prepend `/v1` to relative paths |
| 3 | `ErrorInterceptor` | Map API error envelope → typed `ApiError`. Handle 409 (conflict toast), 422 (field errors), 429 (rate limit warning). |
| 4 | `RetryInterceptor` | Exponential backoff (100ms, 200ms, 400ms) for 5xx errors. No retry for 4xx. |
| 5 | `OfflineInterceptor` | **Courier app only.** Detect `navigator.onLine === false`, queue in Dexie instead of HTTP. |

### 6.4 Repository Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ShipmentRepository {
  constructor(private api: ApiClient) {}

  findAll(query: ShipmentQuery): Observable<PaginatedResult<Shipment>> {
    const params = toHttpParams(query);
    return this.api.get<PaginatedResult<ShipmentResponseDto>>('/shipments', params)
      .pipe(map(res => ({
        data: res.data.map(ShipmentMapper.toDomain),
        meta: res.meta
      })));
  }

  findById(id: string): Observable<Shipment> {
    return this.api.get<ShipmentResponseDto>(`/shipments/${id}`)
      .pipe(map(ShipmentMapper.toDomain));
  }

  create(dto: CreateShipmentDto): Observable<Shipment> {
    return this.api.post<ShipmentResponseDto>('/shipments', dto)
      .pipe(map(ShipmentMapper.toDomain));
  }

  updateStatus(id: string, dto: UpdateShipmentStatusDto): Observable<Shipment> {
    return this.api.patch<ShipmentResponseDto>(`/shipments/${id}/status`, dto)
      .pipe(map(ShipmentMapper.toDomain));
  }

  getTimeline(id: string): Observable<TimelineEvent[]> {
    return this.api.get<TimelineEventDto[]>(`/shipments/${id}/timeline`)
      .pipe(map(list => list.map(TimelineMapper.toDomain)));
  }
}
```

**Mapping Rule**: Every repository has a dedicated Mapper class. DTOs never leak past the infrastructure layer.

---

## 7. Real-Time Layer (Socket.IO)

### 7.1 Architecture Overview

The backend exposes a Socket.IO gateway at namespace `/ws` with JWT authentication at the handshake level. The frontend uses `socket.io-client` directly (no Angular wrapper) paired with RxJS for typed event streams.

### 7.2 Backend Contract

**Connection:** `wss://api.trackora.com/ws`  
**Auth:** Bearer JWT via `io({ auth: { token: 'Bearer <jwt>' } })`  
**Auto-joined rooms** (server assigns on connect based on JWT role):

| Room | Who |
|------|-----|
| `merchant:{merchantId}` | Merchant users |
| `courier:{courierId}` | Courier users |
| `admin:dashboard` | SUPER_ADMIN, OPERATIONS_MANAGER, FINANCE_ADMIN |
| `user:{userId}` | All authenticated users |

**Server → Client events:**

| Event | Target Room | Payload |
|---|---|---|
| `connection:established` | Direct | `{ userId, role }` |
| `error` | Direct | `{ message }` |
| `shipment:status_updated` | merchant, courier, shipment | `{ shipmentId, trackingNumber, previousStatus, newStatus, codAmount, type, updatedAt }` |
| `shipment:created` | merchant | `{ shipmentId, trackingNumber, status, codAmount, type }` |
| `assignment:created` | courier | `{ assignmentId, shipmentId, trackingNumber, customerName, addressText, codAmount, assignmentType }` |
| `assignment:cancelled` | courier | `{ assignmentId, trackingNumber, reason }` |
| `wallet:balance_updated` | merchant | `{ walletId, merchantId, balance, transactionType, amount, runningBalance }` |
| `admin:stats_updated` | admin:dashboard | `{ activeShipments, deliveredToday, failedToday, couriersAvailable, codCollectedToday }` |
| `subscribed` | Direct | `{ room }` |
| `unsubscribed` | Direct | `{ room }` |
| `sync:missed:complete` | Direct | `{ count }` |

**Client → Server events:**

| Event | Payload | Purpose |
|---|---|---|
| `subscribe:tracking` | `{ trackingNumber }` | Join `shipment:{trackingNumber}` room |
| `unsubscribe:tracking` | `{ trackingNumber }` | Leave tracking room |
| `sync:missed` | `{ lastEventId, rooms? }` | Replay events since last disconnect |

### 7.3 TypeScript Event Interfaces

```typescript
// libs/shared/domain/src/lib/realtime-events.ts

export interface ShipmentStatusChangedEvent {
  shipmentId: string;
  trackingNumber: string;
  merchantId: string;
  courierId?: string;
  previousStatus: ShipmentStatus;
  newStatus: ShipmentStatus;
  codAmount: number;
  type: ShipmentType;
  updatedAt: string;
}

export interface ShipmentCreatedEvent {
  shipmentId: string;
  trackingNumber: string;
  merchantId: string;
  status: ShipmentStatus;
  codAmount: number;
  type: ShipmentType;
}

export interface AssignmentCreatedEvent {
  assignmentId: string;
  shipmentId: string;
  trackingNumber: string;
  customerName: string;
  addressText: string;
  codAmount: string;
  assignmentType: string;
}

export interface AssignmentCancelledEvent {
  assignmentId: string;
  trackingNumber: string;
  reason: string;
}

export interface WalletBalanceUpdatedEvent {
  walletId: string;
  merchantId: string;
  balance: number;
  transactionType: string;
  amount: number;
  runningBalance: number;
}

export interface AdminStatsUpdatedEvent {
  activeShipments: number;
  deliveredToday: number;
  failedToday: number;
  couriersAvailable: number;
  codCollectedToday: number;
}
```

### 7.4 Core Service: WebSocketService

```typescript
// libs/core/realtime/src/lib/websocket.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '@trackora/core/auth';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly _status$ = new BehaviorSubject<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  readonly status$ = this._status$.asObservable();

  private lastEventId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly auth: AuthService) {}

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.auth.getAccessToken();
    if (!token) {
      console.warn('[WS] No token available, skipping connection');
      return;
    }

    this.socket = io('/ws', {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this._status$.next('connected');
      this.requestMissedEvents();
    });

    this.socket.on('disconnect', (reason) => {
      this._status$.next('disconnected');
      if (reason === 'io server disconnect') {
        // Server forced disconnect — may need token refresh
        this.handleServerDisconnect();
      }
    });

    this.socket.on('reconnecting', () => {
      this._status$.next('reconnecting');
    });

    this.socket.on('connection:established', ({ userId, role }) => {
      console.log(`[WS] Connected as ${role} (${userId})`);
    });

    this.socket.on('error', ({ message }) => {
      console.error('[WS] Server error:', message);
      if (message === 'Invalid or expired token') {
        this.refreshAndReconnect();
      }
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._status$.next('disconnected');
  }

  emit(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  on<T>(event: string, handler: (data: T) => void): void {
    this.socket?.on(event, handler as (data: unknown) => void);
  }

  off<T>(event: string, handler: (data: T) => void): void {
    this.socket?.off(event, handler as (data: unknown) => void);
  }

  subscribeToTracking(trackingNumber: string): void {
    this.emit('subscribe:tracking', { trackingNumber });
  }

  unsubscribeFromTracking(trackingNumber: string): void {
    this.emit('unsubscribe:tracking', { trackingNumber });
  }

  private requestMissedEvents(): void {
    if (!this.lastEventId) return;
    this.emit('sync:missed', { lastEventId });
  }

  private handleServerDisconnect(): void {
    this.reconnectTimer = setTimeout(() => this.connect(), 3000);
  }

  private async refreshAndReconnect(): Promise<void> {
    try {
      await this.auth.refreshToken();
      this.connect();
    } catch {
      this.auth.logout();
    }
  }

  updateLastEventId(eventId: string): void {
    this.lastEventId = eventId;
    localStorage.setItem('ws:lastEventId', eventId);
  }

  ngOnDestroy(): void {
    this.disconnect();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}
```

### 7.5 Typed Event Service: WebSocketEventsService

```typescript
// libs/core/realtime/src/lib/websocket-events.service.ts
import { Injectable } from '@angular/core';
import { Observable, fromEventPattern } from 'rxjs';
import { shareReplay, map } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';
import {
  ShipmentStatusChangedEvent,
  ShipmentCreatedEvent,
  AssignmentCreatedEvent,
  AssignmentCancelledEvent,
  WalletBalanceUpdatedEvent,
  AdminStatsUpdatedEvent,
} from '@trackora/shared/domain';

@Injectable({ providedIn: 'root' })
export class WebSocketEventsService {
  private readonly _shipmentStatusUpdated$: Observable<ShipmentStatusChangedEvent>;
  private readonly _shipmentCreated$: Observable<ShipmentCreatedEvent>;
  private readonly _assignmentCreated$: Observable<AssignmentCreatedEvent>;
  private readonly _assignmentCancelled$: Observable<AssignmentCancelledEvent>;
  private readonly _walletBalanceUpdated$: Observable<WalletBalanceUpdatedEvent>;
  private readonly _adminStatsUpdated$: Observable<AdminStatsUpdatedEvent>;

  constructor(private readonly ws: WebSocketService) {
    this._shipmentStatusUpdated$ = this.createEvent$('shipment:status_updated');
    this._shipmentCreated$ = this.createEvent$('shipment:created');
    this._assignmentCreated$ = this.createEvent$('assignment:created');
    this._assignmentCancelled$ = this.createEvent$('assignment:cancelled');
    this._walletBalanceUpdated$ = this.createEvent$('wallet:balance_updated');
    this._adminStatsUpdated$ = this.createEvent$('admin:stats_updated');
  }

  get shipmentStatusUpdated$(): Observable<ShipmentStatusChangedEvent> {
    return this._shipmentStatusUpdated$;
  }

  get shipmentCreated$(): Observable<ShipmentCreatedEvent> {
    return this._shipmentCreated$;
  }

  get assignmentCreated$(): Observable<AssignmentCreatedEvent> {
    return this._assignmentCreated$;
  }

  get assignmentCancelled$(): Observable<AssignmentCancelledEvent> {
    return this._assignmentCancelled$;
  }

  get walletBalanceUpdated$(): Observable<WalletBalanceUpdatedEvent> {
    return this._walletBalanceUpdated$;
  }

  get adminStatsUpdated$(): Observable<AdminStatsUpdatedEvent> {
    return this._adminStatsUpdated$;
  }

  get connectionStatus$(): Observable<'connected' | 'disconnected' | 'reconnecting'> {
    return this.ws.status$;
  }

  subscribeToTracking(trackingNumber: string): void {
    this.ws.subscribeToTracking(trackingNumber);
  }

  unsubscribeFromTracking(trackingNumber: string): void {
    this.ws.unsubscribeFromTracking(trackingNumber);
  }

  private createEvent$<T>(eventName: string): Observable<T> {
    return fromEventPattern<T>(
      (handler) => this.ws.on(eventName, handler),
      (handler) => this.ws.off(eventName, handler)
    ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }
}
```

### 7.6 Connection Lifecycle Hook

```typescript
// libs/core/realtime/src/lib/websocket-connection.guard.ts
import { Injectable } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { WebSocketService } from './websocket.service';
import { AuthService } from '@trackora/core/auth';

export const websocketConnectionGuard: CanActivateFn = () => {
  const ws = inject(WebSocketService);
  const auth = inject(AuthService);

  if (auth.isAuthenticated()) {
    ws.connect();
  }

  auth.user$.subscribe((user) => {
    if (user) ws.connect();
    else ws.disconnect();
  });

  return true;
};
```

### 7.7 Platform-Specific Consumption

**Merchant Dashboard:**

| Component / Page | Subscribes To | UI Effect |
|---|---|---|
| Shipment List | `shipmentStatusUpdated$` | Animate status badge, toast notification |
| Shipment Detail | `subscribeToTracking(trackingNumber)` → `shipmentStatusUpdated$` | Live timeline updates |
| Wallet Page | `walletBalanceUpdated$` | Flash balance, update transaction list |
| Notifications Bell | All events filtered to `user:{userId}` | Increment badge counter |

**Courier PWA:**

| Component / Page | Subscribes To | UI Effect |
|---|---|---|
| Task List | `assignmentCreated$`, `assignmentCancelled$` | New task slides in, cancelled greys out |
| Active Delivery | `shipmentStatusUpdated$` | Live status update |
| Notification Popup | `assignmentCreated$` | Vibrate + sound + Arabic toast "طلب توصيل جديد" |
| Offline Queue | `connectionStatus$` | Show offline banner, queue updates |

**Admin Dashboard:**

| Component / Page | Subscribes To | UI Effect |
|---|---|---|
| Dashboard Stats | `adminStatsUpdated$` | Animate counters |
| Live Map | `shipmentStatusUpdated$` | Move pins, update colors |
| Monitor | All events | Real-time event log |

### 7.8 Offline / Reconnection Strategy (Courier PWA)

```
Offline detected (navigator.onLine = false)
  → Show "Offline Mode" banner
  → Queue status updates in Dexie
  → Socket.IO auto-attempts reconnect with backoff

Back online (connection:established fired)
  → Emit sync:missed with lastEventId from localStorage
  → Replay queued status updates via HTTP POST /shipments/:id/status
  → Dismiss "Offline Mode" banner
```

Store `lastEventId` in `localStorage` — every received event updates this value. On reconnect, send `sync:missed` to fill the gap.

### 7.9 Connection Status UI

```typescript
// libs/shared/ui/src/lib/connection-indicator/connection-indicator.component.ts
import { Component, inject } from '@angular/core';
import { WebSocketEventsService } from '@trackora/core/realtime';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-connection-indicator',
  standalone: true,
  template: `
    <div class="indicator" [class]="status">
      <span class="dot"></span>
      <span class="label">{{ label }}</span>
    </div>
  `,
  styles: [`
    .indicator { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .connected .dot { background: #22C55E; }
    .reconnecting .dot { background: #F59E0B; animation: pulse 1s infinite; }
    .disconnected .dot { background: #EF4444; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `]
})
export class ConnectionIndicatorComponent {
  private readonly ws = inject(WebSocketEventsService);
  private readonly snackBar = inject(MatSnackBar);

  status: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  label = '';

  constructor() {
    this.ws.connectionStatus$.subscribe((s) => {
      this.status = s;
      this.label = s === 'connected' ? 'متصل' : s === 'reconnecting' ? 'جاري الاتصال...' : 'غير متصل';
      if (s === 'disconnected') {
        this.snackBar.open('انقطع الاتصال بالخادم', 'إغلاق', { duration: 5000 });
      }
    });
  }
}
```

### 7.10 Package Dependencies

```bash
npm install socket.io-client
npm install -D @types/socket.io-client
```

### 7.11 Service Worker Config

Add to `ngsw-config.json`:

```json
{
  "externalUrls": [
    "https://api.trackora.com/ws"
  ]
}
```

The service worker should NOT cache WebSocket traffic — only ensure the PWA shell loads offline.

### 7.12 Event Consumption Matrix

| Event | Merchant | Courier | Admin |
|-------|----------|---------|-------|
| `shipment:status_updated` | Toast + refresh list | Refresh active task | Update map + dispatch board |
| `shipment:created` | Flash new row | — | — |
| `assignment:created` | — | Vibrate + new task card | Remove from unassigned |
| `assignment:cancelled` | — | Grey out task | Return to unassigned |
| `wallet:balance_updated` | Flash balance | — | — |
| `admin:stats_updated` | — | — | Animate KPI counters |

---

## 8. Auth & RBAC

### 8.1 JWT Token Strategy

| Token | Storage | TTL | Notes |
|-------|---------|-----|-------|
| Access Token | `sessionStorage` + memory | 15 minutes | Survives refresh, not XSS-persistent |
| Refresh Token | `localStorage` (encrypted) | 7 days | Encrypted with `crypto.subtle` + device fingerprint |

### 8.2 Auth Service

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly roles = computed(() => this._user()?.roles ?? []);
  readonly permissions = computed(() => this._user()?.permissions ?? []);

  hasPermission(permission: Permission): boolean {
    return this.permissions().includes(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }
}
```

### 8.3 Route Guards

```typescript
// Role-based guard
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn =>
  () => inject(AuthService).hasAnyRole(allowedRoles);

// Permission-based guard (preferred)
export const permissionGuard = (permission: Permission): CanActivateFn =>
  () => inject(AuthService).hasPermission(permission);
```

### 8.4 Permission-Based UI Directive

```typescript
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  @Input() set appHasPermission(permission: Permission) {
    this.viewContainer.clear();
    if (this.auth.hasPermission(permission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
```

**Usage:**
```html
<button pButton *appHasPermission="'shipments:create'">
  {{ 'shipments.create' | translate }}
</button>
```

---

## 9. Visual Identity & Theming

### 9.1 Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary Tech Blue | `#001F3F` | Headers, navigation, primary icons, brand authority |
| Active Coral Red | `#FF6B6B` | CTAs, critical buttons, alerts, notifications, accents |
| Dark Text Gray | `#333333` | Primary body text (reduces eye strain vs pure black) |
| Light Grid Gray | `#F5F5F5` | Section backgrounds, card backgrounds, table row alternation |

### 9.2 PrimeNG Theme Override

PrimeNG uses CSS variables. We override the built-in Lara theme:

```scss
// libs/shared/ui/primeng-theme/trackora-theme.scss
:root {
  // Brand
  --trackora-primary: #001F3F;
  --trackora-primary-light: #003366;
  --trackora-primary-contrast: #FFFFFF;
  --trackora-accent: #FF6B6B;
  --trackora-accent-hover: #E05555;
  --trackora-accent-contrast: #FFFFFF;

  // Neutrals
  --trackora-text: #333333;
  --trackora-text-secondary: #666666;
  --trackora-bg: #FFFFFF;
  --trackora-surface: #F5F5F5;
  --trackora-border: #E0E0E0;

  // Semantic
  --trackora-success: #22C55E;
  --trackora-warning: #F59E0B;
  --trackora-danger: #EF4444;
  --trackora-info: #3B82F6;

  // PrimeNG overrides
  --primary-color: var(--trackora-primary);
  --primary-color-text: var(--trackora-primary-contrast);
  --highlight-bg: rgba(0, 31, 63, 0.08);
  --surface-ground: var(--trackora-bg);
  --surface-section: var(--trackora-surface);
  --text-color: var(--trackora-text);
  --text-color-secondary: var(--trackora-text-secondary);
}
```

### 9.3 Typography

| Purpose | Font | Weights | Fallback |
|---------|------|---------|----------|
| Brand / Headers | Montserrat | 400, 500, 600, 700 | system-ui, sans-serif |
| Body / Tables | Open Sans | 400, 500, 600, 700 | system-ui, sans-serif |
| Arabic (all contexts) | Cairo | 400, 500, 600, 700 | Tahoma, Arial |

```scss
// styles.scss
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap');

:root {
  --font-header: 'Montserrat', 'Cairo', system-ui, sans-serif;
  --font-body: 'Open Sans', 'Cairo', system-ui, sans-serif;
}

[dir="rtl"] {
  --font-header: 'Cairo', 'Montserrat', system-ui, sans-serif;
  --font-body: 'Cairo', 'Open Sans', system-ui, sans-serif;
}
```

---

## 10. Internationalization (i18n)

### 10.1 Strategy

- **Library**: `@ngx-translate/core` + `ngx-translate-messageformat-compiler`
- **Why not `$localize`**: Requires build per locale; too slow for iteration
- **Why MessageFormat**: Arabic has complex pluralization (zero/one/two/few/many/other)
- **Default language**: Arabic (`ar`) — MENA-first product
- **Fallback**: English (`en`)

### 10.2 Translation File Structure

```
assets/i18n/
├── en.json              # Source of truth
├── ar.json              # Arabic translation
└── ar-EG.json           # Egypt-specific overrides
```

### 10.3 Language Service

```typescript
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly _lang = signal<'en' | 'ar'>('ar');
  readonly lang = this._lang.asReadonly();
  readonly isRtl = computed(() => this._lang() === 'ar');
  readonly dir = computed(() => this.isRtl() ? 'rtl' : 'ltr');

  setLanguage(lang: 'en' | 'ar'): void {
    this._lang.set(lang);
    this.translate.use(lang);
    document.documentElement.dir = this.dir();
    document.documentElement.lang = lang;
  }
}
```

### 10.4 RTL Handling

| Aspect | Implementation |
|--------|----------------|
| HTML dir | `<html dir="{{ dir$ | async }}">` toggled by LanguageService |
| PrimeNG | Built-in RTL support via `p-dir="rtl"` or global CSS |
| Layouts | CSS logical properties: `margin-inline-start/end`, `padding-inline`, `text-align: start` |
| Tables | PrimeNG `p-table` auto-handles RTL |
| Charts | Chart.js detects RTL when `dir="rtl"` on canvas parent |
| Dates | `Intl.DateTimeFormat` with `ar-EG` locale |
| Numbers | Arabic-Indic numerals (`١٬٢٣٤٫٥٦`) in Arabic mode |

---

## 11. Feature Design

### 11.1 Shipment Feature

**Domain:**
- Entities: `Shipment`, `Address`, `TimelineEvent`, `RiskScore`
- Enums: `ShipmentStatus`, `ShipmentType`, `ReturnReason`
- Rules: `ShipmentStateMachine` (mirrors backend transition matrix exactly)

**Application:**
- `ShipmentFacade`: manages shipment list, filters, pagination, selection
- `CreateShipmentUseCase`: validates form, calculates risk preview, submits
- `BulkUploadUseCase`: handles file upload, job polling, progress tracking

**Presentation:**
- `ShipmentListPage`: PrimeNG `p-table` with virtual scroll, lazy loading, filters
- `ShipmentDetailPage`: Timeline visualization using `p-timeline`, map with Leaflet
- `CreateShipmentPage`: Reactive form with Egyptian phone validation, address geocoding preview
- `BulkUploadPage`: Drag-drop file upload, progress polling, results table

**Key Validations:**
- Phone: 11 digits, starts with `01`
- COD amount: required if `type === 'COD'`, must be > 0
- Landmark: required if geocoding confidence < 0.7
- Address: governorate and city required

### 11.2 Assignment Feature (Admin)

**Presentation:**
- `DispatchBoardPage`: Drag-and-drop interface (CDK Drag/Drop or PrimeNG `p-pickList`)
- Left panel: Unassigned shipments (filterable by zone, risk, COD amount)
- Right panel: Active couriers with capacity indicators (`p-meterGroup`)
- Real-time updates via SSE

**Domain Rules:**
- Can only assign shipments with `status === PENDING`
- Courier must be `isActive && isAvailable`
- Courier active tasks must be < `maxDailyCapacity * 0.9` (90% buffer)
- One active assignment per shipment

### 11.3 Courier Tasks Feature

**Offline Store:**
- Dexie database: `pending_updates`, `cached_tasks`, `cash_log`, `app_state`, `photo_uploads`
- Sync service: queues updates, retries with exponential backoff, handles conflicts

**Presentation:**
- `TaskListPage`: Swipeable cards, offline banner, pending count badge
- `TaskDetailPage`: Customer info (phone masked), address, COD amount, map
- `StatusUpdatePage`: Bottom sheet with OTP input, photo capture, signature pad, COD confirmation

**Status Update Flow:**
1. Courier selects status (DELIVERED / FAILED / POSTPONED)
2. If COD delivery: OTP input (4 digits, max 3 attempts)
3. If DELIVERED: COD amount confirmation, photo capture, signature pad, GPS
4. Optimistic UI update → queue in Dexie
5. If online: trigger immediate sync
6. If offline: show "Saved offline" toast, register background sync

**Phone Masking:**
- Display format: `01xx*****23`
- Full phone revealed only after courier taps "On The Way"

### 11.4 Wallet Feature

**Domain:**
- Entities: `Wallet`, `Transaction`, `TransactionType`
- Financial rule: All monetary values use `Decimal` (never `number`)

**Presentation:**
- `WalletPage`: Balance card, transaction list, financial breakdown
- `BalanceCard`: Shows available balance, pending balance, total credited/debited
- `TransactionList`: PrimeNG `p-table` with infinite scroll, color-coded amounts
- `TransactionFilters`: Chips by `TransactionType` (COD_CREDIT, COMMISSION_DEBIT, etc.)

**Transaction Colors:**
- Credit (positive): Green `#22C55E`
- Debit (negative): Red `#EF4444`
- Neutral: Gray `#666666`

### 11.5 Payouts Feature

**Merchant Flow:**
- `RequestPayoutPage`: Form with amount validation (`>= 500 EGP`, `<= available balance`), method selection
- `PayoutListPage`: Status timeline (PENDING → APPROVED → PROCESSING → COMPLETED)

**Admin Flow:**
- `PayoutApprovalPage`: Table with approve/reject actions, bulk approval for finance team
- Status badges: PrimeNG `p-tag` with severity mapping

### 11.6 Tracking Feature (Public)

- No authentication required
- Route: `/tracking/:trackingNumber`
- `PublicTrackingPage`: Timeline visualization, estimated delivery, merchant name
- Minimal bundle: lazy-loaded, can be code-split as micro-frontend if needed

### 11.7 Analytics Feature

**Merchant Dashboard:**
- KPI cards: Total shipments, delivery rate %, avg COD, wallet balance
- `p-chart` line: COD collection trend (7/30/90 days)
- `p-chart` pie: Return reasons breakdown
- `p-chart` bar: Zone performance comparison
- Recent activity feed: `p-timeline`

**Admin Dashboard:**
- Operations KPIs: Today's shipments created/delivered/failed, COD collected
- Courier status: Online / offline / on-delivery counts
- Alerts panel: Cash risk warnings (courier held > limit), failed delivery spikes
- Real-time updates via SSE

---

## 12. Courier Offline-First System

### 12.1 Dexie Database Schema

```typescript
export class CourierDatabase extends Dexie {
  pendingUpdates!: Table<PendingUpdate, string>;
  cachedTasks!: Table<CachedTask, string>;
  cashLog!: Table<CashLogEntry, string>;
  appState!: Table<AppStateEntry, string>;
  photoUploads!: Table<PhotoUpload, string>;

  constructor() {
    super('TrackoraCourierDB');
    this.version(1).stores({
      pendingUpdates: 'id, shipmentId, syncStatus, createdAt',
      cachedTasks: 'shipmentId, status, orderInRoute',
      cashLog: 'id, type, synced, timestamp',
      appState: 'key',
      photoUploads: 'id, shipmentId, status, createdAt'
    });
  }
}
```

### 12.2 Pending Update Interface

```typescript
interface PendingUpdate {
  id: string;                    // UUID generated locally
  shipmentId: string;
  action: 'STATUS_UPDATE' | 'CASH_COLLECTION' | 'NOTE_ADDED' | 'PHOTO_UPLOAD';
  payload: {
    status?: ShipmentStatus;
    collectedCash?: number;
    notes?: string;
    photoUrl?: string;
    signatureUrl?: string;
    gpsLocation?: { lat: number; lng: number };
    timestamp: string;           // ISO 8601
  };
  retryCount: number;            // 0-5
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  createdAt: number;             // Unix timestamp (ms)
}
```

### 12.3 Offline Store Service

```typescript
@Injectable()
export class CourierOfflineStore {
  private db = new CourierDatabase();

  async queueStatusUpdate(
    shipmentId: string,
    payload: StatusUpdatePayload
  ): Promise<void> {
    const update: PendingUpdate = {
      id: crypto.randomUUID(),
      shipmentId,
      action: 'STATUS_UPDATE',
      payload: { ...payload, timestamp: new Date().toISOString() },
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: Date.now()
    };
    await this.db.pendingUpdates.add(update);
  }

  async getPendingCount(): Promise<number> {
    return await this.db.pendingUpdates
      .where('syncStatus').equals('PENDING')
      .count();
  }

  async syncPending(): Promise<SyncResult> {
    const pending = await this.db.pendingUpdates
      .where('syncStatus').equals('PENDING')
      .toArray();

    if (pending.length === 0) {
      return { processed: 0, failed: 0, conflicts: [] };
    }

    const result = await firstValueFrom(
      this.apiClient.post<SyncResponse>('/courier/sync', { updates: pending })
    );

    // Remove successfully processed
    for (const id of result.processedIds) {
      await this.db.pendingUpdates.delete(id);
    }

    // Handle conflicts
    for (const conflict of result.conflicts) {
      await this.db.pendingUpdates.update(conflict.updateId, {
        syncStatus: 'CONFLICT'
      });
    }

    return result;
  }

  async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('courier-sync');
    }
  }
}
```

### 12.4 Conflict Resolution Rules

| Server State | Local Action | Resolution | UX |
|-------------|--------------|------------|-----|
| `OUT_FOR_DELIVERY` | Mark `DELIVERED` (offline) | Accept local if no server change. If server already `DELIVERED`, discard duplicate. If server `FAILED`, flag for admin review. | Show "Sync complete" or "Under review" banner |
| `OUT_FOR_DELIVERY` | Mark `FAILED` (offline) | Accept local if no server change. If server `DELIVERED`, reject local and show conflict. | Standard sync or red conflict banner |
| `DELIVERED` | Mark `FAILED` (offline delay) | **Reject local.** Show: "Already delivered. Contact admin if incorrect." | Red banner, require admin contact |
| Reassigned to new courier | Mark `OUT_FOR_DELIVERY` (old assignment) | **Reject local.** Remove from task list. Show: "Reassigned." | Refresh tasks, show notification |
| `CANCELLED` | Any action | **Reject local.** | Grey out, show cancelled |
| `PENDING` | Mark `DELIVERED` (skipped steps) | **Reject local.** State machine violation. | Error: "Invalid status transition" |
| `RETURNED` | Any action | **Reject local.** | Show: "Already returned" |

### 12.5 Service Worker Integration

```typescript
// Compiled into courier app service worker
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'courier-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'courier-periodic-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});
```

### 12.6 Photo Compression Strategy

```typescript
async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Max dimensions: 800x600
      const scale = Math.min(800 / img.width, 600 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Compress to JPEG, quality 0.7
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      resolve(base64);
    };
  });
}
```

---

## 13. Performance & Scalability

| Technique | Implementation |
|-----------|----------------|
| **Lazy Loading** | Every feature is a lazy-loaded route using `loadComponent()` |
| **Standalone Components** | No NgModules for features. Tree-shakeable. |
| **OnPush Change Detection** | Every single component. Signals make this natural. |
| **Virtual Scrolling** | CDK `ScrollingModule` or PrimeNG `p-table` virtual scroll for shipment/transaction lists |
| **API Caching** | `shareReplay({ bufferSize: 1, refCount: true })` on repository hot observables |
| **Request Deduplication** | `pendingRequests` Map in ApiClient cancels duplicate in-flight requests |
| **Image Optimization** | Courier photos: 500KB max, JPEG 70% quality. Canvas-based compression. |
| **Preload Strategy** | `PreloadAllModules` for admin (fast desktop). No preload for courier (save data). |
| **Bundle Budgets** | Courier initial < 200 KB gzipped. Admin initial < 300 KB gzipped. |

### Performance Budgets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| First Contentful Paint (FCP) | < 1.5s | > 2.5s |
| Time to Interactive (TTI) | < 3s | > 5s |
| API response time | < 200ms | > 500ms |
| Courier app bundle (initial) | < 200 KB | > 250 KB |
| Admin app bundle (initial) | < 300 KB | > 400 KB |
| Offline sync (50 updates) | < 3s | > 5s |
| Task list load | < 1s | > 2s |

---

## 14. Testing Strategy

### 14.1 Unit Tests (Jest)

| Target | Coverage | Notes |
|--------|----------|-------|
| Services / Facades | 80%+ | Business logic, state transitions |
| Mappers | 100% | DTO ↔ Entity conversion must be exact |
| Validators | 100% | Egyptian phone, COD amount, state machine |
| Pure functions | 100% | Formatters, helpers |

### 14.2 Component Tests (Angular Testing Library)

| Target | Approach |
|--------|----------|
| Smart components (Pages) | Test user interactions, facade calls, route navigation |
| Dumb components | Test rendering with inputs, event emission |
| Forms | Test validation states, submit handling |

### 14.3 E2E Tests (Playwright)

**Critical Paths:**

1. **Merchant Flow:**
   - Login → Create COD shipment → View wallet → Request payout
   - Bulk upload Excel → Poll job status → Verify results

2. **Admin Flow:**
   - Login → Dispatch board → Drag shipment to courier → Verify assignment
   - View analytics → Export report

3. **Courier Flow:**
   - Login → View tasks → Go offline → Mark delivered → Online → Sync → Verify
   - OTP verification (3 attempts, lockout)
   - Cash deposit logging

4. **Offline Scenarios:**
   - Complete offline delivery → sync on reconnect
   - Conflict resolution (server ahead of local)
   - Photo upload retry after network error
   - App kill mid-sync → resume on reopen

### 14.4 Offline Testing (Playwright + CDP)

```typescript
// Simulate offline
test('offline delivery sync', async ({ page }) => {
  await page.goto('/courier/tasks');
  await page.context().setOffline(true);
  
  // Mark delivery offline
  await page.click('[data-testid="mark-delivered"]');
  await page.fill('[data-testid="otp-input"]', '1234');
  await page.click('[data-testid="confirm"]');
  
  // Verify pending badge
  await expect(page.locator('[data-testid="pending-count"]')).toHaveText('1');
  
  // Go online and sync
  await page.context().setOffline(false);
  await page.click('[data-testid="sync-now"]');
  
  // Verify sync success
  await expect(page.locator('[data-testid="pending-count"]')).toHaveText('0');
});
```

---

## 15. Implementation Phases

### Phase 1: Foundation (Week 1)
- Scaffold Nx monorepo with all 3 apps and all libs
- Configure Angular 18+, PrimeNG, PrimeFlex, path aliases
- Set up ESLint module boundaries, Prettier
- Implement `libs/shared/domain`: all entities, enums, state machine
- Implement `libs/core/api`: ApiClient, interceptors, error handling
- Implement `libs/core/auth`: login, token storage, refresh logic
- Create base layout shells for all 3 apps
- Configure Arabic i18n scaffolding (`ngx-translate`)
- Apply Trackora brand theme to PrimeNG

### Phase 2: Shared Infrastructure (Week 2)
- `libs/shared/ui`: Custom components, pipes, directives, theme
- `libs/shared/utils`: Egyptian phone validator, currency formatter, date helpers
- `libs/shared/data-access`: All repositories and mappers
- `libs/core/state`: NgRx global store (auth, layout, notifications, permissions)
- `libs/core/realtime`: SSE transport service
- `libs/core/config`: Language service, feature flags
- Implement auth feature: login pages for all 3 apps

### Phase 3: Core Features (Weeks 3-4)
- **Shipments feature**: List (with filters + pagination), detail, create form, bulk upload
- **Tracking feature**: Public tracking page
- **Wallet feature**: Balance view, transaction list with filters
- **Merchant app**: Dashboard, shipments, wallet pages
- Arabic translation for all above features

### Phase 4: Courier PWA (Weeks 5-6)
- Courier task list + detail pages
- Offline Dexie store implementation
- Status update flow: OTP, photo capture, signature pad, COD confirmation
- Service Worker + Background Sync API
- Cash deposit logging page
- Performance metrics page
- Conflict resolution UI
- PWA manifest, icons, install prompt

### Phase 5: Admin & Operations (Weeks 7-8)
- Admin dashboard with KPIs and real-time alerts
- Dispatch board with drag-and-drop assignment
- Courier management page
- Merchant management page
- Wallet management (admin view)
- Payout approval workflow
- Audit logs viewer
- Reports generation

### Phase 6: Polish & Scale (Week 9+)
- Arabic RTL polish across all apps
- Map integration (Leaflet) in courier app
- Advanced analytics charts refinement
- E2E test suite completion
- Performance audit (Lighthouse, bundle analysis)
- Accessibility audit (WCAG 2.1 AA)
- Documentation completion

---

## 16. Naming Conventions

### Files & Folders

| Artifact | Convention | Example |
|----------|-----------|---------|
| Nx library | `kebab-case` | `shipments-feature` |
| TypeScript file | `kebab-case.ts` | `shipment.repository.ts` |
| Folder | `kebab-case` | `use-cases/`, `dto/` |
| SCSS file | `kebab-case.scss` | `trackora-theme.scss` |
| JSON file | `kebab-case.json` | `ar.json` |

### Code

| Artifact | Convention | Example |
|----------|-----------|---------|
| Class | `PascalCase` | `ShipmentRepository` |
| Method | `camelCase` | `findByTrackingNumber()` |
| Property | `camelCase` | `customerPhone` |
| Private signal | `_camelCase` | `_shipments` |
| Public signal | `camelCase` | `shipments` |
| Computed signal | `camelCase` | `hasMorePages` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Enum | `SCREAMING_SNAKE_CASE` | `ShipmentStatus.OUT_FOR_DELIVERY` |
| Enum member | `SCREAMING_SNAKE_CASE` | `OUT_FOR_DELIVERY` |
| Interface | `PascalCase` | `ShipmentResponseDto` |
| Type alias | `PascalCase` | `ShipmentFilters` |
| Generic | `T`, `K`, `V` or descriptive | `TEntity` |

### Angular-Specific

| Artifact | Convention | Example |
|----------|-----------|---------|
| Component class | `PascalCase` + `Component` | `ShipmentListPage` |
| Component selector | `app-kebab-case` | `app-shipment-list` |
| Directive selector | `[appKebabCase]` | `[appHasPermission]` |
| Pipe name | `camelCase` | `egpCurrency` |
| Injection token | `SCREAMING_SNAKE_CASE` | `REALTIME_TRANSPORT` |
| Route path | `kebab-case` | `/shipments/bulk-upload` |
| Translate key | `camelCase` or `feature.key` | `shipments.createTitle` |

---

## 17. Best Practices Checklist

### Code Quality
- [ ] **Strict TypeScript**: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`
- [ ] **No `any` in repositories**: All DTOs fully typed
- [ ] **Facade pattern enforced**: Components inject facades, never repositories directly
- [ ] **OnPush everywhere**: Every component uses `ChangeDetectionStrategy.OnPush`
- [ ] **Standalone components**: No feature NgModules
- [ ] **Money as Decimal**: Use `Decimal.js` for all monetary values; never `number`

### Business Rules
- [ ] **State machine in frontend**: Validate transitions before API call (mirrors backend)
- [ ] **Egyptian phone validation**: `01xxxxxxxxx` pattern enforced in forms and pipes
- [ ] **Phone masking**: Courier app never renders full customer phone (`01xx*****23`)
- [ ] **Optimistic updates**: Status changes reflect immediately; rollback on error
- [ ] **Loading & error states**: Every async operation has both
- [ ] **Audit trail**: Financial actions include timestamp and actor in payload

### MENA Optimization
- [ ] **Arabic RTL**: All layouts use logical CSS properties; PrimeNG configured for RTL
- [ ] **Arabic default**: Default language is `ar`; English secondary
- [ ] **Arabic fonts**: Cairo font loaded for Arabic text
- [ ] **Arabic numerals**: Numbers formatted with Arabic-Indic digits in Arabic mode
- [ ] **Arabic dates**: `Intl.DateTimeFormat` with `ar-EG` locale
- [ ] **Arabic pluralization**: MessageFormat compiler for complex Arabic plural rules

### Performance
- [ ] **Lazy loading**: Every feature route uses `loadComponent()`
- [ ] **Virtual scrolling**: Large lists use virtual scroll
- [ ] **API caching**: Hot observables use `shareReplay()`
- [ ] **Request deduplication**: Duplicate in-flight requests are cancelled
- [ ] **Image compression**: Courier photos max 500KB JPEG 70%
- [ ] **Bundle budgets**: Enforced in `angular.json`

### Security
- [ ] **No secrets in code**: API keys, tokens never committed
- [ ] **Token encryption**: Refresh token encrypted in `localStorage`
- [ ] **XSS prevention**: No innerHTML with user content; sanitize all inputs
- [ ] **Permission-based UI**: Use `*appHasPermission` directive, not just role checks
- [ ] **Secure logout**: Clear all storage, invalidate tokens server-side
- [ ] **Block logout with pending updates**: Courier cannot log out with unsynced changes

### Offline (Courier)
- [ ] **Queue all updates**: Every action works offline; sync happens transparently
- [ ] **Conflict resolution**: Clear rules when server and client disagree
- [ ] **Retry with backoff**: Exponential backoff (3s, 9s, 27s, 81s, 243s)
- [ ] **Max retries**: 5 attempts, then mark as FAILED
- [ ] **Background sync**: Register sync tasks when connectivity returns
- [ ] **Periodic sync**: Refresh tasks every 5 minutes when foreground
- [ ] **Cash log integrity**: Local cash log matches server state after sync

---

## Appendix A: Backend API Alignment

This frontend architecture is designed to work seamlessly with the existing NestJS backend:

| Backend Module | Frontend Feature | API Base Path |
|----------------|------------------|---------------|
| Auth | `auth-feature` | `/auth` |
| Shipments | `shipments-feature` | `/shipments` |
| Assignments | `assignments-feature` | `/assignments` |
| Couriers | `courier-tasks-feature` (admin) | `/couriers` |
| Courier App | `courier-tasks-feature` (PWA) | `/courier` |
| Merchants | `shipments-feature` (admin) | `/merchants` |
| Merchant Dashboard | `analytics-feature` | `/merchant` |
| Wallets | `wallet-feature` | `/wallets` |
| Payouts | `payouts-feature` | `/payouts` |
| Admin | `analytics-feature` (admin) | `/admin` |
| Tracking (Public) | `tracking-feature` | `/tracking` |

All API calls use the standard response envelope:
```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

---

## Appendix B: Documentation References

For detailed backend specifications, refer to:
- `API_SPEC.md` — Complete REST API specification
- `BUSINESS_FLOWS.md` — Step-by-step business processes
- `COURIER_SYNC_PROTOCOL.md` — Sync protocol for Courier PWA
- `PWA_OFFLINE.md` — Offline-first architecture
- `WALLET_LEDGER.md` — Double-entry accounting design
- `FRAUD_DETECTION.md` — Risk engine specifications
- `DISPATCH_ALGORITHM.md` — Smart dispatch deep-dive
- `PRISMA_SCHEMA.md` — Database schema documentation

---

*Document maintained by the Trackora Frontend Architecture Team.*
*Last updated: 2026-05-05*
