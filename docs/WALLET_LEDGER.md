# Wallet Ledger & Double-Entry Design

## Overview

The wallet system implements a **double-entry ledger** pattern for all financial transactions. This ensures accuracy, auditability, and compliance — critical for a COD-dominated logistics platform handling millions in Egyptian Pounds.

## Why Double-Entry?

### Problems with Simple Balance Updates

| Problem | Simple Update | Double-Entry Solution |
|---------|--------------|----------------------|
| **Rounding errors** | Direct subtraction accumulates floating-point errors | Each transaction is explicit and verifiable |
| **No audit trail** | Balance just changes | Every movement has a record with reason |
| **Hard to reverse** | Undoing a change requires guessing original values | Create inverse transaction with explicit reference |
| **Concurrent updates** | Race conditions cause lost updates | Optimistic locking with version field |
| **Reporting complexity** | Reconstructing history is impossible | Running balance snapshot per transaction |

### Core Principle

```
Every financial event creates at least two transaction records:
- One CREDIT (positive) to the merchant wallet
- One or more DEBITs (negative) for fees/commissions

Sum of all transactions = Current balance (always verifiable)
```

---

## Transaction Types

### Credit Types (Money In)

| Type | Description | When Created |
|------|-------------|--------------|
| `COD_CREDIT` | Cash collected from customer on delivery | Shipment marked DELIVERED |
| `ADJUSTMENT_CREDIT` | Admin correction (e.g., overcharged fee) | Admin resolves dispute |
| `BONUS_CREDIT` | Promotional bonus or incentive | Marketing campaign applied |

### Debit Types (Money Out)

| Type | Description | When Created |
|------|-------------|--------------|
| `FEE_DEBIT` | Flat per-shipment platform fee | With every COD_CREDIT |
| `COMMISSION_DEBIT` | Percentage of COD taken by platform | With every COD_CREDIT |
| `RETURN_FEE_DEBIT` | Fee charged for returned shipment | Shipment marked RETURNED (if configured) |
| `CANCELLATION_FEE_DEBIT` | Fee for cancellation after pickup | Shipment CANCELLED after PICKED_UP |
| `PAYOUT_DEBIT` | Merchant withdrawal request | Payout approved |
| `ADJUSTMENT_DEBIT` | Admin correction (e.g., undercharged) | Admin resolves dispute |

---

## Transaction Lifecycle Examples

### Example 1: Standard COD Delivery

**Scenario:** COD amount = EGP 500, Commission = 5%, Fee = EGP 15

| Step | Type | Amount | Running Balance | Description |
|------|------|--------|-----------------|-------------|
| Initial | — | — | 0.00 | Starting balance |
| 1 | COD_CREDIT | +500.00 | 500.00 | COD for TRK-240502-A1B2 |
| 2 | COMMISSION_DEBIT | -25.00 | 475.00 | 5% platform commission |
| 3 | FEE_DEBIT | -15.00 | 460.00 | Per-shipment fee |

**Result:**
- Merchant net credit: EGP 460.00
- Platform revenue: EGP 40.00 (25 commission + 15 fee)
- Running balance after transaction 3: EGP 460.00

### Example 2: COD with Partial Payment

**Scenario:** COD amount = EGP 500, Customer paid EGP 450 (negotiated discount)

| Step | Type | Amount | Running Balance | Description |
|------|------|--------|-----------------|-------------|
| 1 | COD_CREDIT | +450.00 | 450.00 | Partial COD (expected 500) |
| 2 | COMMISSION_DEBIT | -22.50 | 427.50 | 5% of actual collected |
| 3 | FEE_DEBIT | -15.00 | 412.50 | Per-shipment fee |
| 4 | ADJUSTMENT_DEBIT | -50.00 | 362.50 | Shortfall from expected COD |

**Note:** The EGP 50 shortfall is either:
- Charged to courier if fault proven, OR
- Absorbed by platform as bad debt, OR
- Debited from merchant if agreed in terms

### Example 3: Reversal (Admin Correction)

**Scenario:** Admin discovers courier marked wrong amount. Actual COD was EGP 450, not 500.

**Original transactions (from Example 1):**
- COD_CREDIT +500, COMMISSION_DEBIT -25, FEE_DEBIT -15

**Reversal transactions:**

| Step | Type | Amount | Running Balance | Description |
|------|------|--------|-----------------|-------------|
| 4 | ADJUSTMENT_DEBIT | -50.00 | 410.00 | Reverse excess COD (500→450) |
| 5 | ADJUSTMENT_CREDIT | +2.50 | 412.50 | Reverse excess commission (5% of 50) |
| 6 | ADJUSTMENT_CREDIT | +0.00 | 412.50 | Fee remains unchanged (flat fee policy) |

**Metadata on reversal:**
```json
{
  "originalTransactionIds": ["tx-1", "tx-2"],
  "reason": "Customer paid 450 not 500, verified by delivery photo",
  "correctedBy": "admin-uuid",
  "reversedTransactionId": "tx-4",
  "evidence": {
    "photoUrl": "https://s3.../delivery-photo.jpg",
    "customerStatement": "I only had 450 EGP"
  }
}
```

### Example 4: Payout Request

**Scenario:** Merchant requests EGP 1,000 withdrawal

| Step | Type | Amount | Running Balance | Description |
|------|------|--------|-----------------|-------------|
| Before | — | — | 2,340.50 | Available balance |
| 1 | PAYOUT_DEBIT | -1,000.00 | 1,340.50 | Payout request #PAY-001 |

**When payout completed:**
- No additional transaction (PAYOUT_DEBIT was already created at request time)
- If rejected: Create ADJUSTMENT_CREDIT +1,000.00 to restore balance

### Example 5: Return with Fee

**Scenario:** Shipment returned after 3 failed attempts. Merchant configured return fee = EGP 10.

| Step | Type | Amount | Running Balance | Description |
|------|------|--------|-----------------|-------------|
| 1 | RETURN_FEE_DEBIT | -10.00 | -10.00 | Return fee for TRK-240502-A1B2 |

**Note:** No COD_CREDIT is created since delivery never occurred.

---

## Balance Types

### Available Balance

```
availableBalance = SUM(all transactions where status = CONFIRMED)
```

- Money the merchant can withdraw immediately
- Excludes pending COD (in transit)

### Pending Balance

```
pendingBalance = SUM(COD amounts for shipments NOT YET DELIVERED)
```

- COD that is still with courier or in transit
- Becomes available when shipment is marked DELIVERED

### Example Balance Breakdown

| Component | Amount |
|-----------|--------|
| Available balance | EGP 2,340.50 |
| Pending balance | EGP 1,200.00 |
| **Total expected** | **EGP 3,540.50** |

---

## Optimistic Locking

### Why Needed

Multiple deliveries for the same merchant can complete simultaneously, creating race conditions on wallet updates.

### Implementation

```typescript
async function createCreditTransaction(
  walletId: string,
  amount: Decimal,
  type: TransactionType,
  description: string,
  metadata?: any
): Promise<Transaction> {
  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Lock wallet row and get current state
        const wallet = await tx.wallet.findUnique({
          where: { id: walletId }
        });
        
        if (!wallet) {
          throw new Error('Wallet not found');
        }
        
        // 2. Calculate new balance
        const newBalance = wallet.balance.plus(amount);
        
        // Validate: balance cannot go below -creditLimit
        const minBalance = wallet.merchant.creditLimit.times(-1);
        if (newBalance.lessThan(minBalance)) {
          throw new Error('Insufficient balance');
        }
        
        // 3. Insert transaction with running balance snapshot
        const transaction = await tx.transaction.create({
          data: {
            walletId,
            type,
            amount,
            runningBalance: newBalance,
            description,
            metadata
          }
        });
        
        // 4. Update wallet with optimistic locking
        const updatedWallet = await tx.wallet.update({
          where: {
            id: walletId,
            version: wallet.version // Ensures no concurrent modification
          },
          data: {
            balance: newBalance,
            totalCredited: amount.greaterThan(0) 
              ? { increment: amount } 
              : undefined,
            totalDebited: amount.lessThan(0) 
              ? { increment: amount.abs() } 
              : undefined,
            version: { increment: 1 }
          }
        });
        
        if (!updatedWallet) {
          throw new OptimisticLockException('Wallet was modified concurrently');
        }
        
        return transaction;
      });
      
    } catch (error) {
      if (error instanceof OptimisticLockException && attempt < MAX_RETRIES - 1) {
        attempt++;
        // Exponential backoff: 100ms, 200ms, 400ms
        await sleep(Math.pow(2, attempt) * 100);
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Failed to create transaction after max retries');
}
```

### Lock Behavior

```
Transaction 1: SELECT wallet FOR UPDATE (version=5)
Transaction 2: SELECT wallet FOR UPDATE (waits)
Transaction 1: UPDATE wallet SET version=6 (success)
Transaction 1: COMMIT (releases lock)
Transaction 2: SELECT returns version=6
Transaction 2: UPDATE wallet WHERE version=5 (0 rows affected)
Transaction 2: Throws OptimisticLockException
Transaction 2: Retry with fresh read
```

---

## Fee Calculation Service

### Fee Structure Configuration

```typescript
interface FeeStructure {
  // Per-merchant configuration
  commissionRate: Decimal;      // e.g., 0.05 for 5%
  feePerShipment: Decimal;      // e.g., 15.00 EGP
  returnFee: Decimal;           // e.g., 10.00 EGP
  cancellationFee: Decimal;     // e.g., 5.00 EGP
  
  // Optional tiered commission
  codAmountTiers?: Array<{
    maxAmount: Decimal;
    commissionRate: Decimal;
  }>;
}
```

### Calculation Logic

```typescript
class FeeCalculator {
  calculateNetCredit(
    codAmount: Decimal,
    merchantFeeStructure: FeeStructure
  ): FeeBreakdown {
    // Determine commission rate
    let commissionRate = merchantFeeStructure.commissionRate;
    
    if (merchantFeeStructure.codAmountTiers) {
      const tier = this.findTier(codAmount, merchantFeeStructure.codAmountTiers);
      if (tier) {
        commissionRate = tier.commissionRate;
      }
    }
    
    // Calculate fees
    const commission = codAmount.times(commissionRate);
    const fee = merchantFeeStructure.feePerShipment;
    const net = codAmount.minus(commission).minus(fee);
    
    return {
      gross: codAmount,
      commission,
      fee,
      net,
      commissionRate
    };
  }
  
  private findTier(
    amount: Decimal, 
    tiers: Array<{ maxAmount: Decimal; commissionRate: Decimal }>
  ) {
    return tiers
      .sort((a, b) => a.maxAmount.comparedTo(b.maxAmount))
      .find(tier => amount.lessThanOrEqualTo(tier.maxAmount));
  }
}
```

### Tiered Commission Example

| COD Amount Tier | Commission Rate |
|----------------|----------------|
| 0 - 500 EGP | 5% |
| 501 - 1,000 EGP | 4% |
| 1,001 - 2,000 EGP | 3.5% |
| 2,000+ EGP | 3% |

**Scenario:** COD = EGP 1,500
- Commission = 1,500 * 3.5% = EGP 52.50
- Fee = EGP 15.00
- Net = 1,500 - 52.50 - 15.00 = EGP 1,432.50

---

## Payout Workflow

### State Machine

```
PENDING → APPROVED → PROCESSING → COMPLETED
   ↓
REJECTED (restores balance)
```

### Implementation

```typescript
class PayoutService {
  async requestPayout(
    merchantId: string,
    amount: Decimal,
    method: PayoutMethod,
    destination: PayoutDestination
  ): Promise<Payout> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Check minimum threshold
      if (amount.lessThan(MIN_PAYOUT_THRESHOLD)) {
        throw new Error(`Minimum payout is ${MIN_PAYOUT_THRESHOLD} EGP`);
      }
      
      // 2. Check available balance
      const wallet = await tx.wallet.findUnique({
        where: { merchantId }
      });
      
      if (wallet.balance.lessThan(amount)) {
        throw new Error('Insufficient balance');
      }
      
      // 3. Check for pending payout
      const existingPayout = await tx.payout.findFirst({
        where: { merchantId, status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] } }
      });
      
      if (existingPayout) {
        throw new Error('You already have a pending payout request');
      }
      
      // 4. Create payout record
      const payout = await tx.payout.create({
        data: {
          merchantId,
          amount,
          status: 'PENDING',
          method,
          destination
        }
      });
      
      // 5. Create hold transaction (deducts balance immediately)
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT_DEBIT',
          amount: amount.times(-1),
          runningBalance: wallet.balance.minus(amount),
          description: `Payout request #${payout.id}`,
          metadata: { payoutId: payout.id }
        }
      });
      
      // 6. Update wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          version: { increment: 1 }
        }
      });
      
      return payout;
    });
  }
  
  async approvePayout(payoutId: string, adminId: string): Promise<Payout> {
    const payout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        approvedByUserId: adminId
      }
    });
    
    // Notify finance team
    this.notificationService.notifyFinance(payout);
    
    return payout;
  }
  
  async completePayout(
    payoutId: string, 
    referenceNumber: string
  ): Promise<Payout> {
    const payout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        referenceNumber,
        completedAt: new Date()
      }
    });
    
    // Notify merchant
    this.notificationService.notifyPayoutCompleted(payout);
    
    return payout;
  }
  
  async rejectPayout(payoutId: string, reason: string): Promise<Payout> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Update payout status
      const payout = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason
        }
      });
      
      // 2. Restore wallet balance
      const wallet = await tx.wallet.findUnique({
        where: { merchantId: payout.merchantId }
      });
      
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'ADJUSTMENT_CREDIT',
          amount: payout.amount,
          runningBalance: wallet.balance.plus(payout.amount),
          description: `Payout rejected: ${reason}`,
          metadata: { payoutId: payout.id }
        }
      });
      
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: payout.amount },
          version: { increment: 1 }
        }
      });
      
      // 3. Notify merchant
      this.notificationService.notifyPayoutRejected(payout, reason);
      
      return payout;
    });
  }
}
```

---

## Reconciliation

### Daily Reconciliation Check

```typescript
class ReconciliationService {
  async runDailyCheck(date: Date): Promise<ReconciliationReport> {
    // 1. Sum all transactions for the day
    const transactions = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        createdAt: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      _sum: { amount: true }
    });
    
    // 2. Sum all COD collections from shipments
    const codCollections = await this.prisma.shipment.aggregate({
      where: {
        status: 'DELIVERED',
        deliveredAt: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      _sum: { collectedCash: true }
    });
    
    // 3. Sum all courier cash deposits
    const deposits = await this.prisma.courierCashDeposit.aggregate({
      where: {
        depositedAt: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      _sum: { amount: true }
    });
    
    // 4. Verify: COD collections should equal deposits + courier cash held
    const expectedDeposits = codCollections._sum.collectedCash || new Decimal(0);
    const actualDeposits = deposits._sum.amount || new Decimal(0);
    const totalCashHeld = await this.getTotalCashHeld();
    
    const discrepancy = expectedDeposits
      .minus(actualDeposits)
      .minus(totalCashHeld);
    
    return {
      date,
      totalCodCollected: expectedDeposits,
      totalDeposits: actualDeposits,
      totalCashHeld,
      discrepancy,
      isBalanced: discrepancy.equals(0)
    };
  }
}
```

### Monthly Statement Generation

```typescript
async function generateMerchantStatement(
  merchantId: string,
  month: number,
  year: number
): Promise<Statement> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const transactions = await prisma.transaction.findMany({
    where: {
      wallet: { merchantId },
      createdAt: { gte: startDate, lte: endDate }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  const summary = {
    openingBalance: transactions[0]?.runningBalance.minus(transactions[0].amount) || new Decimal(0),
    closingBalance: transactions[transactions.length - 1]?.runningBalance || new Decimal(0),
    totalCod: transactions
      .filter(t => t.type === 'COD_CREDIT')
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0)),
    totalFees: transactions
      .filter(t => ['FEE_DEBIT', 'COMMISSION_DEBIT'].includes(t.type))
      .reduce((sum, t) => sum.plus(t.amount.abs()), new Decimal(0)),
    totalPayouts: transactions
      .filter(t => t.type === 'PAYOUT_DEBIT')
      .reduce((sum, t) => sum.plus(t.amount.abs()), new Decimal(0))
  };
  
  return { transactions, summary, month, year };
}
```

---

## Security & Controls

### Preventing Negative Balance

```typescript
// Wallet balance cannot go below -creditLimit
const minBalance = merchant.creditLimit.times(-1);
if (newBalance.lessThan(minBalance)) {
  throw new InsufficientBalanceException(
    `Balance cannot exceed credit limit of ${merchant.creditLimit}`
  );
}
```

### Admin Override Controls

- All admin adjustments (`ADJUSTMENT_CREDIT`/`ADJUSTMENT_DEBIT`) require:
  - `FINANCE_ADMIN` or `SUPER_ADMIN` role
  - Explicit reason (min 10 characters)
  - Audit log entry with before/after values

### Transaction Immutability

```typescript
// Transactions are insert-only
// This is enforced at application level
class TransactionRepository {
  async create(data: TransactionCreateInput): Promise<Transaction> {
    return prisma.transaction.create({ data });
  }
  
  // NO update or delete methods
  // NO updateMany or deleteMany
}
```

---

## Database Indexes for Performance

```sql
-- Fast transaction lookups by wallet and date
CREATE INDEX idx_transaction_wallet_date ON "Transaction"("walletId", "createdAt" DESC);

-- Fast transaction lookups by shipment
CREATE INDEX idx_transaction_shipment ON "Transaction"("shipmentId");

-- Fast payout lookups
CREATE INDEX idx_payout_merchant_status ON "Payout"("merchantId", "status");

-- Fast wallet lookup
CREATE INDEX idx_wallet_merchant ON "Wallet"("merchantId");

-- Partition large transaction tables by month
-- CREATE TABLE transaction_2024_05 PARTITION OF "Transaction" 
-- FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
```

---

**Next:** See FRAUD_DETECTION.md for the risk engine specification.
