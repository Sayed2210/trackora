# PWA Offline Sync Strategy

## Overview

The Courier PWA must function reliably in Egypt's challenging connectivity environment (3G, intermittent signal, dead zones). This document specifies the offline-first architecture using IndexedDB, Background Sync API, and conflict resolution.

## Design Principles

1. **Offline-First:** All actions work without network. Sync happens transparently.
2. **Optimistic UI:** Show success immediately, handle failures gracefully.
3. **Conflict Resolution:** Clear rules for when server and client disagree.
4. **Data Integrity:** No lost updates, even with poor connectivity.

---

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| **IndexedDB** | Local database for pending updates, cached tasks, cash log |
| **Background Sync API** | Register sync tasks that execute when online |
| **Service Worker** | Cache static assets, intercept network requests |
| **Workbox** (optional) | Simplify service worker patterns |
| **Axios** with offline queue | HTTP client with request queuing |

---

## IndexedDB Schema

### Database: `TrackoraCourierDB`
**Version:** 1

### Object Store 1: `pending_updates`

Stores all actions performed while offline.

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
    timestamp: string;           // ISO 8601 local time
    deviceInfo?: { os: string; appVersion: string };
  };
  retryCount: number;            // 0-5
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  createdAt: number;             // Unix timestamp (ms)
}

// Indexes
// - primaryKey: id
// - syncStatusIndex: syncStatus (for querying pending items)
// - shipmentIdIndex: shipmentId (for finding updates per shipment)
```

### Object Store 2: `cached_tasks`

Stores the courier's daily task list.

```typescript
interface CachedTasks {
  courierId: string;
  tasks: Array<{
    shipmentId: string;
    trackingNumber: string;
    customerName: string;
    customerPhoneMasked: string;   // e.g., "0100*****01"
    customerPhoneFull?: string;    // Revealed after "on the way"
    addressText: string;
    codAmount: number;
    status: ShipmentStatus;
    orderInRoute: number;          // 1-based position in optimized route
    productDescription: string;
    preferredDeliveryDate?: string;
    mapUrl: string;
    notes: string;
    photoRequired: boolean;
    signatureRequired: boolean;
  }>;
  cachedAt: number;                // Unix timestamp
  etag: string;                    // HTTP ETag for conditional requests
  expiresAt: number;               // Cache expiry (end of day)
}

// Indexes
// - primaryKey: courierId
```

### Object Store 3: `cash_log`

Local record of cash collections and deposits.

```typescript
interface CashLog {
  id: string;
  amount: number;                  // Positive = collection, Negative = deposit
  shipmentId?: string;             // Nullable for deposits
  type: 'COLLECTION' | 'DEPOSIT';
  timestamp: number;
  synced: boolean;
  receiptPhotoBase64?: string;
}

// Indexes
// - primaryKey: id
// - syncedIndex: synced (for finding unsynced items)
// - typeIndex: type (for filtering)
```

### Object Store 4: `app_state`

Application state and user preferences.

```typescript
interface AppState {
  key: string;                     // e.g., "lastSyncTime", "userPreferences"
  value: any;
  updatedAt: number;
}

// Common keys:
// - "lastSyncTime": number
// - "pendingCount": number
// - "userPreferences": { language: 'ar'|'en', theme: 'light'|'dark' }
// - "authToken": string (encrypted)
```

---

## Background Sync Implementation

### Service Worker Registration

```typescript
// app.ts - Main app entry
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // Register sync when coming back online
    window.addEventListener('online', async () => {
      await registration.sync.register('courier-sync');
    });
    
    return registration;
  }
}
```

### Service Worker (sw.js)

```javascript
// sw.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'courier-sync') {
    event.waitUntil(syncPendingUpdates());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'courier-periodic-sync') {
    event.waitUntil(syncPendingUpdates());
  }
});

async function syncPendingUpdates() {
  const db = await openDB('TrackoraCourierDB', 1);
  const pending = await db.getAllFromIndex('pending_updates', 'syncStatus', 'PENDING');
  
  for (const update of pending) {
    try {
      await syncSingleUpdate(update, db);
    } catch (error) {
      console.error('Sync failed for update', update.id, error);
    }
  }
  
  // Notify app of sync completion
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE', pendingCount: pending.length });
  });
}
```

### Sync Logic (Inside Service Worker)

```typescript
async function syncSingleUpdate(update: PendingUpdate, db: IDBDatabase): Promise<void> {
  // Mark as syncing
  await db.put('pending_updates', { ...update, syncStatus: 'SYNCING' });
  
  try {
    const response = await fetch('/v1/courier/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': update.id,  // Prevent double-processing
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify(update)
    });
    
    if (response.status === 409) {
      // Conflict detected
      const serverState = await response.json();
      await handleConflict(update, serverState, db);
    } else if (response.ok) {
      // Success - remove from pending
      await db.delete('pending_updates', update.id);
      
      // Update cached task status
      await updateCachedTask(update.shipmentId, update.payload.status, db);
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    // Network or server error
    const newRetryCount = update.retryCount + 1;
    
    if (newRetryCount >= 5) {
      await db.put('pending_updates', {
        ...update,
        syncStatus: 'FAILED',
        retryCount: newRetryCount
      });
    } else {
      // Exponential backoff
      const backoffMs = Math.pow(3, newRetryCount) * 1000; // 3s, 9s, 27s, 81s, 243s
      
      setTimeout(async () => {
        await db.put('pending_updates', {
          ...update,
          retryCount: newRetryCount,
          syncStatus: 'PENDING'
        });
        
        // Re-register sync
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('courier-sync');
      }, backoffMs);
    }
  }
}
```

---

## Conflict Resolution Matrix

### Rules

| Server State | Local Action | Resolution | User Experience |
|-------------|--------------|------------|----------------|
| OUT_FOR_DELIVERY | Mark DELIVERED (offline) | **Accept local** if no server change. If server changed to DELIVERED already (race), discard duplicate. If server changed to FAILED, flag for admin review. | Show "Sync complete" or "Under review" banner |
| OUT_FOR_DELIVERY | Mark FAILED (offline) | **Accept local** if no server change. If server changed to DELIVERED, **reject local** and show conflict. | Standard sync or red conflict banner |
| DELIVERED | Mark FAILED (offline delay) | **Reject local**. Show: "This shipment was already marked delivered. Contact admin if incorrect." | Red banner, require admin contact |
| ASSIGNED (new courier, reassigned) | Mark OUT_FOR_DELIVERY (old assignment) | **Reject local**. Remove from task list. Show: "This shipment has been reassigned." | Refresh tasks, show notification |
| CANCELLED | Any action | **Reject local**. | Grey out, show cancelled |
| PENDING | Mark DELIVERED (impossible, skipped steps) | **Reject local**. State machine violation. | Error: "Invalid status transition" |
| RETURNED | Any action | **Reject local**. | Show: "Shipment already returned" |

### Conflict Handler Implementation

```typescript
async function handleConflict(
  update: PendingUpdate, 
  serverState: ServerState, 
  db: IDBDatabase
): Promise<void> {
  const resolution = determineResolution(update, serverState);
  
  switch (resolution) {
    case 'ACCEPT_LOCAL':
      // Retry with force flag (admin override)
      await retryWithForce(update, db);
      break;
      
    case 'REJECT_LOCAL':
      // Remove pending update
      await db.delete('pending_updates', update.id);
      
      // Show conflict to user
      await storeConflictNotification({
        updateId: update.id,
        shipmentId: update.shipmentId,
        localStatus: update.payload.status,
        serverStatus: serverState.status,
        message: getConflictMessage(serverState.status)
      }, db);
      break;
      
    case 'FLAG_FOR_REVIEW':
      // Keep pending but flag
      await db.put('pending_updates', {
        ...update,
        syncStatus: 'CONFLICT',
        conflictDetails: serverState
      });
      
      // Notify admin
      await notifyAdminOfConflict(update, serverState);
      break;
      
    case 'MERGE':
      // Special case: merge notes/photos even if status conflict
      await mergePartialUpdate(update, serverState, db);
      break;
  }
}

function determineResolution(update: PendingUpdate, serverState: ServerState): Resolution {
  const localStatus = update.payload.status;
  const serverStatus = serverState.status;
  
  // Terminal states cannot be changed
  if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(serverStatus)) {
    if (localStatus !== serverStatus) return 'REJECT_LOCAL';
    return 'ACCEPT_LOCAL'; // Duplicate
  }
  
  // Reassignment happened
  if (serverState.assignedCourierId !== currentCourierId) {
    return 'REJECT_LOCAL';
  }
  
  // State machine violations
  const validTransitions = getValidTransitions(serverStatus);
  if (!validTransitions.includes(localStatus)) {
    return 'REJECT_LOCAL';
  }
  
  // Normal case: accept local
  return 'ACCEPT_LOCAL';
}
```

---

## UI/UX Patterns

### Offline Indicator

```typescript
// Persistent bar at top of app
function ConnectionStatus() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingCount();
  
  if (!isOnline) {
    return (
      <div className="offline-banner">
        <span>You are offline. {pendingCount} updates pending.</span>
        <span>Last synced: {formatTime(lastSyncTime)}</span>
      </div>
    );
  }
  
  if (pendingCount > 0) {
    return (
      <div className="syncing-banner">
        <span>Syncing {pendingCount} updates...</span>
        <Spinner size="small" />
      </div>
    );
  }
  
  return (
    <div className="online-banner">
      <span>All synced. Last: {formatTime(lastSyncTime)}</span>
    </div>
  );
}
```

### Task List Offline Behavior

```typescript
function TaskList() {
  const { tasks, isLoading, isOffline } = useCachedTasks();
  
  if (isLoading) return <Skeleton />;
  
  return (
    <div>
      {isOffline && (
        <Badge variant="warning">
          Showing cached tasks ({tasks.length})
        </Badge>
      )}
      
      {tasks.map((task, index) => (
        <TaskCard 
          key={task.shipmentId}
          task={task}
          order={index + 1}
          isOffline={isOffline}
        />
      ))}
    </div>
  );
}
```

### Status Update Flow

```typescript
async function updateStatus(shipmentId: string, newStatus: ShipmentStatus) {
  // 1. Optimistic UI update
  updateLocalTaskStatus(shipmentId, newStatus);
  
  // 2. Create pending update
  const update: PendingUpdate = {
    id: generateUUID(),
    shipmentId,
    action: 'STATUS_UPDATE',
    payload: {
      status: newStatus,
      timestamp: new Date().toISOString()
    },
    retryCount: 0,
    syncStatus: 'PENDING',
    createdAt: Date.now()
  };
  
  // 3. Store in IndexedDB
  await db.put('pending_updates', update);
  
  // 4. If online, trigger immediate sync
  if (navigator.onLine) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('courier-sync');
  }
  
  // 5. Show toast
  showToast('Update saved. Will sync when online.');
}
```

---

## Photo & File Handling

### Compression Strategy

```typescript
async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
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

### Upload Queue

```typescript
interface PhotoUpload {
  id: string;
  shipmentId: string;
  base64Data: string;
  type: 'DELIVERY_PHOTO' | 'SIGNATURE';
  retryCount: number;
}

async function queuePhotoUpload(photo: PhotoUpload): Promise<void> {
  await db.put('photo_uploads', {
    ...photo,
    status: 'PENDING',
    createdAt: Date.now()
  });
  
  // Trigger background upload
  if (navigator.onLine) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('photo-upload');
  }
}
```

---

## Data Sync Strategy

### Initial Load (App Launch)

```
1. Check if cached tasks exist and are from today
2. If yes, display immediately
3. Fetch fresh tasks from API in background
4. Update cache with new data
5. If cache miss, show loading state until API responds
```

### Periodic Refresh

```
Every 5 minutes (when app is foreground):
1. Check online status
2. If online, fetch task updates
3. Update cache
4. Check for pending updates and sync
```

### Background Fetch (Optional)

```javascript
// sw.js
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'task-refresh') {
    event.waitUntil(fetchAndCacheTasks());
  }
});
```

---

## Testing Offline Behavior

### Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|----------------|
| Complete offline delivery | 1. Go offline 2. Mark delivered 3. Go online | Status syncs successfully |
| Conflict resolution | 1. Mark delivered offline 2. Admin cancels online 3. Go online | Conflict shown to courier |
| Photo upload retry | 1. Take photo offline 2. Go online 3. Server error 4. Auto-retry | Photo uploads after retries |
| Large batch sync | 1. Perform 20 actions offline 2. Go online | All sync in order, no duplicates |
| App kill mid-sync | 1. Start sync 2. Kill app 3. Reopen | Resume sync from where left off |

### Chrome DevTools Testing

```
1. Open Application tab
2. Go to Service Workers
3. Check "Offline" checkbox
4. Perform actions in app
5. Uncheck "Offline" to simulate reconnection
6. Monitor Background Sync and IndexedDB
```

---

**Next:** See WALLET_LEDGER.md for the double-entry accounting design.
