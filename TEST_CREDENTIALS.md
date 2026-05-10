# Test Credentials & Quick Start Guide

> Auto-generated from `prisma/seed.ts` — covers all three user personas for end-to-end testing.

---

## 🔐 Login Credentials

### 1. Admin (Super Admin)
| Field | Value |
|-------|-------|
| **Phone** | `01099999999` |
| **Password** | `admin123` |
| **Role** | `SUPER_ADMIN` |
| **Name** | System Administrator |

**Typical Actions**
- Approve / reject merchant KYC
- Manage zones & pricing
- View courier cash deposits & reconcile COD
- Override shipment statuses & assignments
- Process merchant payouts

---

### 2. Merchant
| Field | Value |
|-------|-------|
| **Phone** | `01000000001` |
| **Password** | `merchant123` |
| **Role** | `MERCHANT` |
| **Business Name** | محل الأحمدي للتجارة |
| **Commission Rate** | 12% |
| **Fee / Shipment** | 35 EGP |
| **Credit Limit** | 50,000 EGP |

**Typical Actions**
- Create new shipments (COD / Prepaid)
- Track shipment timeline
- View wallet balance & transactions
- Request payout (min 500 EGP)
- Bulk-upload shipments via Excel

**Current Wallet Status**
- Balance: **0.00 EGP** (no transactions seeded — ready for real COD settlement flow)

---

### 3. Couriers (3 مناديب)

#### Courier A — أحمد السقا
| Field | Value |
|-------|-------|
| **Phone** | `01011111111` |
| **Password** | `courier123` |
| **Vehicle** | Motorcycle |
| **Zones** | حي شرق المنصورة, حي غرب المنصورة, توريل, توريل الجديدة |
| **Cash Held** | **775 EGP** (after daily deposit) |
| **Capacity** | 30 / day |

#### Courier B — محمد عبدالله
| Field | Value |
|-------|-------|
| **Phone** | `01022222222` |
| **Password** | `courier123` |
| **Vehicle** | Motorcycle |
| **Zones** | حي الجامعة, المشاية, شارع الجمهورية, الجلاء |
| **Cash Held** | **910 EGP** |
| **Capacity** | 30 / day |

#### Courier C — خالد محمود
| Field | Value |
|-------|-------|
| **Phone** | `01033333333` |
| **Password** | `courier123` |
| **Vehicle** | Car |
| **Zones** | شارع الجيش, الدراسات, جديلة, قولونجيل, سندوب |
| **Cash Held** | **0 EGP** |
| **Capacity** | 30 / day |

**Typical Actions**
- Sync active assignments (PENDING → PICKED_UP → OUT_FOR_DELIVERY)
- Collect COD & verify 4-digit OTP
- Mark DELIVERED / FAILED / RETURNED
- Deposit cash to admin (daily recap)
- Offline sync support (PWA)

---

## 📦 Demo Shipments (Ready to Test)

| Tracking Number | Customer | Zone | Status | COD | Assigned To |
|-----------------|----------|------|--------|-----|-------------|
| `TRK-1778262264212-5855` | محمد علي | حي شرق المنصورة | **DELIVERED** | 450 EGP | أحمد السقا |
| `TRK-1778262264233-208` | سارة أحمد | حي غرب المنصورة | **DELIVERED** | 320 EGP | أحمد السقا |
| `TRK-1778262264248-887` | عبدالرحمن حسن | توريل | **DELIVERED** | 780 EGP | أحمد السقا |
| `TRK-1778262264260-1440` | نور سعيد | حي الجامعة | **DELIVERED** | 120 EGP | محمد عبدالله |
| `TRK-1778262264276-6305` | أمينة خالد | المشاية | **DELIVERED** | 250 EGP | محمد عبدالله |
| `TRK-1778262264288-7570` | يوسف إبراهيم | شارع الجمهورية | **DELIVERED** | 540 EGP | محمد عبدالله |
| `TRK-1778262264303-8044` | ليلى محمود | الجلاء | **FAILED** | 890 EGP | محمد عبدالله |
| `TRK-1778262264317-7109` | طارق سامي | شارع الجيش | **RETURNED** | 175 EGP | خالد محمود |
| `TRK-1778262264332-1460` | رانيا فؤاد | الدراسات | **PENDING** | 630 EGP | خالد محمود |
| `TRK-1778262264381-8424` | سيد عبدالله | جديلة | **PENDING** | 210 EGP | خالد محمود |
| `TRK-1778262264396-1263` | هند مصطفى | قولونجيل | **PENDING** | 340 EGP | خالد محمود |
| `TRK-1778262264410-5570` | كريم نبيل | سندوب | **PENDING** | 410 EGP | خالد محمود |

**Test Flows**
1. **Delivery Cycle**: Login as courier → pick PENDING shipment → OUT_FOR_DELIVERY → collect COD + OTP → DELIVERED.
2. **Cash Reconciliation**: Admin dashboard should show courier cash held increasing, then verify deposit record after daily recap.
3. **Merchant Payout**: After enough deliveries, merchant requests payout → admin approves → wallet balance updates.

---

## 🗺️ Zones Summary (Dakahlia)

- **Governorate**: الدقهلية (`dakahlia`)
- **Total Centers**: 18 (المنصورة, أجا, طلخا, ميت غمر, السنبلاوين, ...)
- **Total Districts / Villages**: 522+ (all inserted from JSON tree)
- **Hierarchy**: `Egypt → Dakahlia → Center → City → District/Village`

---

## 🛠️ How to Re-Seed

```bash
npx prisma db seed
```

> The seed script is **idempotent** — safe to re-run. Existing zones, users, and couriers are skipped or updated in place.

---

## 🔗 Related Docs

- `prisma/schema.prisma` — full DB schema
- `prisma/seed.ts` — seed logic & simulation steps
- `AGENTS.md` — project conventions & architecture rules
