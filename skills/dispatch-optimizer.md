# Skill: Dispatch Optimizer

## Description
Expert in logistics dispatch algorithms, route optimization, zone-based assignment, and courier load balancing for last-mile delivery operations.

## When to Use
- Implementing auto-dispatch features
- Optimizing courier routes
- Designing zone-based assignment logic
- Calculating courier performance scores
- Handling assignment edge cases

## Core Algorithm

### Courier Scoring Formula
```
score = (successRate * 0.30) + (speedFactor * 0.15) + (loadBalance * 0.25) + (proximity * 0.20) + (experience * 0.10)
```

### Components

#### 1. Success Rate (30%)
```typescript
function calculateSuccessRate(courier: Courier): number {
  const total = courier.totalDelivered + courier.totalFailed + courier.totalReturned;
  if (total === 0) return 0.5;
  return courier.totalDelivered / total;
}
```

#### 2. Load Balance (25%)
```typescript
function calculateLoadBalance(courier: Courier): number {
  const activeTasks = getActiveTaskCount(courier.id);
  const effectiveCapacity = Math.floor(courier.maxDailyCapacity * 0.9);
  
  if (activeTasks >= effectiveCapacity) return 0;
  return 1 - (activeTasks / effectiveCapacity);
}
```

#### 3. Proximity (20%)
```typescript
function calculateProximity(courier: Courier, shipment: Shipment): number {
  if (!shipment.geoLocation) {
    return courier.zoneCodes.includes(shipment.zone?.code) ? 1.0 : 0.0;
  }
  
  const distance = haversineDistance(
    courier.lastKnownLocation,
    shipment.geoLocation
  );
  
  return Math.max(0, 1 - (distance / 10)); // 0km=1.0, 10km+=0.0
}
```

### Haversine Distance
```typescript
function haversineDistance(
  loc1: GeoLocation, 
  loc2: GeoLocation
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(loc2.lat - loc1.lat);
  const dLon = toRadians(loc2.lng - loc1.lng);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(loc1.lat)) * Math.cos(toRadians(loc2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

## Clustering Algorithm (DBSCAN)

```typescript
function clusterShipments(
  shipments: Shipment[], 
  epsilon: number = 2, 
  minPoints: number = 2
): ShipmentCluster[] {
  const clusters: ShipmentCluster[] = [];
  const visited = new Set<string>();
  const noise: Shipment[] = [];
  
  for (const shipment of shipments) {
    if (visited.has(shipment.id)) continue;
    visited.add(shipment.id);
    
    const neighbors = getNeighbors(shipments, shipment, epsilon);
    
    if (neighbors.length < minPoints - 1) {
      noise.push(shipment);
      continue;
    }
    
    const cluster = expandCluster(
      shipments, 
      shipment, 
      neighbors, 
      visited, 
      epsilon, 
      minPoints
    );
    clusters.push(cluster);
  }
  
  // Add noise points as individual clusters
  for (const point of noise) {
    clusters.push({
      id: generateId(),
      shipments: [point],
      centroid: point.geoLocation,
    });
  }
  
  return clusters;
}

function getNeighbors(
  shipments: Shipment[], 
  point: Shipment, 
  epsilon: number
): Shipment[] {
  return shipments.filter(s => 
    s.id !== point.id && 
    haversineDistance(point.geoLocation, s.geoLocation) <= epsilon
  );
}
```

## Route Optimization (Nearest Neighbor)

```typescript
function optimizeRoute(
  startLocation: GeoLocation,
  shipments: Shipment[]
): Shipment[] {
  const unvisited = [...shipments];
  const route: Shipment[] = [];
  let current = startLocation;
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineDistance(current, unvisited[i].geoLocation);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }
    
    const nearest = unvisited[nearestIndex];
    route.push(nearest);
    current = nearest.geoLocation;
    unvisited.splice(nearestIndex, 1);
  }
  
  return route;
}
```

## Load Balancing Algorithm

```typescript
function distributeShipments(
  shipments: Shipment[],
  couriers: Courier[]
): Assignment[] {
  const assignments: Assignment[] = [];
  
  // Sort by priority (higher COD first)
  const sortedShipments = shipments.sort((a, b) => 
    b.codAmount - a.codAmount
  );
  
  for (const shipment of sortedShipments) {
    // Filter eligible couriers
    const eligible = couriers.filter(c => 
      c.isActive && 
      c.isAvailable && 
      c.zoneCodes.includes(shipment.zone?.code) &&
      getActiveTaskCount(c.id) < Math.floor(c.maxDailyCapacity * 0.9)
    );
    
    if (eligible.length === 0) continue;
    
    // Score and sort
    const scored = eligible.map(c => ({
      courier: c,
      score: calculateScore(c, shipment),
      activeTasks: getActiveTaskCount(c.id),
    })).sort((a, b) => b.score - a.score);
    
    // Pick from top 3, preferring lower task count
    const top3 = scored.slice(0, 3);
    const selected = top3.reduce((best, current) => {
      if (current.activeTasks < best.activeTasks) return current;
      if (current.activeTasks === best.activeTasks && current.score > best.score) {
        return current;
      }
      return best;
    });
    
    assignments.push({
      shipmentId: shipment.id,
      courierId: selected.courier.id,
      type: 'AUTO_DISPATCH',
      status: 'ACTIVE',
    });
    
    // Update in-memory count
    selected.activeTasks++;
  }
  
  return assignments;
}
```

## Performance Score Calculation

```typescript
interface PerformanceMetrics {
  deliverySuccessRate: number;
  onTimeDeliveryRate: number;
  cashDepositAccuracy: number;
  customerComplaints: number;
  appUsageRate: number;
}

function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const weights = {
    deliverySuccessRate: 0.40,
    onTimeDeliveryRate: 0.20,
    cashDepositAccuracy: 0.20,
    customerComplaints: 0.10,
    appUsageRate: 0.10,
  };
  
  const complaintScore = Math.max(0, 1 - (metrics.customerComplaints / 10));
  
  const score = 
    metrics.deliverySuccessRate * weights.deliverySuccessRate +
    metrics.onTimeDeliveryRate * weights.onTimeDeliveryRate +
    metrics.cashDepositAccuracy * weights.cashDepositAccuracy +
    complaintScore * weights.customerComplaints +
    metrics.appUsageRate * weights.appUsageRate;
  
  return Math.round(score * 100);
}
```

## Zone Matching

```typescript
function findZoneForAddress(
  addressText: string,
  zones: Zone[]
): ZoneMatch {
  // Tokenize Arabic address
  const tokens = tokenizeArabic(addressText);
  
  // Try exact district match
  for (const zone of zones) {
    if (zone.level === 'DISTRICT' && tokens.includes(zone.nameAr)) {
      return { zoneId: zone.id, confidence: 1.0 };
    }
  }
  
  // Fuzzy match with trigram similarity
  const matches = zones
    .filter(z => z.level === 'DISTRICT')
    .map(z => ({
      zone: z,
      score: calculateSimilarity(addressText, z.nameAr),
    }))
    .filter(m => m.score > 0.7)
    .sort((a, b) => b.score - a.score);
  
  if (matches.length > 0) {
    return {
      zoneId: matches[0].zone.id,
      confidence: matches[0].score,
    };
  }
  
  return { zoneId: null, confidence: 0 };
}
```

## Cron Job Configuration

```typescript
// BullMQ repeatable job
const autoDispatchJob = {
  name: 'auto-dispatch',
  data: { type: 'AUTO_DISPATCH_RUN' },
  opts: {
    repeat: {
      cron: '0 6,8,10,12,14,16 * * *',
      timezone: 'Africa/Cairo',
    },
    jobId: 'auto-dispatch-cron',
    removeOnComplete: 10,
    removeOnFail: 5,
  },
};
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No couriers in zone | Leave unassigned, alert admin after 12h |
| All couriers at capacity | Queue for next run, escalate after 24h |
| Courier rejects | Blacklist for 4h, reassign |
| Courier goes offline | Mark unavailable, reassign active tasks |
| Customer reschedules | Status → POSTPONED, add to tomorrow's pool |
| High-value shipment | Assign to top-scored courier only |
| New courier (no history) | Lower capacity, assign in safe zones |

## Metrics to Track

- Auto-dispatch coverage (% of eligible shipments)
- Average assignments per run
- Courier utilization rate
- Unassigned shipment aging
- Route efficiency (distance saved vs random)
- Delivery success rate by assignment type (auto vs manual)

## Example Usage
User: "Implement the auto-dispatch algorithm for morning assignments"
→ Use this skill to create the scoring, clustering, and distribution logic with proper database transactions and event emission.
