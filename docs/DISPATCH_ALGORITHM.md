# Smart Dispatch Algorithm

## Overview

The Smart Dispatch system automatically assigns pending shipments to optimal couriers based on zone matching, performance scoring, load balancing, and proximity. It runs as a background BullMQ job and is the key differentiator for operational efficiency.

## Goals

1. **Minimize manual dispatch work:** Reduce dispatcher workload by 80%+
2. **Maximize delivery success:** Assign shipments to proven couriers in the right zone
3. **Ensure fairness:** Prevent courier overload and favoritism
4. **Optimize routes:** Group nearby deliveries to reduce travel time

---

## Zone Hierarchy Model

### Geographic Levels

```
Egypt (COUNTRY)
├── Cairo (GOVERNORATE)
│   ├── Maadi (CITY)
│   │   ├── Sarayat (DISTRICT) [zoneCode: EG-C-MAA-SAR]
│   │   └── Degla (DISTRICT)   [zoneCode: EG-C-MAA-DEG]
│   ├── Nasr City (CITY)
│   │   ├── Mustafa (DISTRICT) [zoneCode: EG-C-NAS-MUS]
│   │   └── Rabaa (DISTRICT)   [zoneCode: EG-C-NAS-RAB]
│   └── Heliopolis (CITY)
│       └── Korba (DISTRICT)   [zoneCode: EG-C-HEL-KOR]
├── Giza (GOVERNORATE)
│   ├── Dokki (CITY)
│   └── Mohandessin (CITY)
└── Alexandria (GOVERNORATE)
    ├── Sporting (CITY)
    └── Roushdy (CITY)
```

### Zone Code Format

```
{2-letter-country}-{1-letter-gov}-{3-letter-city}-{3-letter-district}

Examples:
- EG-C-MAA-DEG = Egypt, Cairo, Maadi, Degla
- EG-C-NAS-MUS = Egypt, Cairo, Nasr City, Mustafa
- EG-G-DOK-MAS = Egypt, Giza, Dokki, Mashrabia
```

### Address Matching

```typescript
function resolveZone(addressText: string): ZoneMatch {
  // 1. Tokenize Arabic address
  const tokens = tokenizeArabic(addressText);
  
  // 2. Try exact district match
  const exactMatch = findDistrictByExactName(tokens);
  if (exactMatch) return { zoneId: exactMatch.id, confidence: 1.0 };
  
  // 3. Fuzzy match using trigram similarity (pg_trgm)
  const fuzzyMatches = queryDatabase(`
    SELECT id, nameAr, similarity(nameAr, $1) as score
    FROM Zone
    WHERE level = 'DISTRICT'
    ORDER BY score DESC
    LIMIT 3
  `, [addressText]);
  
  if (fuzzyMatches[0]?.score > 0.7) {
    return { 
      zoneId: fuzzyMatches[0].id, 
      confidence: fuzzyMatches[0].score 
    };
  }
  
  // 4. Fallback: manual assignment required
  return { zoneId: null, confidence: 0 };
}
```

---

## Courier Scoring Formula

### Score Components

```
score = (successRate * 0.30) + (speedFactor * 0.15) + (loadBalance * 0.25) + (proximity * 0.20) + (experience * 0.10)
```

### Component Definitions

#### 1. Success Rate (30% weight)

```typescript
function calculateSuccessRate(courier: Courier): number {
  const total = courier.totalDelivered + courier.totalFailed + courier.totalReturned;
  if (total === 0) return 0.5; // Neutral for new couriers
  
  return courier.totalDelivered / total;
}
```

| Range | Interpretation |
|-------|----------------|
| 95-100% | Excellent |
| 85-94% | Good |
| 70-84% | Average |
| 50-69% | Below Average |
| <50% | Poor (reduce assignments) |

#### 2. Speed Factor (15% weight)

```typescript
function calculateSpeedFactor(courier: Courier, zone: Zone): number {
  if (!courier.avgDeliveryTimeMinutes) return 0.5;
  
  // Compare courier average to zone average
  const zoneAvg = getZoneAverageDeliveryTime(zone.id);
  if (!zoneAvg) return 0.5;
  
  const ratio = courier.avgDeliveryTimeMinutes / zoneAvg;
  // Ratio < 1 means faster than average (higher score)
  return Math.max(0, Math.min(1, 1 - (ratio - 1)));
}
```

#### 3. Load Balance (25% weight)

```typescript
function calculateLoadBalance(courier: Courier): number {
  const activeTasks = getActiveTaskCount(courier.id);
  const capacity = courier.maxDailyCapacity;
  
  // Reserve 10% buffer for manual assignments
  const effectiveCapacity = Math.floor(capacity * 0.9);
  
  if (activeTasks >= effectiveCapacity) return 0;
  
  return 1 - (activeTasks / effectiveCapacity);
}
```

#### 4. Proximity (20% weight)

```typescript
function calculateProximity(courier: Courier, shipment: Shipment): number {
  if (!shipment.geoLocation || !courier.lastKnownLocation) {
    // Fallback: same district = full score
    const courierZones = courier.zoneCodes;
    const shipmentZone = shipment.zone?.code;
    return courierZones.includes(shipmentZone) ? 1.0 : 0.0;
  }
  
  // Haversine distance calculation
  const distance = haversineDistance(
    courier.lastKnownLocation.lat,
    courier.lastKnownLocation.lng,
    shipment.geoLocation.lat,
    shipment.geoLocation.lng
  );
  
  // Normalize: 0km = 1.0, 10km+ = 0.0
  return Math.max(0, 1 - (distance / 10));
}
```

#### 5. Experience (10% weight)

```typescript
function calculateExperience(courier: Courier): number {
  const daysSinceOnboarding = differenceInDays(
    new Date(),
    courier.createdAt
  );
  
  // Linear ramp: 0 days = 0.0, 30 days = 1.0
  return Math.min(1.0, daysSinceOnboarding / 30);
}
```

### Score Examples

| Courier | Success Rate | Speed | Load | Proximity | Experience | **Score** |
|---------|-------------|-------|------|-----------|------------|-----------|
| Ahmed (veteran) | 0.95 | 0.85 | 0.60 | 0.90 | 1.00 | **0.85** |
| Khaled (new) | 0.80 | 0.70 | 0.90 | 0.80 | 0.30 | **0.72** |
| Omar (struggling) | 0.55 | 0.60 | 0.40 | 0.70 | 0.80 | **0.56** |
| Samir (overloaded) | 0.90 | 0.80 | 0.10 | 0.85 | 0.90 | **0.53** |

---

## Load Balancing Algorithm

### Problem

Highest score always getting assignments leads to:
- Starvation of lower-scored couriers
- No opportunity for new couriers to prove themselves
- Over-reliance on top performers

### Solution: Weighted Round-Robin with Capacity

```typescript
function distributeShipments(
  shipments: Shipment[],
  couriers: Courier[]
): Assignment[] {
  const assignments: Assignment[] = [];
  
  // Sort shipments by priority (higher COD first, then by creation time)
  const sortedShipments = shipments.sort((a, b) => {
    if (a.codAmount !== b.codAmount) return b.codAmount - a.codAmount;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  
  for (const shipment of sortedShipments) {
    // 1. Filter eligible couriers
    const eligible = couriers.filter(c => 
      c.isActive && 
      c.isAvailable && 
      c.zoneCodes.includes(shipment.zone?.code) &&
      getActiveTaskCount(c.id) < Math.floor(c.maxDailyCapacity * 0.9)
    );
    
    if (eligible.length === 0) {
      // No courier available - leave unassigned
      continue;
    }
    
    // 2. Calculate scores for eligible couriers
    const scored = eligible.map(courier => ({
      courier,
      score: calculateScore(courier, shipment),
      activeTasks: getActiveTaskCount(courier.id)
    }));
    
    // 3. Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // 4. Pick from top 3, preferring lower task count
    const top3 = scored.slice(0, 3);
    const selected = top3.reduce((best, current) => {
      if (current.activeTasks < best.activeTasks) return current;
      if (current.activeTasks === best.activeTasks && current.score > best.score) {
        return current;
      }
      return best;
    });
    
    // 5. Create assignment
    assignments.push({
      shipmentId: shipment.id,
      courierId: selected.courier.id,
      type: 'AUTO_DISPATCH',
      status: 'ACTIVE'
    });
    
    // 6. Update active task count (in-memory for this batch)
    selected.activeTasks++;
  }
  
  return assignments;
}
```

### Why This Works

- **Top performers still get priority** (score-based selection)
- **But lower-task couriers get a chance** (task count tiebreaker)
- **No single courier gets overloaded** (capacity hard limit)
- **High-value shipments prioritized** (sorted by COD amount)

---

## Route Batching Strategy

### Goal

Group nearby shipments so a single courier can deliver them efficiently.

### Algorithm: DBSCAN Clustering

```typescript
function clusterShipments(shipments: Shipment[]): ShipmentCluster[] {
  // DBSCAN parameters
  const EPSILON = 2; // 2km radius
  const MIN_POINTS = 2; // Minimum 2 shipments to form cluster
  
  const clusters: ShipmentCluster[] = [];
  const visited = new Set<string>();
  
  for (const shipment of shipments) {
    if (visited.has(shipment.id)) continue;
    
    // Find neighbors within EPSILON
    const neighbors = shipments.filter(s => 
      s.id !== shipment.id &&
      haversineDistance(shipment.geoLocation, s.geoLocation) <= EPSILON
    );
    
    if (neighbors.length >= MIN_POINTS - 1) {
      // Start new cluster
      const cluster: ShipmentCluster = {
        id: generateId(),
        shipments: [shipment, ...neighbors],
        centroid: calculateCentroid([shipment, ...neighbors])
      };
      
      visited.add(shipment.id);
      neighbors.forEach(n => visited.add(n.id));
      clusters.push(cluster);
    }
  }
  
  // Add remaining unclustered shipments as singletons
  const unclustered = shipments.filter(s => !visited.has(s.id));
  
  return [...clusters, ...unclustered.map(s => ({
    id: generateId(),
    shipments: [s],
    centroid: s.geoLocation
  }))];
}
```

### Route Ordering (Nearest Neighbor)

```typescript
function optimizeRoute(
  startLocation: GeoLocation,
  shipments: Shipment[]
): Shipment[] {
  const unvisited = [...shipments];
  const route: Shipment[] = [];
  let current = startLocation;
  
  while (unvisited.length > 0) {
    // Find nearest unvisited shipment
    const nearest = unvisited.reduce((best, currentShipment) => {
      const dist = haversineDistance(current, currentShipment.geoLocation);
      return dist < best.distance ? { shipment: currentShipment, distance: dist } : best;
    }, { shipment: unvisited[0], distance: Infinity });
    
    route.push(nearest.shipment);
    current = nearest.shipment.geoLocation;
    
    // Remove from unvisited
    const index = unvisited.findIndex(s => s.id === nearest.shipment.id);
    unvisited.splice(index, 1);
  }
  
  return route;
}
```

---

## Dispatch Execution Flow

### Cron Schedule

```typescript
// BullMQ repeatable job configuration
const autoDispatchJob = {
  name: 'auto-dispatch',
  data: { type: 'AUTO_DISPATCH_RUN' },
  opts: {
    repeat: {
      cron: '0 6,8,10,12,14,16 * * *', // Every 2 hours from 6 AM to 4 PM
      timezone: 'Africa/Cairo'
    },
    jobId: 'auto-dispatch-cron', // Prevent duplicate cron jobs
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 5       // Keep last 5 failed jobs
  }
};
```

### Execution Steps

```
1. Acquire distributed lock (Redis SET auto-dispatch-lock NX EX 300)
   └─ If lock exists, skip (another instance running)

2. Query pending shipments
   └─ status = PENDING
   └─ preferredDeliveryDate <= today
   └─ autoDispatchEligible = true
   └─ assignedCourierId IS NULL

3. Query available couriers
   └─ isActive = true
   └─ isAvailable = true
   └─ activeAssignments < maxDailyCapacity * 0.9

4. Group shipments by zone

5. For each zone:
   a. Cluster shipments by proximity (DBSCAN)
   b. Score eligible couriers
   c. Distribute clusters/shipments using weighted round-robin
   d. Create assignments in database transaction

6. Bulk emit ShipmentAssignedEvent per assignment

7. Release distributed lock

8. Log metrics:
   └─ Total shipments processed
   └─ Successfully assigned
   └─ Unassigned (no capacity)
   └─ Execution time
```

### Pseudocode

```typescript
class AutoDispatchProcessor {
  async process(job: Job) {
    const lockKey = 'auto-dispatch-lock';
    const lockAcquired = await this.redis.set(lockKey, '1', 'NX', 'EX', 300);
    
    if (!lockAcquired) {
      this.logger.warn('Auto-dispatch already running, skipping');
      return;
    }
    
    try {
      const shipments = await this.shipmentRepository.findPendingForDispatch();
      const couriers = await this.courierRepository.findAvailable();
      
      // Group by zone
      const zoneGroups = groupBy(shipments, s => s.zone?.code);
      
      for (const [zoneCode, zoneShipments] of Object.entries(zoneGroups)) {
        const zoneCouriers = couriers.filter(c => c.zoneCodes.includes(zoneCode));
        
        if (zoneCouriers.length === 0) {
          this.logger.warn(`No couriers available for zone ${zoneCode}`);
          continue;
        }
        
        // Cluster and distribute
        const clusters = clusterShipments(zoneShipments);
        const assignments = distributeShipments(clusters, zoneCouriers);
        
        // Persist in transaction
        await this.prisma.$transaction(async (tx) => {
          for (const assignment of assignments) {
            await tx.assignment.create({ data: assignment });
            await tx.shipment.update({
              where: { id: assignment.shipmentId },
              data: { assignedCourierId: assignment.courierId }
            });
          }
        });
        
        // Emit events
        for (const assignment of assignments) {
          this.eventEmitter.emit('shipment.assigned', {
            shipmentId: assignment.shipmentId,
            courierId: assignment.courierId,
            type: 'AUTO_DISPATCH'
          });
        }
      }
      
      this.logger.info(`Auto-dispatch complete: ${assignments.length} assigned`);
      
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
```

---

## Reassignment & Failure Handling

### Courier Rejection

```
Courier taps "Reject" in app
  └─ Mark assignment.status = REJECTED
  └─ Add courier to zone blacklist (4 hours)
  └─ Return shipment to pending pool
  └─ Alert dispatcher
```

### Courier Offline Detection

```
Heartbeat check (every 5 minutes)
  └─ If lastHeartbeat > 30 minutes ago
     └─ Mark courier.isAvailable = false
     └─ Reassign all ACTIVE OUT_FOR_DELIVERY tasks
     └─ Alert dispatcher
```

### Missed Pickup Window

```
If shipment.status = PICKED_UP and pickupDeadline < now()
  └─ Auto-reassign to next best courier
  └─ Log reason: "Missed pickup window"
  └─ Notify original courier (penalty point)
```

---

## Performance Optimization

### Database Query Optimization

```sql
-- Index for dispatch queries
CREATE INDEX idx_shipment_dispatch ON "Shipment"(
  "status", 
  "autoDispatchEligible", 
  "preferredDeliveryDate", 
  "zoneId"
) WHERE "status" = 'PENDING';

-- Index for courier availability
CREATE INDEX idx_courier_available ON "Courier"(
  "isActive", 
  "isAvailable"
) INCLUDE ("zoneCodes", "maxDailyCapacity");
```

### Caching

```typescript
// Cache zone configuration (rarely changes)
const zones = await this.cache.remember(
  'dispatch:zones',
  3600, // 1 hour
  () => this.zoneRepository.findAllActive()
);

// Cache courier performance scores (updated nightly)
const scores = await this.cache.remember(
  `courier:scores`,
  300, // 5 minutes
  () => this.courierRepository.getPerformanceScores()
);
```

### Batch Processing

- Process shipments in batches of 100 to avoid memory issues
- Use cursor-based pagination for large pending queues
- Parallelize zone processing with Promise.all (max 5 concurrent)

---

## Metrics & Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Auto-dispatch coverage | >80% of eligible shipments | <70% |
| Avg assignments per run | 200-500 | <100 or >800 |
| Unassigned after 12h | <5% | >10% |
| Courier utilization | 70-85% | <50% or >95% |
| Execution time | <2 minutes | >5 minutes |

### Dashboard Widgets

- **Dispatch Board:** Real-time view of pending shipments and available couriers by zone
- **Coverage Chart:** Percentage of auto-dispatched vs manual over time
- **Courier Load:** Visual grid showing each courier's current vs max capacity
- **Success Rate by Zone:** Heatmap of delivery success by geographic zone

---

**Next:** See PWA_OFFLINE.md for the courier offline sync strategy.
