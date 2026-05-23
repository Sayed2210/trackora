import { PrismaClient, ZoneLevel, ShipmentStatus, AssignmentStatus, AssignmentType, UserRole, VehicleType, FeatureFlagKey } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Types from JSON ─────────────────────────────────────────────────────────
interface JsonZone {
  id: string;
  name_ar: string;
  name_en?: string | null;
  type: string;
  lat?: number | null;
  lng?: number | null;
  aliases?: string[];
  delivery_enabled?: boolean;
  price?: number | null;
  estimated_delivery_hours?: number | null;
  polygon?: number[][];
}

interface JsonCity {
  id: string;
  name_ar: string;
  name_en?: string | null;
  type: string;
  lat?: number | null;
  lng?: number | null;
  zones: JsonZone[];
}

interface JsonCenter {
  id: string;
  name_ar: string;
  name_en?: string | null;
  type: string;
  lat?: number | null;
  lng?: number | null;
  cities: JsonCity[];
  villages: JsonZone[];
}

interface JsonGovernorate {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  lat?: number | null;
  lng?: number | null;
  meta?: unknown;
  centers: JsonCenter[];
}

const PLAN_FEATURE_KEYS = Object.values(FeatureFlagKey);

const OWNER_SEED_EMAIL = 'owner@trackora.local';
const OWNER_SEED_PHONE = '01013453391';
const OWNER_SEED_NAME = 'Trackora System Owner';
const DEV_OWNER_SEED_PASSWORD = 'Owner@123456';

const platformPlans = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Entry plan for early sellers and small delivery operations.',
    monthlyPrice: '999.00',
    monthlyShipmentLimit: 1000,
    adminUserLimit: 3,
    merchantLimit: 10,
    courierLimit: 10,
    features: {
      bulk_upload: true,
      public_tracking: true,
    },
  },
  {
    name: 'Growth',
    slug: 'growth',
    description: 'Growth plan for scaling merchants and regional teams.',
    monthlyPrice: '4999.00',
    monthlyShipmentLimit: 10000,
    adminUserLimit: 10,
    merchantLimit: 100,
    courierLimit: 50,
    features: {
      bulk_upload: true,
      public_tracking: true,
      cod_wallet: true,
      whatsapp_notifications: true,
    },
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Advanced automation plan for large logistics operations.',
    monthlyPrice: '14999.00',
    monthlyShipmentLimit: 50000,
    adminUserLimit: 50,
    merchantLimit: 1000,
    courierLimit: 300,
    features: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, true])),
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom pricing plan for enterprise logistics networks.',
    monthlyPrice: '0.00',
    monthlyShipmentLimit: null,
    adminUserLimit: null,
    merchantLimit: null,
    courierLimit: null,
    features: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, true])),
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

function getOwnerSeedPassword(): string {
  const password = process.env.OWNER_SEED_PASSWORD;
  if (password) return password;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('OWNER_SEED_PASSWORD is required to seed PLATFORM_OWNER in production');
  }

  return DEV_OWNER_SEED_PASSWORD;
}

async function seedPlatformOwner() {
  const phoneConflict = await prisma.user.findFirst({
    where: {
      phone: OWNER_SEED_PHONE,
      email: { not: OWNER_SEED_EMAIL },
    },
    select: { id: true, email: true },
  });

  if (phoneConflict) {
    throw new Error(
      `Cannot seed PLATFORM_OWNER: phone ${OWNER_SEED_PHONE} is already used by user ${phoneConflict.id}`,
    );
  }

  const passwordHash = await bcrypt.hash(getOwnerSeedPassword(), 12);

  await prisma.user.upsert({
    where: { email: OWNER_SEED_EMAIL },
    create: {
      name: OWNER_SEED_NAME,
      email: OWNER_SEED_EMAIL,
      phone: OWNER_SEED_PHONE,
      role: UserRole.PLATFORM_OWNER,
      isActive: true,
      passwordHash,
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
    update: {
      name: OWNER_SEED_NAME,
      phone: OWNER_SEED_PHONE,
      role: UserRole.PLATFORM_OWNER,
      isActive: true,
      passwordHash,
    },
  });

  console.log(`✅ Seeded platform owner: ${OWNER_SEED_EMAIL}`);
}

async function seedPlatformPlans() {
  for (const key of PLAN_FEATURE_KEYS) {
    await prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        name: key
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
      },
      update: {},
    });
  }

  for (const plan of platformPlans) {
    const record = await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        currency: 'EGP',
        monthlyShipmentLimit: plan.monthlyShipmentLimit,
        adminUserLimit: plan.adminUserLimit,
        merchantLimit: plan.merchantLimit,
        courierLimit: plan.courierLimit,
      },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        currency: 'EGP',
        monthlyShipmentLimit: plan.monthlyShipmentLimit,
        adminUserLimit: plan.adminUserLimit,
        merchantLimit: plan.merchantLimit,
        courierLimit: plan.courierLimit,
      },
    });

    await prisma.planFeatureFlag.deleteMany({ where: { planId: record.id } });
    await prisma.planFeatureFlag.createMany({
      data: PLAN_FEATURE_KEYS.map((key) => ({
        planId: record.id,
        featureKey: key,
        enabled: plan.features[key] ?? false,
      })),
    });
  }

  console.log('✅ Seeded platform plans: Starter, Growth, Pro, Enterprise');
}

async function main() {
  if (process.env.OWNER_SEED_ONLY === 'true') {
    console.log('🌱 Start seeding platform owner...');
    await seedPlatformOwner();
    return;
  }

  console.log('🌱 Start seeding Dakahlia + demo data...');

  await seedPlatformOwner();
  await seedPlatformPlans();

  // ── 1. Ensure Egypt exists ────────────────────────────────────────────────
  let egypt = await prisma.zone.findFirst({ where: { code: 'EG' } });
  if (!egypt) {
    egypt = await prisma.zone.create({
      data: { level: 'COUNTRY', nameAr: 'مصر', nameEn: 'Egypt', code: 'EG' },
    });
    console.log('✅ Created Egypt');
  } else {
    console.log('ℹ️  Egypt already exists');
  }

  // ── 2. Load & parse Dakahlia JSON ─────────────────────────────────────────
  const jsonPath = path.resolve('./dakahlia-mansoura-shipping-tree.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const gov: JsonGovernorate = JSON.parse(raw);

  // ── 3. Insert Governorate ─────────────────────────────────────────────────
  let dakahlia = await prisma.zone.findFirst({ where: { code: gov.id } });
  if (!dakahlia) {
    dakahlia = await prisma.zone.create({
      data: {
        level: ZoneLevel.GOVERNORATE,
        nameAr: gov.name_ar,
        nameEn: gov.name_en,
        code: gov.id,
        parentId: egypt.id,
        centerLat: gov.lat ?? null,
        centerLng: gov.lng ?? null,
      },
    });
    console.log(`✅ Created Governorate: ${gov.name_ar}`);
  } else {
    console.log(`ℹ️  Governorate ${gov.name_ar} already exists`);
  }

  // ── 4. Insert Centers & nested zones/villages ─────────────────────────────
  let totalZones = 0;
  for (const center of gov.centers) {
    let centerZone = await prisma.zone.findFirst({ where: { code: center.id } });
    if (!centerZone) {
      centerZone = await prisma.zone.create({
        data: {
          level: ZoneLevel.CITY,
          nameAr: center.name_ar,
          nameEn: center.name_en ?? null,
          code: center.id,
          parentId: dakahlia.id,
          centerLat: center.lat ?? null,
          centerLng: center.lng ?? null,
        },
      });
      console.log(`  ✅ Center: ${center.name_ar}`);
    }

    // Cities inside center → we treat them as sub-cities or skip if no zones
    for (const city of center.cities) {
      // If city has zones, we create the city as CITY and zones as DISTRICT
      // If no zones, we can skip creating a separate city row to avoid clutter
      if (city.zones.length === 0) continue;

      let cityZone = await prisma.zone.findFirst({ where: { code: city.id } });
      if (!cityZone) {
        cityZone = await prisma.zone.create({
          data: {
            level: ZoneLevel.CITY,
            nameAr: city.name_ar,
            nameEn: city.name_en ?? null,
            code: city.id,
            parentId: centerZone.id,
            centerLat: city.lat ?? null,
            centerLng: city.lng ?? null,
          },
        });
        console.log(`    ✅ City: ${city.name_ar}`);
      }

      const districtData = city.zones.map((z) => ({
        level: ZoneLevel.DISTRICT,
        nameAr: z.name_ar,
        nameEn: z.name_en ?? null,
        code: z.id,
        parentId: cityZone!.id,
        centerLat: z.lat ?? null,
        centerLng: z.lng ?? null,
        polygon: z.polygon && z.polygon.length > 0 ? (z.polygon as any) : undefined,
      }));

      if (districtData.length > 0) {
        await prisma.zone.createMany({ data: districtData, skipDuplicates: true });
        totalZones += districtData.length;
        console.log(`      ✅ ${districtData.length} districts in ${city.name_ar}`);
      }
    }

    // Villages directly under center → DISTRICT
    if (center.villages.length > 0) {
      const villageData = center.villages.map((v) => ({
        level: ZoneLevel.DISTRICT,
        nameAr: v.name_ar,
        nameEn: v.name_en ?? null,
        code: v.id,
        parentId: centerZone.id,
        centerLat: v.lat ?? null,
        centerLng: v.lng ?? null,
        polygon: v.polygon && v.polygon.length > 0 ? (v.polygon as any) : undefined,
      }));

      await prisma.zone.createMany({ data: villageData, skipDuplicates: true });
      totalZones += villageData.length;
      console.log(`    ✅ ${villageData.length} villages in ${center.name_ar}`);
    }
  }

  console.log(`\n📊 Total new districts/zones inserted: ${totalZones}`);

  // ── 5. Create Admin ───────────────────────────────────────────────────────
  const adminPhone = '01099999999';
  let adminUser = await prisma.user.findFirst({ where: { phone: adminPhone } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        phone: adminPhone,
        email: 'admin@trackora.demo',
        name: 'System Administrator',
        role: UserRole.SUPER_ADMIN,
        passwordHash: hashPassword('admin123'),
        phoneVerified: new Date(),
      },
    });
    console.log('✅ Created admin: System Administrator');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // ── 6. Create Merchant ────────────────────────────────────────────────────
  const merchantPhone = '01000000001';
  let merchantUser = await prisma.user.findFirst({ where: { phone: merchantPhone } });
  if (!merchantUser) {
    merchantUser = await prisma.user.create({
      data: {
        phone: merchantPhone,
        email: 'merchant@dakahlia.demo',
        name: 'محل الأحمدي للتجارة',
        role: UserRole.MERCHANT,
        passwordHash: hashPassword('merchant123'),
        phoneVerified: new Date(),
      },
    });
  }

  let merchant = await prisma.merchant.findFirst({ where: { userId: merchantUser.id } });
  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        userId: merchantUser.id,
        businessName: 'محل الأحمدي للتجارة',
        businessType: 'retail',
        commissionRate: 0.12,
        feePerShipment: 35,
        returnFee: 20,
        cancellationFee: 15,
        creditLimit: 50000,
        defaultPickupAddress: {
          street: 'شارع الجمهورية',
          zone: 'حي شرق المنصورة',
          city: 'المنصورة',
          governorate: 'الدقهلية',
          building: '12',
          floor: '3',
          apartment: '5',
          landmark: 'بجوار مسجد التوحيد',
        } as any,
      },
    });
    console.log('✅ Created merchant: محل الأحمدي للتجارة');
  }

  // Create wallet if missing
  const existingWallet = await prisma.wallet.findFirst({ where: { merchantId: merchant.id } });
  if (!existingWallet) {
    await prisma.wallet.create({
      data: { merchantId: merchant.id, balance: 0, currency: 'EGP' },
    });
    console.log('✅ Created merchant wallet');
  }

  // ── 6. Create Couriers (3 مناديب) ─────────────────────────────────────────
  const courierProfiles = [
    { phone: '01011111111', name: 'أحمد السقا', vehicle: VehicleType.MOTORCYCLE, zones: ['hay_sharq', 'hay_gharb', 'toriel', 'toriel_new'] },
    { phone: '01022222222', name: 'محمد عبدالله', vehicle: VehicleType.MOTORCYCLE, zones: ['hay_el_gamaa', 'mashayia', 'gomhoria_street', 'el_galaa'] },
    { phone: '01033333333', name: 'خالد محمود', vehicle: VehicleType.CAR, zones: ['el_geish_street', 'el_derasat', 'gedila', 'qolongeel', 'sandoub'] },
  ];

  const createdCouriers: { id: string; name: string; phone: string; zones: string[] }[] = [];

  for (const cp of courierProfiles) {
    let user = await prisma.user.findFirst({ where: { phone: cp.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: cp.phone,
          name: cp.name,
          role: UserRole.COURIER,
          passwordHash: hashPassword('courier123'),
          phoneVerified: new Date(),
        },
      });
    }

    let courier = await prisma.courier.findFirst({ where: { userId: user.id } });
    if (!courier) {
      courier = await prisma.courier.create({
        data: {
          userId: user.id,
          vehicleType: cp.vehicle,
          zoneCodes: cp.zones,
          maxDailyCapacity: 30,
          cashHeldLimit: 8000,
          isActive: true,
          isAvailable: true,
        },
      });
      console.log(`✅ Created courier: ${cp.name} → zones: ${cp.zones.join(', ')}`);
    } else {
      // Update zones if re-running seed
      courier = await prisma.courier.update({
        where: { id: courier.id },
        data: { zoneCodes: cp.zones },
      });
      console.log(`ℹ️  Courier ${cp.name} already exists, updated zones`);
    }
    createdCouriers.push({ id: courier.id, name: cp.name, phone: cp.phone, zones: cp.zones });
  }

  // ── 7. Create Shipments (sample across Mansoura zones) ────────────────────
  const shipmentData = [
    { customerName: 'محمد علي', phone: '01012345678', zoneCode: 'hay_sharq', addressText: 'حي شرق المنصورة، شارع 23 يوليو، عمارة 5', codAmount: 450, product: 'هاتف سامسونج A54', pieces: 1 },
    { customerName: 'سارة أحمد', phone: '01012345679', zoneCode: 'hay_gharb', addressText: 'حي غرب المنصورة، شارع الجلاء، فيلا 12', codAmount: 320, product: 'شنطة يد جلد طبيعي', pieces: 1 },
    { customerName: 'عبدالرحمن حسن', phone: '01012345680', zoneCode: 'toriel', addressText: 'توريل، شارع النخيل، برج الأمل، شقة 3', codAmount: 780, product: 'سماعات بلوتوث Sony', pieces: 1 },
    { customerName: 'نورhan سعيد', phone: '01012345681', zoneCode: 'hay_el_gamaa', addressText: 'حي الجامعة، شارع الجيش، خلف بوابة كلية الطب', codAmount: 120, product: 'كتب جامعية (3)', pieces: 3 },
    { customerName: 'أمينة خالد', phone: '01012345682', zoneCode: 'mashayia', addressText: 'المشاية السفلية، شارع عبدالسلام عارف، عمارة الأمل', codAmount: 250, product: 'ملابس أطفال شتوية', pieces: 5 },
    { customerName: 'يوسف إبراهيم', phone: '01012345683', zoneCode: 'gomhoria_street', addressText: 'شارع الجمهورية، بجوار البنك الأهلي، الدور 2', codAmount: 540, product: 'ساعة ذكية Apple', pieces: 1 },
    { customerName: 'ليلى محمود', phone: '01012345684', zoneCode: 'el_galaa', addressText: 'شارع الجلاء، تقسيم سامية الجمل، عمارة 7', codAmount: 890, product: 'مكواة بخار فيلبس', pieces: 1 },
    { customerName: 'طارق سami', phone: '01012345685', zoneCode: 'el_geish_street', addressText: 'شارع الجيش، بجوار كشري التحرير، شقة 4', codAmount: 175, product: 'عطر رجالي (50ml)', pieces: 1 },
    { customerName: 'رانيا فؤاد', phone: '01012345686', zoneCode: 'el_derasat', addressText: 'الدراسات، شارع الثورة، فيلا الورد', codAmount: 630, product: 'خلاط كهربائي كينوود', pieces: 1 },
    { customerName: 'سيد عبدالله', phone: '01012345687', zoneCode: 'gedila', addressText: 'جديلة، شارع قناة السويس، عمارة الصفا', codAmount: 210, product: 'كاوتش موبايل + جراب', pieces: 4 },
    { customerName: 'هند مصطفى', phone: '01012345688', zoneCode: 'qolongeel', addressText: 'قولونجيل، شارع السكة الجديدة، برج النور', codAmount: 340, product: 'حقيبة ظهر لابتوب', pieces: 1 },
    { customerName: 'كريم نبيل', phone: '01012345689', zoneCode: 'sandoub', addressText: 'سندوب، شارع الأتوبيس الجديد، بجوار المسجد', codAmount: 410, product: 'ماوس وكيبورد لوجيتك', pieces: 2 },
  ];

  const createdShipmentIds: string[] = [];

  for (const sd of shipmentData) {
    const zone = await prisma.zone.findFirst({ where: { code: sd.zoneCode } });
    if (!zone) {
      console.warn(`⚠️  Zone ${sd.zoneCode} not found, skipping shipment for ${sd.customerName}`);
      continue;
    }

    const existing = await prisma.shipment.findFirst({
      where: { customerPhone: sd.phone, merchantId: merchant.id, zoneId: zone.id },
    });
    if (existing) {
      createdShipmentIds.push(existing.id);
      continue;
    }

    const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        merchantId: merchant.id,
        status: ShipmentStatus.PENDING,
        type: 'COD',
        customerName: sd.customerName,
        customerPhone: sd.phone,
        address: {
          zone: zone.nameAr,
          city: 'المنصورة',
          governorate: 'الدقهلية',
          text: sd.addressText,
          landmark: sd.addressText.split('،').pop()?.trim() ?? '',
        } as any,
        addressText: sd.addressText,
        zoneId: zone.id,
        codAmount: sd.codAmount,
        productDescription: sd.product,
        productValue: sd.codAmount,
        weight: 1.5,
        pieces: sd.pieces,
        deliveryAttempts: 0,
        autoDispatchEligible: true,
        riskScore: Math.floor(Math.random() * 30),
      },
    });

    await prisma.shipmentStatusLog.create({
      data: {
        shipmentId: shipment.id,
        newStatus: ShipmentStatus.PENDING,
        previousStatus: null,
        metadata: { source: 'seed' },
      },
    });

    createdShipmentIds.push(shipment.id);
    console.log(`✅ Shipment ${trackingNumber} → ${sd.customerName} (${zone.nameAr})`);
  }

  // ── 8. Assign shipments to couriers ───────────────────────────────────────
  // Map zone codes to courier IDs
  const zoneToCourier = new Map<string, string>();
  for (const c of createdCouriers) {
    for (const z of c.zones) {
      zoneToCourier.set(z, c.id);
    }
  }

  const assignments: { shipmentId: string; courierId: string; assignmentId: string }[] = [];

  for (const shipmentId of createdShipmentIds) {
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { zone: true } });
    if (!shipment || !shipment.zone) continue;

    const courierId = zoneToCourier.get(shipment.zone.code);
    if (!courierId) continue;

    // Skip if any assignment already exists (shipmentId is unique)
    const existingAssignment = await prisma.assignment.findFirst({
      where: { shipmentId: shipment.id },
    });
    if (existingAssignment) {
      assignments.push({ shipmentId: shipment.id, courierId, assignmentId: existingAssignment.id });
      continue;
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const ass = await tx.assignment.create({
        data: {
          shipmentId: shipment.id,
          courierId,
          assignmentType: AssignmentType.MANUAL,
          status: AssignmentStatus.ACTIVE,
        },
      });
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { assignedCourierId: courierId },
      });
      return ass;
    });

    assignments.push({ shipmentId: shipment.id, courierId, assignmentId: assignment.id });
    console.log(`🚚 Assigned ${shipment.trackingNumber} → courier ${courierId}`);
  }

  // ── 9. Simulate delivery cycle (full recap demo) ──────────────────────────
  // Pick 6 shipments to simulate PENDING → OUT_FOR_DELIVERY → DELIVERED
  const deliveriesToSimulate = assignments.slice(0, 6);
  let totalCodCollected = 0;

  for (let i = 0; i < deliveriesToSimulate.length; i++) {
    const { shipmentId, courierId } = deliveriesToSimulate[i];
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment || shipment.status !== ShipmentStatus.PENDING) {
      if (shipment) totalCodCollected += Number(shipment.codAmount);
      continue;
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codAmount = Number(shipment.codAmount);
    totalCodCollected += codAmount;

    // Step 9a: OUT_FOR_DELIVERY + generate OTP
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.OUT_FOR_DELIVERY,
          customerOtp: otp,
        },
      });
      await tx.shipmentStatusLog.create({
        data: {
          shipmentId,
          previousStatus: ShipmentStatus.PENDING,
          newStatus: ShipmentStatus.OUT_FOR_DELIVERY,
          changedByRole: UserRole.COURIER,
          metadata: { otp, source: 'seed-simulation' },
        },
      });
    });
    console.log(`📤 ${shipment.trackingNumber} → OUT_FOR_DELIVERY (OTP: ${otp})`);

    // Step 9b: DELIVERED + collect COD
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: new Date(),
          collectedCash: codAmount,
        },
      });
      await tx.courier.update({
        where: { id: courierId },
        data: {
          cashHeld: { increment: codAmount },
          totalDelivered: { increment: 1 },
        },
      });
      await tx.shipmentStatusLog.create({
        data: {
          shipmentId,
          previousStatus: ShipmentStatus.OUT_FOR_DELIVERY,
          newStatus: ShipmentStatus.DELIVERED,
          changedByRole: UserRole.COURIER,
          metadata: { otp, collectedCash: codAmount, source: 'seed-simulation' },
        },
      });
    });
    console.log(`✅ ${shipment.trackingNumber} → DELIVERED (COD: ${codAmount} EGP)`);

    // Complete assignment
    const activeAssignment = await prisma.assignment.findFirst({
      where: { shipmentId, status: AssignmentStatus.ACTIVE },
    });
    if (activeAssignment) {
      await prisma.assignment.update({
        where: { id: activeAssignment.id },
        data: { status: AssignmentStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }

  // Step 9c: One FAILED delivery attempt
  if (assignments.length > 6) {
    const failedAss = assignments[6];
    const shipment = await prisma.shipment.findUnique({ where: { id: failedAss.shipmentId } });
    if (shipment && shipment.status === ShipmentStatus.PENDING) {
      await prisma.$transaction(async (tx) => {
        await tx.shipment.update({
          where: { id: failedAss.shipmentId },
          data: { status: ShipmentStatus.FAILED, deliveryAttempts: { increment: 1 } },
        });
        await tx.courier.update({
          where: { id: failedAss.courierId },
          data: { totalFailed: { increment: 1 } },
        });
        await tx.shipmentStatusLog.create({
          data: {
            shipmentId: failedAss.shipmentId,
            previousStatus: ShipmentStatus.PENDING,
            newStatus: ShipmentStatus.FAILED,
            changedByRole: UserRole.COURIER,
            metadata: { reason: 'Customer not available', source: 'seed-simulation' },
          },
        });
      });
      console.log(`❌ ${shipment.trackingNumber} → FAILED (Customer not available)`);
    }
  }

  // Step 9d: One RETURNED shipment
  if (assignments.length > 7) {
    const returnedAss = assignments[7];
    const shipment = await prisma.shipment.findUnique({ where: { id: returnedAss.shipmentId } });
    if (shipment && shipment.status === ShipmentStatus.PENDING) {
      await prisma.$transaction(async (tx) => {
        await tx.shipment.update({
          where: { id: returnedAss.shipmentId },
          data: { status: ShipmentStatus.RETURNED, returnedAt: new Date(), returnReason: 'CUSTOMER_REFUSED' },
        });
        await tx.courier.update({
          where: { id: returnedAss.courierId },
          data: { totalReturned: { increment: 1 } },
        });
        await tx.shipmentStatusLog.create({
          data: {
            shipmentId: returnedAss.shipmentId,
            previousStatus: ShipmentStatus.PENDING,
            newStatus: ShipmentStatus.RETURNED,
            changedByRole: UserRole.COURIER,
            metadata: { reason: 'Customer refused', source: 'seed-simulation' },
          },
        });
      });
      console.log(`🔄 ${shipment.trackingNumber} → RETURNED (Customer refused)`);
    }
  }

  // ── 10. Courier Cash Deposit (Recap Cycle) ────────────────────────────────
  // The first courier deposits half his collected cash (only once)
  const firstCourier = createdCouriers[0];
  const courierRecord = await prisma.courier.findUnique({ where: { id: firstCourier.id } });
  const existingDeposits = await prisma.courierCashDeposit.count({ where: { courierId: firstCourier.id } });
  if (courierRecord && Number(courierRecord.cashHeld) > 0 && existingDeposits === 0) {
    const depositAmount = Number(courierRecord.cashHeld) / 2;
    await prisma.$transaction(async (tx) => {
      await tx.courierCashDeposit.create({
        data: {
          courierId: firstCourier.id,
          amount: depositAmount,
          notes: 'إيداع نقدي يومي - سلفة شحن المنصورة',
        },
      });
      await tx.courier.update({
        where: { id: firstCourier.id },
        data: { cashHeld: { decrement: depositAmount } },
      });
    });
    console.log(`💰 Courier ${firstCourier.name} deposited ${depositAmount} EGP (daily recap)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const finalZones = await prisma.zone.count({ where: { parentId: dakahlia.id } });
  const finalDistricts = await prisma.zone.count({ where: { parent: { parentId: dakahlia.id } } });
  const totalShipments = await prisma.shipment.count({ where: { merchantId: merchant.id } });
  const delivered = await prisma.shipment.count({ where: { merchantId: merchant.id, status: ShipmentStatus.DELIVERED } });
  const failed = await prisma.shipment.count({ where: { merchantId: merchant.id, status: ShipmentStatus.FAILED } });
  const returned = await prisma.shipment.count({ where: { merchantId: merchant.id, status: ShipmentStatus.RETURNED } });
  const pending = await prisma.shipment.count({ where: { merchantId: merchant.id, status: ShipmentStatus.PENDING } });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎉 SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Zones: ${finalZones} centers/cities + ${finalDistricts} districts/villages in Dakahlia`);
  console.log(`👤 Merchant: ${merchantUser.name} (${merchantPhone} / password: merchant123)`);
  console.log(`🚚 Couriers: ${createdCouriers.length}`);
  for (const c of createdCouriers) {
    const cr = await prisma.courier.findUnique({ where: { id: c.id } });
    console.log(`   • ${c.name} (${c.phone}) → cashHeld: ${cr?.cashHeld ?? 0} EGP`);
  }
  console.log(`📦 Shipments: ${totalShipments} total`);
  console.log(`   • DELIVERED: ${delivered}`);
  console.log(`   • FAILED:    ${failed}`);
  console.log(`   • RETURNED:  ${returned}`);
  console.log(`   • PENDING:   ${pending}`);
  console.log(`💵 Total COD collected in simulation: ${totalCodCollected} EGP`);
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
