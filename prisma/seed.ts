import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create Egypt
  const egypt = await prisma.zone.create({
    data: {
      level: 'COUNTRY',
      nameAr: 'مصر',
      nameEn: 'Egypt',
      code: 'EG',
    },
  });

  // Create Governorates
  const cairo = await prisma.zone.create({
    data: {
      level: 'GOVERNORATE',
      nameAr: 'القاهرة',
      nameEn: 'Cairo',
      code: 'EG-C',
      parentId: egypt.id,
    },
  });

  const giza = await prisma.zone.create({
    data: {
      level: 'GOVERNORATE',
      nameAr: 'الجيزة',
      nameEn: 'Giza',
      code: 'EG-G',
      parentId: egypt.id,
    },
  });

  const alexandria = await prisma.zone.create({
    data: {
      level: 'GOVERNORATE',
      nameAr: 'الإسكندرية',
      nameEn: 'Alexandria',
      code: 'EG-A',
      parentId: egypt.id,
    },
  });

  // Create Cities - Cairo
  const maadi = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'المعادي',
      nameEn: 'Maadi',
      code: 'EG-C-MAA',
      parentId: cairo.id,
    },
  });

  const nasrCity = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'مدينة نصر',
      nameEn: 'Nasr City',
      code: 'EG-C-NAS',
      parentId: cairo.id,
    },
  });

  const heliopolis = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'مصر الجديدة',
      nameEn: 'Heliopolis',
      code: 'EG-C-HEL',
      parentId: cairo.id,
    },
  });

  // Create Cities - Giza
  const dokki = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'الدقي',
      nameEn: 'Dokki',
      code: 'EG-G-DOK',
      parentId: giza.id,
    },
  });

  const mohandessin = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'المهندسين',
      nameEn: 'Mohandessin',
      code: 'EG-G-MOH',
      parentId: giza.id,
    },
  });

  // Create Cities - Alexandria
  const sporting = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'سبورتنج',
      nameEn: 'Sporting',
      code: 'EG-A-SPO',
      parentId: alexandria.id,
    },
  });

  const roushdy = await prisma.zone.create({
    data: {
      level: 'CITY',
      nameAr: 'رشدي',
      nameEn: 'Roushdy',
      code: 'EG-A-ROU',
      parentId: alexandria.id,
    },
  });

  // Create Districts - Maadi
  await prisma.zone.createMany({
    data: [
      { level: 'DISTRICT', nameAr: 'سرايات المعادي', nameEn: 'Sarayat', code: 'EG-C-MAA-SAR', parentId: maadi.id },
      { level: 'DISTRICT', nameAr: 'دجلة', nameEn: 'Degla', code: 'EG-C-MAA-DEG', parentId: maadi.id },
    ],
  });

  // Create Districts - Nasr City
  await prisma.zone.createMany({
    data: [
      { level: 'DISTRICT', nameAr: 'مصطفى النحاس', nameEn: 'Mustafa', code: 'EG-C-NAS-MUS', parentId: nasrCity.id },
      { level: 'DISTRICT', nameAr: 'رابعة العدوية', nameEn: 'Rabaa', code: 'EG-C-NAS-RAB', parentId: nasrCity.id },
    ],
  });

  // Create Districts - Heliopolis
  await prisma.zone.createMany({
    data: [
      { level: 'DISTRICT', nameAr: 'كوربة', nameEn: 'Korba', code: 'EG-C-HEL-KOR', parentId: heliopolis.id },
    ],
  });

  // Create Districts - Dokki
  await prisma.zone.createMany({
    data: [
      { level: 'DISTRICT', nameAr: 'المشربية', nameEn: 'Mashrabia', code: 'EG-G-DOK-MAS', parentId: dokki.id },
    ],
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
