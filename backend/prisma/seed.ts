import { PrismaClient, Prisma, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Match Android demo catalog (DemoCafeApi) — Parsian Menu / کافه جاوید */
function faDigits(input: string): string {
  return input.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

const SETTINGS: Record<string, unknown> = {
  cafeName: 'کافه جاوید',
  phone: '02133656911',
  address: 'بلوار ده‌حقی، نرسیده به بلوار نبرد، کافه جاوید',
  openingHours: '۸ تا ۲۳',
  logoUrl: '',
  deliveryFee: 0,
  packagingFee: 55000,
  minOrder: 0,
  tableCount: 10,
  acceptingOrders: true,
  receiptHeader: 'سفارش شما با عشق آماده می‌شود',
  receiptFooter: 'نوش جان — منتظر سفارش بعدی‌تون هستیم',
  receiptShowPhone: true,
  receiptShowAddress: true,
  receiptShowHours: false,
};

const MENU_CATEGORIES = [
  { key: 'cat-100', name: 'اسپرسو بار و نوشیدنی گرم' },
  { key: 'cat-101', name: 'اسپرسو بار سرد' },
  { key: 'cat-102', name: 'چای و دمنوش' },
  { key: 'cat-103', name: 'ماکتیل' },
  { key: 'cat-104', name: 'اسموتی‌ها' },
  { key: 'cat-105', name: 'شیک' },
  { key: 'cat-106', name: 'کیک و دسر' },
  { key: 'cat-108', name: 'صبحانه و میان‌وعده' },
] as const;

type SeedProduct = {
  categoryKey: (typeof MENU_CATEGORIES)[number]['key'];
  name: string;
  description: string;
  price: number;
  imageFile?: string;
  featured?: boolean;
  soldOut?: boolean;
  hidden?: boolean;
};

const img = (file: string) => `https://parsianmenu.ir/Shop/203304106156/Product/${file}`;

/** Full Android DemoCafeApi product list (no option groups in the live catalog). */
const MENU_PRODUCTS: SeedProduct[] = [
  // اسپرسو بار و نوشیدنی گرم
  { categoryKey: 'cat-100', name: 'اسپرسو(100)', description: 'اسپرسو دبل شات (۱۰۰٪ روبوستا)', price: 150000, imageFile: '1000001.jpg' },
  { categoryKey: 'cat-100', name: 'اسپرسو(70/30)', description: 'اسپرسو دبل‌شات (۷۰٪ روبوستا / ۳۰٪ عربیکا)', price: 170000, imageFile: '1000002.jpg' },
  { categoryKey: 'cat-100', name: 'آمریکانو/بلک', description: '', price: 190000 },
  { categoryKey: 'cat-100', name: 'لته', description: 'اسپرسو (۳۰٪ عربیکا) + شیر', price: 270000, imageFile: '1000004.jpg' },
  { categoryKey: 'cat-100', name: 'موکا', description: 'اسپرسو (۳۰٪ عربیکا) + شیر + شکلات', price: 290000, imageFile: '1000005.png' },
  { categoryKey: 'cat-100', name: 'کارامل ماکیاتو', description: 'اسپرسو (۳۰٪ عربیکا) + شیر + کارامل', price: 290000 },
  { categoryKey: 'cat-100', name: 'کاپوچینو/کورتادو', description: 'کاپوچینو: اسپرسو ۳۰/۷۰، شیر، فوم — کورتادو: اسپرسو ۳۰/۷۰، شیر (۱:۱)', price: 250000, imageFile: '1000007.jpg' },
  { categoryKey: 'cat-100', name: 'هات چاکلت', description: '', price: 280000 },
  { categoryKey: 'cat-100', name: 'شوکو پینات', description: 'اسپرسو (۳۰٪ عربیکا) + شیر + کره بادام‌زمینی، شکلات، پودر کاکائو', price: 450000, imageFile: '1000009.png', featured: true },
  { categoryKey: 'cat-100', name: 'لته لوتوس', description: 'اسپرسو (۳۰٪ عربیکا) + شیر + کرم بیسکوئیت لوتوس', price: 350000, imageFile: '1000010.jpg' },
  { categoryKey: 'cat-100', name: 'ماسالا', description: '', price: 250000 },
  { categoryKey: 'cat-100', name: 'چای کرک', description: '', price: 250000 },
  { categoryKey: 'cat-100', name: 'لته با سیروپ دلخواه', description: '', price: 290000 },
  { categoryKey: 'cat-100', name: 'ماسالا رژیمی', description: '', price: 270000 },
  { categoryKey: 'cat-100', name: 'اسپرسو (۱۰۰ عربیکا)', description: '', price: 230000 },
  { categoryKey: 'cat-100', name: 'بون بون', description: 'اسپرسو ۳۰/۷۰، شیر + عسل طبیعی', price: 295000, imageFile: '1000016.png' },

  // اسپرسو بار سرد
  { categoryKey: 'cat-101', name: 'آیس آمریکانو', description: '', price: 190000, imageFile: '1010001.png' },
  { categoryKey: 'cat-101', name: 'آیس لته', description: '', price: 270000 },
  { categoryKey: 'cat-101', name: 'آیس موکا', description: '', price: 290000, imageFile: '1010003.png' },
  { categoryKey: 'cat-101', name: 'آیس کارامل ماکیاتو', description: '', price: 290000 },
  { categoryKey: 'cat-101', name: 'اورنج اسپرسو', description: 'اسپرسو ۳۰/۷۰، آب پرتقال تازه', price: 270000, imageFile: '1010005.png' },
  { categoryKey: 'cat-101', name: 'آفوگاتو', description: 'بستنی وانیلی، اسپرسو ۳۰/۷۰', price: 310000 },
  { categoryKey: 'cat-101', name: 'کن پانا', description: '', price: 300000 },
  { categoryKey: 'cat-101', name: 'پام اسپرسو', description: 'اسپرسو دوبل + آب انار + رب انار', price: 295000, imageFile: '1010008.png' },

  // چای و دمنوش
  { categoryKey: 'cat-102', name: 'چای سیاه', description: 'چای ایرانی + نبات + گل محمدی و دارچین', price: 90000, imageFile: '1020001.jpg' },
  { categoryKey: 'cat-102', name: 'چای سبز', description: '', price: 250000 },
  { categoryKey: 'cat-102', name: 'دمنوش آرامش', description: '', price: 250000 },
  { categoryKey: 'cat-102', name: 'دمنوش سرماخوردگی', description: '', price: 250000 },
  { categoryKey: 'cat-102', name: 'دمنوش فصل', description: '', price: 250000 },

  // ماکتیل
  { categoryKey: 'cat-103', name: 'لیموناد', description: '', price: 390000, imageFile: '1030001.png' },
  { categoryKey: 'cat-103', name: 'موهیتو', description: '', price: 395000, imageFile: '1030002.png' },
  { categoryKey: 'cat-103', name: 'پینکی', description: '', price: 350000, imageFile: '1030003.png' },
  { categoryKey: 'cat-103', name: 'بلوکولادا', description: '', price: 370000, imageFile: '1030004.png' },
  { categoryKey: 'cat-103', name: 'رد جوس', description: 'آب آلبالو + آب زرشک + سودا', price: 340000, imageFile: '1030005.png' },

  // اسموتی‌ها
  { categoryKey: 'cat-104', name: 'اسموتی هونولولو', description: '', price: 330000 },
  { categoryKey: 'cat-104', name: 'اسموتی دربند', description: '', price: 380000 },

  // شیک
  { categoryKey: 'cat-105', name: 'شیک شکلات', description: '', price: 380000, imageFile: '1050001.jpg' },
  { categoryKey: 'cat-105', name: 'شیک پینات', description: '', price: 370000, imageFile: '1050002.jpg' },
  { categoryKey: 'cat-105', name: 'شیک بیسکوئیت', description: '', price: 370000 },
  { categoryKey: 'cat-105', name: 'شیک نوتلا', description: '', price: 370000, imageFile: '1050004.jpg' },

  // کیک و دسر
  { categoryKey: 'cat-106', name: 'چیز کیک سن‌سباستین', description: '', price: 325000, imageFile: '1060002.jpg' },
  { categoryKey: 'cat-106', name: 'دسر تیرامیسو', description: 'بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو', price: 325000, imageFile: '1060010.jpg' },
  { categoryKey: 'cat-106', name: 'کیک شکلاتی', description: '', price: 315000 },
  { categoryKey: 'cat-106', name: 'کوکی کاکائویی (طرح قهوه)', description: 'کوکی کاکائویی', price: 25000, imageFile: '1060013.jpg' },
  { categoryKey: 'cat-106', name: 'کوکی رژیمی', description: 'آرد رژیمی + شکر قهوه‌ای + تکه‌های کاکائو', price: 150000, imageFile: '1060016.jpg' },
  { categoryKey: 'cat-106', name: 'کروسان شکلاتی', description: 'کروسان با فیلینگ کاکائو', price: 250000, imageFile: '1060019.jpg' },
  { categoryKey: 'cat-106', name: 'تیرامیسو تک‌نفره', description: 'بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو', price: 225000, imageFile: '1060021.jpg' },

  // صبحانه و میان‌وعده
  { categoryKey: 'cat-108', name: 'تست ژامبون پنیر', description: '', price: 250000 },
  { categoryKey: 'cat-108', name: 'تست پنیر گردو', description: '', price: 130000 },
  { categoryKey: 'cat-108', name: 'تست بادام‌زمینی', description: '', price: 200000 },
  { categoryKey: 'cat-108', name: 'تست بادام‌زمینی شکلات', description: '', price: 230000 },
  { categoryKey: 'cat-108', name: 'تست ژامبون گوشت', description: '', price: 230000 },
  { categoryKey: 'cat-108', name: 'تست ژامبون مرغ', description: '', price: 200000 },
];

async function main() {
  const username = process.env.OWNER_USERNAME || 'owner';
  const password = process.env.OWNER_PASSWORD || 'owner12345';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.staffUser.upsert({
    where: { username },
    update: { passwordHash, role: StaffRole.OWNER, active: true },
    create: { username, passwordHash, role: StaffRole.OWNER, active: true },
  });

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }

  const existing = await prisma.category.count();
  if (existing > 0 && process.env.RESET_MENU !== '1') {
    console.log('Menu already seeded, skipping products. Set RESET_MENU=1 to replace catalog.');
    return;
  }

  if (existing > 0 && process.env.RESET_MENU === '1') {
    // OrderItem FKs block product deletes — only safe on empty-order DBs / fresh resets.
    await prisma.optionChoice.deleteMany();
    await prisma.optionGroup.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log('RESET_MENU=1: cleared previous menu (and order items).');
  }

  const categoryIds = new Map<string, string>();
  for (let i = 0; i < MENU_CATEGORIES.length; i++) {
    const def = MENU_CATEGORIES[i]!;
    const created = await prisma.category.create({
      data: { name: def.name, sortOrder: i, active: true },
    });
    categoryIds.set(def.key, created.id);
  }

  const sortByCategory = new Map<string, number>();
  for (const item of MENU_PRODUCTS) {
    const categoryId = categoryIds.get(item.categoryKey);
    if (!categoryId) throw new Error(`Missing category ${item.categoryKey}`);
    const sortOrder = sortByCategory.get(item.categoryKey) ?? 0;
    sortByCategory.set(item.categoryKey, sortOrder + 1);
    await prisma.product.create({
      data: {
        categoryId,
        sortOrder,
        name: faDigits(item.name),
        description: faDigits(item.description),
        price: item.price,
        imageUrl: item.imageFile ? img(item.imageFile) : null,
        featured: item.featured ?? false,
        soldOut: item.soldOut ?? false,
        hidden: item.hidden ?? false,
      },
    });
  }

  console.log(`Seed complete: ${MENU_CATEGORIES.length} categories, ${MENU_PRODUCTS.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
