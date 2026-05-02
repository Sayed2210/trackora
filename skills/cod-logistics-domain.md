# Skill: COD Logistics Domain Expert

## Description
Deep expertise in Cash-on-Delivery logistics operations, shipment lifecycle management, state machines, and financial reconciliation specific to MENA markets.

## When to Use
- Implementing business logic for shipments, deliveries, returns
- Designing state machines and workflows
- Calculating fees, commissions, and wallet transactions
- Handling edge cases in delivery operations
- Designing courier workflows and cash management

## Domain Knowledge

### Egyptian Market Context
- 60-80% of e-commerce orders are COD
- WhatsApp is primary business communication channel
- Informal addressing (landmarks critical)
- Intermittent 3G connectivity for couriers
- Social sellers lack formal business infrastructure

### Shipment Lifecycle States
```
PENDING → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
                     ↓
                   FAILED (3x) → RETURNED
                     ↓
                   POSTPONED
```

### Financial Rules
- Double-entry ledger for all wallet transactions
- Every COD credit has corresponding fee/commission debits
- Courier cashHeld must reconcile with collected COD
- Payout minimum: EGP 500
- One pending payout per merchant at a time

### Key Arabic Terms
- **مندوب (Mandoob):** Courier/Delivery agent
- **تحويل (Ta7weel):** Transfer/Remittance
- **كاش (Cash):** Cash-on-delivery
- **مخزن (Makhzen):** Warehouse
- **منطقة (Manteqa):** Zone/Area

## State Machine Rules

### Allowed Transitions
- PENDING → PICKED_UP, IN_WAREHOUSE, CANCELLED
- PICKED_UP → IN_WAREHOUSE, OUT_FOR_DELIVERY
- IN_WAREHOUSE → OUT_FOR_DELIVERY, RETURNED
- OUT_FOR_DELIVERY → DELIVERED, FAILED, POSTPONED, RETURNED
- FAILED → PENDING (retry), OUT_FOR_DELIVERY (retry), POSTPONED, RETURNED
- POSTPONED → OUT_FOR_DELIVERY, CANCELLED

### Invalid Transitions (Always Block)
- DELIVERED → * (terminal state)
- RETURNED → OUT_FOR_DELIVERY
- CANCELLED → *
- OUT_FOR_DELIVERY → PENDING

## Financial Transaction Rules

### COD Delivery Example (EGP 500, 5% commission, EGP 15 fee)
```
1. COD_CREDIT: +500.00
2. COMMISSION_DEBIT: -25.00
3. FEE_DEBIT: -15.00
Net to merchant: EGP 460.00
```

### Reversal Rules
- Never delete transactions
- Create inverse transactions with reference to original
- Update running balance snapshot
- Log reason and evidence in metadata

## Courier Cash Management
- cashHeld accumulates with each COD delivery
- Daily deposit required when cashHeld > cashHeldLimit (default EGP 5,000)
- Deposit recorded in CourierCashDeposit table
- Discrepancies flagged for admin review

## Edge Cases Database

| Scenario | Resolution |
|----------|------------|
| Customer not home | Mark FAILED, increment attempts. After 3 attempts, auto-return. |
| Partial COD payment | Record actual amount. Flag discrepancy. Admin reviews photo evidence. |
| Wrong OTP | Allow 3 attempts. Lock after 3. Courier calls admin. |
| Customer cancels after pickup | Status → RETURNED. Charge return fee if configured. |
| Courier damages package | Status → RETURNED from IN_WAREHOUSE. Warehouse fault investigation. |
| Fake address | Geocoding fails. Flag for manual zone assignment. |
| Phone unreachable | 3 attempts over 2 days. Then RETURNED. |
| Customer reschedules | Status → POSTPONED. Do NOT increment deliveryAttempts. |
| Package lost in transit | Investigation. Insurance claim if productValue > threshold. |

## Validation Checklist
- [ ] State transition validated before update
- [ ] Financial transactions atomic (all or nothing)
- [ ] Optimistic locking on wallet updates
- [ ] Delivery attempts tracked correctly
- [ ] Return reasons structured and logged
- [ ] Cash discrepancies flagged
- [ ] OTP verified for COD deliveries

## Example Usage
User: "What happens when a courier marks a delivery as failed for the third time?"
→ Use this skill to explain the auto-return workflow, financial impact, and notifications triggered.
