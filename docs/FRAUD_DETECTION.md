# Fraud Detection Engine

## Overview

The fraud detection engine identifies potentially fake or high-risk orders before they waste courier time and merchant money. In Egypt's COD-dominated market, fake orders are a major cost driver — this system mitigates that risk.

## Goals

1. **Prevent fake orders:** Flag orders with fake phone numbers or addresses
2. **Detect unreachable customers:** Identify patterns of unreachable phone numbers
3. **Stop abuse:** Prevent customers from repeatedly ordering and refusing delivery
4. **Protect merchants:** Alert merchants to suspicious patterns before dispatch
5. **Minimize false positives:** Don't block legitimate orders

---

## Risk Signals

### Signal Definitions

| Signal ID | Name | Weight | Detection Method | Data Source |
|-----------|------|--------|------------------|-------------|
| `INVALID_PHONE` | Phone format invalid | +30 | Regex validation `^01[0-2,5]{1}[0-9]{8}$` | Shipment creation |
| `PHONE_UNREACHABLE` | SMS/OTP ping failed | +40 | Twilio status = "failed" | Notification service |
| `BLACKLISTED_PHONE` | Phone in blacklist | +50 | Exact match in `blacklisted_phones` table | Database query |
| `HIGH_VELOCITY` | >5 orders/24h same phone | +25 | Redis INCR with 24h TTL | Redis counter |
| `HIGH_COD` | COD > EGP 5,000 | +15 | Static threshold check | Shipment data |
| `ADDRESS_MISMATCH` | IP geo != shipping zone | +20 | IP geolocation vs address zone | Request metadata |
| `NEW_MERCHANT_HIGH_COD` | Merchant <7 days + COD >2,000 | +20 | Merchant age calculation | Merchant data |
| `NO_LANDMARK` | Landmark field empty | +10 | Null/empty check | Shipment data |
| `FAILURE_HISTORY` | 3+ failures in 30 days | +40 | Count FAILED/RETURNED per phone | Shipment history |
| `DUPLICATE_ADDRESS` | Same address, different names | +15 | Address hash match | Shipment query |
| `ODD_HOUR_ORDER` | Order placed 2 AM - 5 AM | +5 | Hour extraction from createdAt | System timestamp |
| `SUSPICIOUS_EMAIL` | Disposable email domain | +15 | Check against disposable domain list | Shipment/customer data |

### Signal Implementation

```typescript
interface RiskSignal {
  signal: string;
  weight: number;
  description: string;
  metadata?: any;
}

class FraudDetectionService {
  async calculateRiskScore(shipment: Shipment): Promise<{
    score: number;
    signals: RiskSignal[];
    level: RiskLevel;
  }> {
    const signals: RiskSignal[] = [];
    
    // 1. Phone validation
    if (!this.isValidEgyptianPhone(shipment.customerPhone)) {
      signals.push({
        signal: 'INVALID_PHONE',
        weight: 30,
        description: 'Phone number format is invalid'
      });
    }
    
    // 2. Blacklist check
    if (await this.isBlacklisted(shipment.customerPhone)) {
      signals.push({
        signal: 'BLACKLISTED_PHONE',
        weight: 50,
        description: 'Phone number is blacklisted due to previous fraud/failures'
      });
    }
    
    // 3. Velocity check
    const recentOrders = await this.getRecentOrderCount(
      shipment.customerPhone, 
      '24h'
    );
    if (recentOrders > 5) {
      signals.push({
        signal: 'HIGH_VELOCITY',
        weight: 25,
        description: `${recentOrders} orders in last 24 hours`,
        metadata: { orderCount: recentOrders }
      });
    }
    
    // 4. COD amount check
    if (shipment.codAmount > 5000) {
      signals.push({
        signal: 'HIGH_COD',
        weight: 15,
        description: `COD amount ${shipment.codAmount} exceeds 5,000 EGP`
      });
    }
    
    // 5. New merchant check
    const merchantAge = differenceInDays(new Date(), shipment.merchant.createdAt);
    if (merchantAge < 7 && shipment.codAmount > 2000) {
      signals.push({
        signal: 'NEW_MERCHANT_HIGH_COD',
        weight: 20,
        description: `New merchant (${merchantAge} days) with high COD`
      });
    }
    
    // 6. Address quality
    const addressQuality = this.assessAddressQuality(shipment.address);
    if (addressQuality.score < 0.5) {
      signals.push({
        signal: 'LOW_ADDRESS_QUALITY',
        weight: 10 + (0.5 - addressQuality.score) * 20,
        description: 'Address is incomplete or vague'
      });
    }
    
    // 7. Failure history
    const failureCount = await this.getFailureCount(shipment.customerPhone, '30d');
    if (failureCount >= 3) {
      signals.push({
        signal: 'FAILURE_HISTORY',
        weight: 40,
        description: `${failureCount} failed/returned deliveries in last 30 days`
      });
    }
    
    // 8. Duplicate address
    const addressDuplicates = await this.findAddressDuplicates(shipment);
    if (addressDuplicates.length > 0 && addressDuplicates.some(d => d.customerName !== shipment.customerName)) {
      signals.push({
        signal: 'DUPLICATE_ADDRESS',
        weight: 15,
        description: 'Same address used with different customer names'
      });
    }
    
    // Calculate total score (cap at 100)
    const score = Math.min(
      100,
      signals.reduce((sum, s) => sum + s.weight, 0)
    );
    
    const level = this.getRiskLevel(score);
    
    return { score, signals, level };
  }
  
  private isValidEgyptianPhone(phone: string): boolean {
    // Egyptian mobile numbers: 010, 011, 012, 015 followed by 8 digits
    return /^01[0-2,5]{1}[0-9]{8}$/.test(phone);
  }
  
  private async isBlacklisted(phone: string): Promise<boolean> {
    const entry = await this.prisma.blacklistedPhone.findUnique({
      where: { phone }
    });
    
    if (!entry) return false;
    if (entry.isPermanent) return true;
    if (entry.expiresAt && entry.expiresAt < new Date()) return false;
    
    return true;
  }
  
  private async getRecentOrderCount(phone: string, window: string): Promise<number> {
    const cacheKey = `velocity:${phone}`;
    const count = await this.redis.incr(cacheKey);
    
    // Set TTL on first increment
    if (count === 1) {
      const ttlSeconds = window === '24h' ? 86400 : 3600;
      await this.redis.expire(cacheKey, ttlSeconds);
    }
    
    return count;
  }
  
  private assessAddressQuality(address: Address): { score: number; issues: string[] } {
    let score = 1.0;
    const issues: string[] = [];
    
    if (!address.landmark || address.landmark.length < 3) {
      score -= 0.3;
      issues.push('No landmark provided');
    }
    
    if (!address.building) {
      score -= 0.2;
      issues.push('No building number');
    }
    
    if (!address.street || address.street.length < 3) {
      score -= 0.2;
      issues.push('Street name too short');
    }
    
    if (!address.district) {
      score -= 0.2;
      issues.push('No district specified');
    }
    
    return { score: Math.max(0, score), issues };
  }
  
  private async getFailureCount(phone: string, window: string): Promise<number> {
    const days = window === '30d' ? 30 : 7;
    const since = subDays(new Date(), days);
    
    return this.prisma.shipment.count({
      where: {
        customerPhone: phone,
        status: { in: ['FAILED', 'RETURNED'] },
        createdAt: { gte: since }
      }
    });
  }
  
  private async findAddressDuplicates(shipment: Shipment): Promise<Shipment[]> {
    // Normalize address for comparison
    const normalizedAddress = this.normalizeAddress(shipment.address);
    
    return this.prisma.shipment.findMany({
      where: {
        addressText: { contains: normalizedAddress },
        id: { not: shipment.id },
        createdAt: { gte: subDays(new Date(), 30) }
      },
      take: 10
    });
  }
  
  private normalizeAddress(address: Address): string {
    // Remove numbers and normalize Arabic text
    return address.district + ' ' + address.street;
  }
  
  private getRiskLevel(score: number): RiskLevel {
    if (score <= 25) return 'LOW';
    if (score <= 50) return 'MEDIUM';
    if (score <= 75) return 'HIGH';
    return 'CRITICAL';
  }
}
```

---

## Risk Score Action Matrix

| Score Range | Risk Level | Color | Action | Merchant UX | Admin Alert |
|------------|-----------|-------|--------|-------------|-------------|
| 0 - 25 | Low | 🟢 | Normal flow | Standard creation | None |
| 26 - 50 | Medium | 🟡 | Assign to experienced courier only (score >80) | Standard, may see "High value order" badge | None |
| 51 - 75 | High | 🟠 | Hold shipment. Require merchant verification call. | Banner: "Please verify customer phone before dispatch" | Dashboard notification |
| 76 - 100 | Critical | 🔴 | Auto-cancel or flag for manual review. Blacklist phone. | Banner: "Order flagged for review. Support will contact you." | Immediate alert + SMS to ops manager |

### Action Implementation

```typescript
class RiskActionService {
  async applyRiskAction(
    shipment: Shipment,
    riskAssessment: RiskAssessment
  ): Promise<void> {
    switch (riskAssessment.level) {
      case 'LOW':
        // No action needed
        await this.approveForDispatch(shipment);
        break;
        
      case 'MEDIUM':
        // Assign to experienced courier only
        await this.flagForExperiencedCourier(shipment);
        break;
        
      case 'HIGH':
        // Hold for verification
        await this.holdForVerification(shipment, riskAssessment);
        break;
        
      case 'CRITICAL':
        // Auto-cancel or manual review
        await this.autoCancelOrReview(shipment, riskAssessment);
        break;
    }
  }
  
  private async holdForVerification(
    shipment: Shipment,
    assessment: RiskAssessment
  ): Promise<void> {
    // Update shipment
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: { 
        autoDispatchEligible: false,
        status: 'PENDING' // Remains pending until verified
      }
    });
    
    // Create risk record
    await this.prisma.shipmentRisk.create({
      data: {
        shipmentId: shipment.id,
        score: assessment.score,
        signals: assessment.signals,
        status: 'ACTIVE'
      }
    });
    
    // Notify merchant
    await this.notificationService.sendToMerchant({
      merchantId: shipment.merchantId,
      title: 'Order Requires Verification',
      body: `Order ${shipment.trackingNumber} has been flagged. Please verify customer phone before dispatch.`,
      actionUrl: `/shipments/${shipment.id}/verify`
    });
    
    // Notify admin
    await this.notificationService.sendToAdmin({
      type: 'RISK_ALERT',
      severity: 'HIGH',
      message: `High risk shipment ${shipment.trackingNumber} requires verification`,
      shipmentId: shipment.id
    });
  }
  
  private async autoCancelOrReview(
    shipment: Shipment,
    assessment: RiskAssessment
  ): Promise<void> {
    if (assessment.score >= 90) {
      // Auto-cancel for extreme cases
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { 
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });
      
      await this.prisma.shipmentStatusLog.create({
        data: {
          shipmentId: shipment.id,
          previousStatus: 'PENDING',
          newStatus: 'CANCELLED',
          reason: `Auto-cancelled: Risk score ${assessment.score}`,
          changedByRole: 'SYSTEM'
        }
      });
      
      // Blacklist phone if fraud confirmed
      await this.blacklistPhone({
        phone: shipment.customerPhone,
        reason: 'AUTO_CANCELLED_HIGH_RISK',
        evidence: { shipmentId: shipment.id, score: assessment.score }
      });
      
    } else {
      // Flag for manual review
      await this.holdForVerification(shipment, assessment);
    }
    
    // Always notify merchant
    await this.notificationService.sendToMerchant({
      merchantId: shipment.merchantId,
      title: 'Order Cancelled - Risk Detected',
      body: `Order ${shipment.trackingNumber} was cancelled due to high fraud risk.`,
      actionUrl: `/shipments/${shipment.id}`
    });
  }
}
```

---

## Blacklist Management

### Auto-Blacklist Rules

| Trigger | Duration | Reason |
|---------|----------|--------|
| 3 consecutive FAILED/RETURNED | 30 days | "3_CONSECUTIVE_FAILURES" |
| Confirmed fraud (admin marks) | Permanent | "FRAUD_CONFIRMED" |
| Customer refuses COD 3+ times | 60 days | "REPEATED_REFUSAL" |
| Phone unreachable 5+ times | 45 days | "UNREACHABLE" |

### Blacklist Implementation

```typescript
class BlacklistService {
  async autoBlacklist(phone: string, reason: string): Promise<void> {
    const existing = await this.prisma.blacklistedPhone.findUnique({
      where: { phone }
    });
    
    if (existing?.isPermanent) return; // Don't override permanent
    
    const duration = this.getBlacklistDuration(reason);
    const expiresAt = duration ? addDays(new Date(), duration) : null;
    
    await this.prisma.blacklistedPhone.upsert({
      where: { phone },
      create: {
        phone,
        reason,
        expiresAt,
        isPermanent: !duration
      },
      update: {
        reason,
        expiresAt,
        isPermanent: !duration,
        blockedAt: new Date()
      }
    });
    
    // Log to audit
    await this.auditLogService.log({
      action: 'PHONE_BLACKLISTED',
      entityType: 'BlacklistedPhone',
      entityId: phone,
      newValue: { reason, expiresAt }
    });
  }
  
  async cleanupExpiredBlacklists(): Promise<number> {
    const expired = await this.prisma.blacklistedPhone.findMany({
      where: {
        isPermanent: false,
        expiresAt: { lt: new Date() }
      }
    });
    
    await this.prisma.blacklistedPhone.deleteMany({
      where: {
        id: { in: expired.map(e => e.id) }
      }
    });
    
    return expired.length;
  }
  
  private getBlacklistDuration(reason: string): number | null {
    switch (reason) {
      case '3_CONSECUTIVE_FAILURES': return 30;
      case 'REPEATED_REFUSAL': return 60;
      case 'UNREACHABLE': return 45;
      case 'FRAUD_CONFIRMED': return null; // Permanent
      default: return 30;
    }
  }
}
```

---

## Background Jobs

### Risk Calculation Job

```typescript
// Runs every 15 minutes
@Processor('fraud-detection')
export class FraudDetectionProcessor {
  @Process('calculate-risk')
  async handleRiskCalculation(job: Job) {
    const { shipmentId } = job.data;
    
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { merchant: true }
    });
    
    if (!shipment || shipment.riskScore > 0) {
      return; // Already calculated
    }
    
    const assessment = await this.fraudService.calculateRiskScore(shipment);
    
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { riskScore: assessment.score }
    });
    
    await this.prisma.shipmentRisk.create({
      data: {
        shipmentId,
        score: assessment.score,
        signals: assessment.signals,
        status: 'ACTIVE'
      }
    });
    
    await this.riskActionService.applyRiskAction(shipment, assessment);
  }
}
```

### Periodic Cleanup Job

```typescript
// Runs daily at 3 AM
@Processor('fraud-detection')
export class FraudCleanupProcessor {
  @Process('cleanup-expired')
  async handleCleanup() {
    const cleaned = await this.blacklistService.cleanupExpiredBlacklists();
    this.logger.log(`Cleaned up ${cleaned} expired blacklists`);
  }
}
```

---

## Phone Verification Flow

### SMS Ping on Creation

```typescript
async function verifyPhoneOnCreation(phone: string): Promise<boolean> {
  // Send a silent SMS (no content, just delivery check)
  const result = await this.twilio.messages.create({
    to: phone,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: 'Your order has been received. Track at: trackora.com',
    statusCallback: `${process.env.API_URL}/webhooks/twilio/sms-status`
  });
  
  // Wait for status callback (async)
  // If status = "delivered", phone is reachable
  // If status = "failed" or "undelivered", flag as unreachable
  
  return true; // Async verification
}
```

### Status Callback Handler

```typescript
@Post('webhooks/twilio/sms-status')
async handleSmsStatus(@Body() payload: TwilioStatusPayload) {
  const { MessageStatus, To } = payload;
  
  if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
    // Find shipment by phone
    const shipment = await this.prisma.shipment.findFirst({
      where: { customerPhone: To },
      orderBy: { createdAt: 'desc' }
    });
    
    if (shipment) {
      await this.fraudService.addSignal(shipment.id, {
        signal: 'PHONE_UNREACHABLE',
        weight: 40
      });
    }
  }
}
```

---

## Merchant Verification UI

### High-Risk Shipment Card

```typescript
function HighRiskShipmentCard({ shipment }: { shipment: Shipment }) {
  return (
    <Card variant="warning">
      <CardHeader>
        <AlertTriangleIcon />
        <span>Requires Verification</span>
      </CardHeader>
      
      <CardBody>
        <p>Risk Score: {shipment.riskScore}/100</p>
        
        <RiskSignalsList signals={shipment.risk?.signals} />
        
        <VerificationActions>
          <Button 
            onClick={() => verifyByPhoneCall(shipment.id)}
            variant="primary"
          >
            I Called and Verified Customer
          </Button>
          
          <Button 
            onClick={() => cancelShipment(shipment.id)}
            variant="danger"
          >
            Cancel Order (Suspected Fraud)
          </Button>
        </VerificationActions>
      </CardBody>
    </Card>
  );
}
```

---

## Metrics & Reporting

### Fraud Detection Dashboard

| Metric | Description |
|--------|-------------|
| Flagged Orders/Day | Number of orders with risk score > 25 |
| Cancellation Rate | % of flagged orders that were cancelled |
| False Positive Rate | % of flagged orders that were legitimate (merchant verified) |
| Blacklist Size | Total phone numbers currently blacklisted |
| Top Risk Signals | Most frequently triggered signals |

### Alerts

- **Daily Report:** Summary of flagged orders, actions taken, new blacklists
- **Real-time Alert:** CRITICAL risk score detected (SMS to ops manager)
- **Weekly Review:** False positive analysis, signal weight adjustments

---

## Privacy & Compliance

### Data Retention

- Risk signals: 90 days after shipment completion
- Blacklist entries: As per expiry date (30-60 days) or permanent for confirmed fraud
- Phone verification logs: 30 days
- Audit logs: 1 year

### GDPR/CCPA Considerations

- Right to explanation: Merchant can view why order was flagged
- Right to appeal: Merchant can request manual review
- Data minimization: Only store signals necessary for fraud detection

---

**Next:** See ROADMAP.md for the implementation roadmap.
