import type { Category, Order, Product, Settings } from './api';

export const PREVIEW_MODE = true;

export const previewSession = {
  accessToken: 'preview-token',
  refreshToken: 'preview-refresh',
  role: 'OWNER' as const,
  username: 'owner',
};

const nowMs = Date.now();
const now = new Date(nowMs).toISOString();
const minsAgo = (m: number) => new Date(nowMs - m * 60_000).toISOString();

const img = (file: string) => `https://parsianmenu.ir/Shop/203304106156/Product/${file}`;

/** Persian digits — matches Android DemoCafeApi.toPersianDigits display */
function fa(input: string): string {
  return input.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

function p(
  id: string,
  categoryId: string,
  name: string,
  description: string,
  price: number,
  sortOrder: number,
  extras?: {
    imageFile?: string;
    featured?: boolean;
    soldOut?: boolean;
    hidden?: boolean;
    serviceStartHour?: number | null;
    serviceEndHour?: number | null;
  },
): Product {
  return {
    id,
    categoryId,
    name: fa(name),
    description: fa(description),
    price,
    imageUrl: extras?.imageFile ? img(extras.imageFile) : null,
    featured: extras?.featured ?? false,
    soldOut: extras?.soldOut ?? false,
    hidden: extras?.hidden ?? false,
    sortOrder,
    serviceStartHour: extras?.serviceStartHour ?? null,
    serviceEndHour: extras?.serviceEndHour ?? null,
    optionGroups: [],
  };
}

export const previewOrders: Order[] = [
  {
    id: 'o1',
    number: 1250,
    status: 'NEW',
    fulfillment: 'DELIVERY',
    tableNumber: null,
    addressSnapshot: { title: 'خانه', details: 'بلوار ده‌حقی' },
    customerNote: 'زنگ نزنید',
    subtotal: 865000,
    deliveryFee: 0,
    packagingFee: 55000,
    total: 920000,
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    cancelReason: null,
    estimatedMinutes: 25,
    createdAt: minsAgo(3),
    updatedAt: minsAgo(3),
    user: { id: 'u1', phone: '09121234567', name: 'سارا' },
    items: [
      { id: 'i1', productId: 'p-1000004', productName: fa('لته'), unitPrice: 270000, quantity: 2, options: [], note: null, lineTotal: 540000 },
      { id: 'i2', productId: 'p-1060002', productName: fa('چیز کیک سن‌سباستین'), unitPrice: 325000, quantity: 1, options: [], note: null, lineTotal: 325000 },
    ],
  },
  {
    id: 'o2',
    number: 1249,
    status: 'PREPARING',
    fulfillment: 'DELIVERY',
    tableNumber: null,
    addressSnapshot: null,
    customerNote: 'کم‌شیر باشد',
    subtotal: 190000,
    deliveryFee: 0,
    packagingFee: 55000,
    total: 245000,
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    cancelReason: null,
    estimatedMinutes: 20,
    createdAt: minsAgo(18),
    updatedAt: minsAgo(12),
    user: { id: 'u2', phone: '09129876543', name: 'علی' },
    items: [
      { id: 'i3', productId: 'p-1010001', productName: fa('آیس آمریکانو'), unitPrice: 190000, quantity: 1, options: [], note: null, lineTotal: 190000 },
    ],
  },
  {
    id: 'o3',
    number: 1248,
    status: 'PREPARING',
    fulfillment: 'DELIVERY',
    tableNumber: null,
    addressSnapshot: null,
    customerNote: null,
    subtotal: 520000,
    deliveryFee: 0,
    packagingFee: 55000,
    total: 575000,
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    cancelReason: null,
    estimatedMinutes: 25,
    createdAt: minsAgo(35),
    updatedAt: minsAgo(22),
    user: { id: 'u3', phone: '09351234567', name: 'مینا' },
    items: [
      { id: 'i4', productId: 'p-1000004', productName: fa('لته'), unitPrice: 270000, quantity: 1, options: [], note: null, lineTotal: 270000 },
      { id: 'i5', productId: 'p-1000007', productName: fa('کاپوچینو/کورتادو'), unitPrice: 250000, quantity: 1, options: [], note: null, lineTotal: 250000 },
    ],
  },
  {
    id: 'o4',
    number: 1245,
    status: 'READY',
    fulfillment: 'DELIVERY',
    tableNumber: null,
    addressSnapshot: null,
    customerNote: null,
    subtotal: 270000,
    deliveryFee: 0,
    packagingFee: 55000,
    total: 325000,
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    cancelReason: null,
    estimatedMinutes: 25,
    createdAt: minsAgo(40),
    updatedAt: minsAgo(8),
    user: { id: 'u1', phone: '09121234567', name: 'سارا' },
    items: [
      { id: 'i6', productId: 'p-1000004', productName: fa('لته'), unitPrice: 270000, quantity: 1, options: [], note: null, lineTotal: 270000 },
    ],
  },
];

/** Full Android DemoCafeApi categories */
export const previewCategories: Category[] = [
  { id: 'cat-100', name: 'اسپرسو بار و نوشیدنی گرم', sortOrder: 0, active: true },
  { id: 'cat-101', name: 'اسپرسو بار سرد', sortOrder: 1, active: true },
  { id: 'cat-102', name: 'چای و دمنوش', sortOrder: 2, active: true },
  { id: 'cat-103', name: 'ماکتیل', sortOrder: 3, active: true },
  { id: 'cat-104', name: 'اسموتی‌ها', sortOrder: 4, active: true },
  { id: 'cat-105', name: 'شیک', sortOrder: 5, active: true },
  { id: 'cat-106', name: 'کیک و دسر', sortOrder: 6, active: true },
  { id: 'cat-108', name: 'صبحانه و میان‌وعده', sortOrder: 7, active: true },
];

/** Full Android DemoCafeApi catalog (53 products) */
export const previewProducts: Product[] = [
  p('p-1000001', 'cat-100', 'اسپرسو(100)', 'اسپرسو دبل شات (۱۰۰٪ روبوستا)', 150000, 0, { imageFile: '1000001.jpg' }),
  p('p-1000002', 'cat-100', 'اسپرسو(70/30)', 'اسپرسو دبل‌شات (۷۰٪ روبوستا / ۳۰٪ عربیکا)', 170000, 1, { imageFile: '1000002.jpg' }),
  p('p-1000003', 'cat-100', 'آمریکانو/بلک', '', 190000, 2),
  p('p-1000004', 'cat-100', 'لته', 'اسپرسو (۳۰٪ عربیکا) + شیر', 270000, 3, { imageFile: '1000004.jpg' }),
  p('p-1000005', 'cat-100', 'موکا', 'اسپرسو (۳۰٪ عربیکا) + شیر + شکلات', 290000, 4, { imageFile: '1000005.png' }),
  p('p-1000006', 'cat-100', 'کارامل ماکیاتو', 'اسپرسو (۳۰٪ عربیکا) + شیر + کارامل', 290000, 5),
  p('p-1000007', 'cat-100', 'کاپوچینو/کورتادو', 'کاپوچینو: اسپرسو ۳۰/۷۰، شیر، فوم — کورتادو: اسپرسو ۳۰/۷۰، شیر (۱:۱)', 250000, 6, { imageFile: '1000007.jpg' }),
  p('p-1000008', 'cat-100', 'هات چاکلت', '', 280000, 7),
  p('p-1000009', 'cat-100', 'شوکو پینات', 'اسپرسو (۳۰٪ عربیکا) + شیر + کره بادام‌زمینی، شکلات، پودر کاکائو', 450000, 8, { imageFile: '1000009.png', featured: true }),
  p('p-1000010', 'cat-100', 'لته لوتوس', 'اسپرسو (۳۰٪ عربیکا) + شیر + کرم بیسکوئیت لوتوس', 350000, 9, { imageFile: '1000010.jpg' }),
  p('p-1000011', 'cat-100', 'ماسالا', '', 250000, 10),
  p('p-1000012', 'cat-100', 'چای کرک', '', 250000, 11),
  p('p-1000013', 'cat-100', 'لته با سیروپ دلخواه', '', 290000, 12),
  p('p-1000014', 'cat-100', 'ماسالا رژیمی', '', 270000, 13),
  p('p-1000015', 'cat-100', 'اسپرسو (۱۰۰ عربیکا)', '', 230000, 14),
  p('p-1000016', 'cat-100', 'بون بون', 'اسپرسو ۳۰/۷۰، شیر + عسل طبیعی', 295000, 15, { imageFile: '1000016.png' }),

  p('p-1010001', 'cat-101', 'آیس آمریکانو', '', 190000, 0, { imageFile: '1010001.png' }),
  p('p-1010002', 'cat-101', 'آیس لته', '', 270000, 1),
  p('p-1010003', 'cat-101', 'آیس موکا', '', 290000, 2, { imageFile: '1010003.png' }),
  p('p-1010004', 'cat-101', 'آیس کارامل ماکیاتو', '', 290000, 3),
  p('p-1010005', 'cat-101', 'اورنج اسپرسو', 'اسپرسو ۳۰/۷۰، آب پرتقال تازه', 270000, 4, { imageFile: '1010005.png' }),
  p('p-1010006', 'cat-101', 'آفوگاتو', 'بستنی وانیلی، اسپرسو ۳۰/۷۰', 310000, 5),
  p('p-1010007', 'cat-101', 'کن پانا', '', 300000, 6),
  p('p-1010008', 'cat-101', 'پام اسپرسو', 'اسپرسو دوبل + آب انار + رب انار', 295000, 7, { imageFile: '1010008.png' }),

  p('p-1020001', 'cat-102', 'چای سیاه', 'چای ایرانی + نبات + گل محمدی و دارچین', 90000, 0, { imageFile: '1020001.jpg' }),
  p('p-1020002', 'cat-102', 'چای سبز', '', 250000, 1),
  p('p-1020003', 'cat-102', 'دمنوش آرامش', '', 250000, 2),
  p('p-1020004', 'cat-102', 'دمنوش سرماخوردگی', '', 250000, 3),
  p('p-1020005', 'cat-102', 'دمنوش فصل', '', 250000, 4),

  p('p-1030001', 'cat-103', 'لیموناد', '', 390000, 0, { imageFile: '1030001.png' }),
  p('p-1030002', 'cat-103', 'موهیتو', '', 395000, 1, { imageFile: '1030002.png' }),
  p('p-1030003', 'cat-103', 'پینکی', '', 350000, 2, { imageFile: '1030003.png' }),
  p('p-1030004', 'cat-103', 'بلوکولادا', '', 370000, 3, { imageFile: '1030004.png' }),
  p('p-1030005', 'cat-103', 'رد جوس', 'آب آلبالو + آب زرشک + سودا', 340000, 4, { imageFile: '1030005.png' }),

  p('p-1040001', 'cat-104', 'اسموتی هونولولو', '', 330000, 0),
  p('p-1040002', 'cat-104', 'اسموتی دربند', '', 380000, 1),

  p('p-1050001', 'cat-105', 'شیک شکلات', '', 380000, 0, { imageFile: '1050001.jpg' }),
  p('p-1050002', 'cat-105', 'شیک پینات', '', 370000, 1, { imageFile: '1050002.jpg' }),
  p('p-1050003', 'cat-105', 'شیک بیسکوئیت', '', 370000, 2),
  p('p-1050004', 'cat-105', 'شیک نوتلا', '', 370000, 3, { imageFile: '1050004.jpg' }),

  p('p-1060002', 'cat-106', 'چیز کیک سن‌سباستین', '', 325000, 0, { imageFile: '1060002.jpg' }),
  p('p-1060010', 'cat-106', 'دسر تیرامیسو', 'بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو', 325000, 1, { imageFile: '1060010.jpg' }),
  p('p-1060011', 'cat-106', 'کیک شکلاتی', '', 315000, 2),
  p('p-1060013', 'cat-106', 'کوکی کاکائویی (طرح قهوه)', 'کوکی کاکائویی', 25000, 3, { imageFile: '1060013.jpg' }),
  p('p-1060016', 'cat-106', 'کوکی رژیمی', 'آرد رژیمی + شکر قهوه‌ای + تکه‌های کاکائو', 150000, 4, { imageFile: '1060016.jpg' }),
  p('p-1060019', 'cat-106', 'کروسان شکلاتی', 'کروسان با فیلینگ کاکائو', 250000, 5, { imageFile: '1060019.jpg' }),
  p('p-1060021', 'cat-106', 'تیرامیسو تک‌نفره', 'بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو', 225000, 6, { imageFile: '1060021.jpg' }),

  p('p-1080001', 'cat-108', 'تست ژامبون پنیر', '', 250000, 0),
  p('p-1080002', 'cat-108', 'تست پنیر گردو', '', 130000, 1),
  p('p-1080003', 'cat-108', 'تست بادام‌زمینی', '', 200000, 2),
  p('p-1080004', 'cat-108', 'تست بادام‌زمینی شکلات', '', 230000, 3),
  p('p-1080005', 'cat-108', 'تست ژامبون گوشت', '', 230000, 4),
  p('p-1080006', 'cat-108', 'تست ژامبون مرغ', '', 200000, 5),
];

export const previewSettings: Settings = {
  cafeName: 'کافه جاوید',
  phone: '02133656911',
  address: 'بلوار ده‌حقی، نرسیده به بلوار نبرد',
  openingHours: '۸ تا ۲۳',
  logoUrl: '/cafe-logo.png',
  deliveryFee: 0,
  packagingFee: 55000,
  minOrder: 0,
  tableCount: 10,
  acceptingOrders: true,
  receiptHeader: 'سفارش شما با عشق آماده می‌شود',
  receiptFooter: 'نوش جان',
  receiptShowPhone: true,
  receiptShowAddress: true,
  receiptShowHours: false,
};

function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function previewJalaliToday() {
  const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const num = (type: string) => Number(toLatinDigits(fa.find((p) => p.type === type)?.value ?? '0'));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${num('year')}/${pad(num('month'))}/${pad(num('day'))}`;
}

const birthdayToday = previewJalaliToday();

type PreviewCustomer = {
  id: string;
  phone: string;
  customerCode: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

type PreviewCampaign = {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'USER' | 'MULTI' | 'BIRTHDAY' | 'SPECIAL_DAY';
  delivery: 'NOW' | 'RULE';
  ruleKind: 'CALENDAR' | 'INTERVAL';
  intervalUnit: 'HOURS' | 'DAYS' | 'WEEKS' | null;
  intervalValue: number | null;
  userId: string | null;
  userIds: string[];
  specialMonth: number | null;
  specialDay: number | null;
  active: boolean;
  lastRunOn: string | null;
  lastRunAt: string | null;
  createdAt: string;
  recipientCount: number;
};

type PreviewDiscountCode = {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  userId: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  createdById: string | null;
  user: {
    id: string;
    phone: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    customerCode: string | null;
  } | null;
};

function clubUserBrief(c: PreviewCustomer) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    firstName: c.firstName,
    lastName: c.lastName,
    customerCode: c.customerCode,
  };
}

export const previewCustomers: PreviewCustomer[] = [
  {
    id: 'u1',
    phone: '09121234567',
    customerCode: 'CJ-1001',
    name: 'سارا محمدی',
    firstName: 'سارا',
    lastName: 'محمدی',
    birthDate: birthdayToday,
    orderCount: 12,
    totalSpent: 2450000,
    lastOrderAt: now,
  },
  {
    id: 'u2',
    phone: '09129876543',
    customerCode: 'CJ-1002',
    name: 'علی رضایی',
    firstName: 'علی',
    lastName: 'رضایی',
    birthDate: '1372/03/18',
    orderCount: 4,
    totalSpent: 780000,
    lastOrderAt: now,
  },
  {
    id: 'u3',
    phone: '09351234567',
    customerCode: 'CJ-1003',
    name: 'مینا احمدی',
    firstName: 'مینا',
    lastName: 'احمدی',
    birthDate: '1378/11/02',
    orderCount: 7,
    totalSpent: 1560000,
    lastOrderAt: now,
  },
  {
    id: 'u4',
    phone: '09121112233',
    customerCode: 'CJ-1004',
    name: 'رضا کریمی',
    firstName: 'رضا',
    lastName: 'کریمی',
    birthDate: '1365/06/21',
    orderCount: 2,
    totalSpent: 410000,
    lastOrderAt: null,
  },
];

export const previewDiscountCodes: PreviewDiscountCode[] = [
  {
    id: 'dc1',
    code: 'SARA20',
    type: 'PERCENT',
    value: 20,
    minOrder: 200000,
    maxDiscount: 100000,
    userId: 'u1',
    active: true,
    startsAt: null,
    endsAt: null,
    maxUses: 1,
    usedCount: 0,
    createdAt: now,
    createdById: 'staff-owner',
    user: clubUserBrief(previewCustomers[0]!),
  },
  {
    id: 'dc2',
    code: 'ALI50K',
    type: 'FIXED',
    value: 50000,
    minOrder: null,
    maxDiscount: null,
    userId: 'u2',
    active: true,
    startsAt: null,
    endsAt: null,
    maxUses: 1,
    usedCount: 1,
    createdAt: minsAgo(120),
    createdById: 'staff-owner',
    user: clubUserBrief(previewCustomers[1]!),
  },
];

export const previewNotifications: PreviewCampaign[] = [
  {
    id: 'n1',
    title: 'پیشنهاد امروز',
    body: 'شوکو پینات با ۲۰٪ تخفیف تا ساعت ۲۲',
    audience: 'ALL',
    delivery: 'NOW',
    ruleKind: 'CALENDAR',
    intervalUnit: null,
    intervalValue: null,
    userId: null,
    userIds: [],
    specialMonth: null,
    specialDay: null,
    active: false,
    lastRunOn: null,
    lastRunAt: now,
    createdAt: now,
    recipientCount: 3,
  },
  {
    id: 'n-bday',
    title: 'تولدت مبارک',
    body: '%name عزیز، تولدت مبارک! یک نوشیدنی مهمان کافه جاوید.',
    audience: 'BIRTHDAY',
    delivery: 'RULE',
    ruleKind: 'CALENDAR',
    intervalUnit: null,
    intervalValue: null,
    userId: null,
    userIds: [],
    specialMonth: null,
    specialDay: null,
    active: true,
    lastRunOn: birthdayToday,
    lastRunAt: now,
    createdAt: now,
    recipientCount: 1,
  },
  {
    id: 'n-special',
    title: 'روز زن',
    body: 'به مناسبت روز زن، ۱۰٪ تخفیف روی کیک‌ها',
    audience: 'SPECIAL_DAY',
    delivery: 'RULE',
    ruleKind: 'CALENDAR',
    intervalUnit: null,
    intervalValue: null,
    userId: null,
    userIds: [],
    specialMonth: 12,
    specialDay: 17,
    active: false,
    lastRunOn: null,
    lastRunAt: null,
    createdAt: now,
    recipientCount: 0,
  },
  {
    id: 'n-weekly',
    title: 'پیشنهاد هفتگی',
    body: 'این هفته یک قهوه مهمان ما باش!',
    audience: 'ALL',
    delivery: 'RULE',
    ruleKind: 'INTERVAL',
    intervalUnit: 'WEEKS',
    intervalValue: 1,
    userId: null,
    userIds: [],
    specialMonth: null,
    specialDay: null,
    active: true,
    lastRunOn: null,
    lastRunAt: now,
    createdAt: now,
    recipientCount: 4,
  },
];

export const previewReport = {
  totalSales: 4250000,
  orderCount: 18,
  averageOrderValue: 236111,
  topProducts: [
    { name: fa('لته'), quantity: 24, amount: 6480000 },
    { name: fa('آیس آمریکانو'), quantity: 11, amount: 2090000 },
    { name: fa('چیز کیک سن‌سباستین'), quantity: 9, amount: 2925000 },
    { name: fa('کاپوچینو/کورتادو'), quantity: 7, amount: 1750000 },
    { name: fa('شوکو پینات'), quantity: 5, amount: 2250000 },
  ],
  hourly: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 4, 3, 5, 7, 8, 6, 4, 2, 1, 0, 0][hour],
  })),
};

type PreviewInventoryItem = {
  id: string;
  name: string;
  unit: string;
  unitLabel: string;
  quantityOnHand: number;
  lowStockAt: number | null;
  active: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

function presentPreviewItem(row: Omit<PreviewInventoryItem, 'unitLabel' | 'lowStock' | 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
}): PreviewInventoryItem {
  const unit = (row.unit || 'عدد').trim() || 'عدد';
  const low =
    typeof row.lowStockAt === 'number' ? row.quantityOnHand <= row.lowStockAt : row.quantityOnHand <= 0;
  return {
    ...row,
    unit,
    unitLabel: unit,
    lowStock: low,
    createdAt: row.createdAt || now,
    updatedAt: row.updatedAt || now,
  };
}

export const previewInventoryItems: PreviewInventoryItem[] = [
  presentPreviewItem({ id: 'inv-milk', name: 'شیر', unit: 'میلی‌لیتر', quantityOnHand: 12000, lowStockAt: 2000, active: true }),
  presentPreviewItem({ id: 'inv-espresso', name: 'پودر اسپرسو', unit: 'گرم', quantityOnHand: 3500, lowStockAt: 500, active: true }),
  presentPreviewItem({ id: 'inv-cup', name: 'لیوان یک‌بارمصرف', unit: 'عدد', quantityOnHand: 180, lowStockAt: 40, active: true }),
  presentPreviewItem({ id: 'inv-chocolate', name: 'سس شکلات', unit: 'میلی‌لیتر', quantityOnHand: 900, lowStockAt: 300, active: true }),
];

/** productId -> recipe lines */
export const previewRecipes = new Map<string, { inventoryItemId: string; qtyPerUnit: number }[]>([
  [
    'p-1000004',
    [
      { inventoryItemId: 'inv-espresso', qtyPerUnit: 18 },
      { inventoryItemId: 'inv-milk', qtyPerUnit: 200 },
      { inventoryItemId: 'inv-cup', qtyPerUnit: 1 },
    ],
  ],
  [
    'p-1000005',
    [
      { inventoryItemId: 'inv-espresso', qtyPerUnit: 18 },
      { inventoryItemId: 'inv-milk', qtyPerUnit: 180 },
      { inventoryItemId: 'inv-chocolate', qtyPerUnit: 30 },
      { inventoryItemId: 'inv-cup', qtyPerUnit: 1 },
    ],
  ],
]);

function buildPreviewRecipes() {
  return previewProducts.map((product) => {
    const lines = previewRecipes.get(product.id) || [];
    const category = previewCategories.find((c) => c.id === product.categoryId);
    return {
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: category?.name || '',
      lines: lines.map((line, index) => {
        const item = previewInventoryItems.find((row) => row.id === line.inventoryItemId);
        return {
          id: `${product.id}-${line.inventoryItemId}-${index}`,
          inventoryItemId: line.inventoryItemId,
          inventoryItemName: item?.name || 'ماده',
          unit: item?.unit || 'گرم',
          unitLabel: item?.unitLabel || item?.unit || 'گرم',
          qtyPerUnit: line.qtyPerUnit,
        };
      }),
    };
  });
}

export function previewResponse(path: string, init?: RequestInit): unknown | null {
  const method = (init?.method || 'GET').toUpperCase();
  if (path.includes('/admin/auth/login') && method === 'POST') {
    return {
      accessToken: previewSession.accessToken,
      refreshToken: previewSession.refreshToken,
      staff: { username: 'owner', role: 'OWNER' },
    };
  }
  // Status PATCH must be matched before the generic GET `/admin/orders` prefix checks and the
  // mutation catch-all (`{ ok: true }`), otherwise the kanban never moves cards.
  if (path.includes('/admin/orders/') && path.includes('/status') && method === 'PATCH') {
    const id = path.split('/admin/orders/')[1]?.split('/')[0] || '';
    const body = init?.body ? (JSON.parse(String(init.body)) as { toStatus?: string; estimatedMinutes?: number; reason?: string }) : {};
    const idx = previewOrders.findIndex((o) => o.id === id);
    if (idx < 0) return null;
    const stamp = new Date().toISOString();
    const next = {
      ...previewOrders[idx],
      status: body.toStatus || previewOrders[idx].status,
      estimatedMinutes: body.estimatedMinutes ?? previewOrders[idx].estimatedMinutes,
      cancelReason: body.reason ?? previewOrders[idx].cancelReason,
      updatedAt: stamp,
    };
    previewOrders[idx] = next;
    return next;
  }
  if (path.includes('/admin/orders') && method === 'GET') return previewOrders.map((order) => ({ ...order, items: order.items.map((item) => ({ ...item })) }));
  if (path.includes('/admin/categories')) {
    if (method === 'GET') return [...previewCategories].sort((a, b) => a.sortOrder - b.sortOrder);
    if (method === 'POST') {
      const body = init?.body ? (JSON.parse(String(init.body)) as Partial<Category>) : {};
      const created: Category = {
        id: `cat-${Date.now()}`,
        name: (body.name || 'دسته جدید').trim(),
        sortOrder: body.sortOrder ?? previewCategories.length,
        active: body.active ?? true,
      };
      previewCategories.push(created);
      return created;
    }
    if (method === 'PUT' && path.includes('/categories/reorder')) {
      const body = init?.body ? (JSON.parse(String(init.body)) as { ids?: string[] }) : {};
      const ids = body.ids ?? [];
      ids.forEach((id, index) => {
        const cat = previewCategories.find((c) => c.id === id);
        if (cat) cat.sortOrder = index;
      });
      previewCategories.sort((a, b) => a.sortOrder - b.sortOrder);
      return [...previewCategories];
    }
    if (method === 'PUT') {
      const id = path.split('/admin/categories/')[1]?.split(/[/?]/)[0] || '';
      const body = init?.body ? (JSON.parse(String(init.body)) as Partial<Category>) : {};
      const idx = previewCategories.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false };
      previewCategories[idx] = {
        ...previewCategories[idx],
        name: body.name?.trim() || previewCategories[idx].name,
        sortOrder: body.sortOrder ?? previewCategories[idx].sortOrder,
        active: body.active ?? previewCategories[idx].active,
      };
      return previewCategories[idx];
    }
    if (method === 'DELETE') {
      const id = path.split('/admin/categories/')[1]?.split(/[/?]/)[0] || '';
      const inUse = previewProducts.some((p) => p.categoryId === id);
      if (inUse) throw new Error('این دسته محصول دارد');
      const idx = previewCategories.findIndex((c) => c.id === id);
      if (idx >= 0) previewCategories.splice(idx, 1);
      return { ok: true };
    }
  }
  if (path.includes('/admin/products')) return previewProducts;
  if (path.includes('/admin/customers/') && path.includes('/summary') && method === 'GET') {
    const id = path.split('/admin/customers/')[1]?.split('/')[0] || '';
    const member = previewCustomers.find((c) => c.id === id);
    if (!member) throw new Error('مشتری پیدا نشد');
    const userOrders = previewOrders.filter((o) => o.user?.id === id && o.status !== 'CANCELLED');
    const totalSales = userOrders.reduce((sum, o) => sum + o.total, 0);
    const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const fulfillment: Record<string, number> = { DELIVERY: 0, PICKUP: 0, DINE_IN: 0 };
    let discountTotal = 0;
    for (const order of userOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourly[hour].count += 1;
      fulfillment[order.fulfillment] = (fulfillment[order.fulfillment] ?? 0) + 1;
      discountTotal += order.discountAmount ?? 0;
      for (const item of order.items) {
        const row = productMap.get(item.productName) ?? { name: item.productName, quantity: 0, amount: 0 };
        row.quantity += item.quantity;
        row.amount += item.lineTotal;
        productMap.set(item.productName, row);
      }
    }
    // Demo bars if this user has few orders
    if (userOrders.length <= 2) {
      for (let h = 9; h <= 21; h += 1) hourly[h].count = Math.max(hourly[h].count, (h % 5) + 1);
    }
    return {
      totalSales: totalSales || member.totalSpent,
      orderCount: userOrders.length || member.orderCount,
      averageOrderValue:
        userOrders.length || member.orderCount
          ? Math.round((totalSales || member.totalSpent) / (userOrders.length || member.orderCount))
          : 0,
      topProducts: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      hourly,
      fulfillment,
      discountTotal,
    };
  }
  if (path.includes('/admin/customers/') && path.includes('/orders') && method === 'GET') {
    const id = path.split('/admin/customers/')[1]?.split('/')[0] || '';
    const rows = previewOrders
      .filter((o) => o.user?.id === id)
      .map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        fulfillment: order.fulfillment,
        total: order.total,
        discountAmount: order.discountAmount ?? 0,
        discountCode: order.discountCode ?? null,
        createdAt: order.createdAt,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      }));
    if (rows.length === 0) {
      const member = previewCustomers.find((c) => c.id === id);
      if (!member) throw new Error('مشتری پیدا نشد');
      return [];
    }
    return rows;
  }
  if (path.includes('/admin/customers')) {
    if (method === 'GET') {
      const idMatch = path.match(/\/admin\/customers\/([^/?]+)/);
      if (idMatch?.[1] && idMatch[1] !== 'customers') {
        const id = idMatch[1];
        const member = previewCustomers.find((c) => c.id === id);
        if (!member) throw new Error('مشتری پیدا نشد');
        return {
          ...member,
          createdAt: minsAgo(60 * 24 * 40),
          addressCount: id === 'u1' ? 2 : 1,
          averageOrderValue: member.orderCount ? Math.round(member.totalSpent / member.orderCount) : 0,
        };
      }
      return previewCustomers;
    }
    if (method === 'POST') {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
      const firstName = body.firstName?.trim() || '';
      const lastName = body.lastName?.trim() || '';
      const member = {
        id: `u-${Date.now()}`,
        phone: body.phone || '09000000000',
        customerCode: body.customerCode?.trim() || `CJ-${1000 + previewCustomers.length + 1}`,
        name: [firstName, lastName].filter(Boolean).join(' ') || null,
        firstName: firstName || null,
        lastName: lastName || null,
        birthDate: body.birthDate?.trim() || null,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: null as string | null,
      };
      previewCustomers.push(member);
      return member;
    }
    if (method === 'PATCH') {
      const id = path.split('/').pop() || '';
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string | null>) : {};
      const idx = previewCustomers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        const prev = previewCustomers[idx];
        const firstName = body.firstName !== undefined ? String(body.firstName || '').trim() : prev.firstName || '';
        const lastName = body.lastName !== undefined ? String(body.lastName || '').trim() : prev.lastName || '';
        previewCustomers[idx] = {
          ...prev,
          phone: (body.phone ? String(body.phone).trim() : prev.phone) || prev.phone,
          firstName: firstName || null,
          lastName: lastName || null,
          name: [firstName, lastName].filter(Boolean).join(' ') || null,
          birthDate:
            body.birthDate !== undefined
              ? body.birthDate
                ? String(body.birthDate).trim() || null
                : null
              : prev.birthDate,
          customerCode: prev.customerCode,
        };
        return {
          ...previewCustomers[idx],
          createdAt: minsAgo(60 * 24 * 40),
          addressCount: 1,
          averageOrderValue: previewCustomers[idx].orderCount
            ? Math.round(previewCustomers[idx].totalSpent / previewCustomers[idx].orderCount)
            : 0,
        };
      }
      return { ok: true };
    }
  }
  if (path.includes('/admin/notifications/preview-recipients') && method === 'GET') {
    const qs = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : new URLSearchParams();
    const audience = qs.get('audience') || 'ALL';
    let users = previewCustomers.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      birthDate: c.birthDate,
    }));
    if (audience === 'USER') {
      const uid = qs.get('userId');
      users = users.filter((u) => u.id === uid);
    } else if (audience === 'MULTI') {
      const ids = (qs.get('userIds') || '').split(',').filter(Boolean);
      users = users.filter((u) => ids.includes(u.id));
    } else if (audience === 'BIRTHDAY') {
      users = users.filter((u) => u.birthDate === birthdayToday);
    } else if (audience === 'SPECIAL_DAY') {
      const ids = (qs.get('userIds') || '').split(',').filter(Boolean);
      if (ids.length) users = users.filter((u) => ids.includes(u.id));
    }
    return { count: users.length, users };
  }
  if (path.includes('/admin/notifications') && method === 'GET') return previewNotifications;
  if (path.includes('/admin/notifications/') && method === 'PATCH') {
    const id = path.split('/').pop() || '';
    const body = init?.body ? (JSON.parse(String(init.body)) as { active?: boolean; title?: string; body?: string }) : {};
    const idx = previewNotifications.findIndex((n) => n.id === id);
    if (idx >= 0) {
      previewNotifications[idx] = {
        ...previewNotifications[idx],
        active: typeof body.active === 'boolean' ? body.active : previewNotifications[idx].active,
        title: body.title?.trim() || previewNotifications[idx].title,
        body: body.body?.trim() || previewNotifications[idx].body,
      };
      return previewNotifications[idx];
    }
    return { ok: true };
  }
  if (path.includes('/admin/notifications') && method === 'POST') {
    const body = init?.body
      ? (JSON.parse(String(init.body)) as {
          title?: string;
          body?: string;
          audience?: string;
          delivery?: string;
          ruleKind?: 'CALENDAR' | 'INTERVAL';
          intervalUnit?: 'HOURS' | 'DAYS' | 'WEEKS';
          intervalValue?: number;
          userId?: string;
          userIds?: string[];
          specialMonth?: number;
          specialDay?: number;
          active?: boolean;
        })
      : {};
    const audience = (body.audience || 'ALL') as PreviewCampaign['audience'];
    const delivery = (body.delivery || 'NOW') as PreviewCampaign['delivery'];
    const ruleKind =
      delivery === 'RULE' ? (body.ruleKind === 'INTERVAL' ? 'INTERVAL' : 'CALENDAR') : 'CALENDAR';
    const stamp = new Date().toISOString();
    const created: PreviewCampaign = {
      id: `n-${Date.now()}`,
      title: body.title || 'اعلان',
      body: body.body || '',
      audience,
      delivery,
      ruleKind,
      intervalUnit: ruleKind === 'INTERVAL' ? body.intervalUnit || 'DAYS' : null,
      intervalValue: ruleKind === 'INTERVAL' ? Number(body.intervalValue) || 1 : null,
      userId: body.userId ?? null,
      userIds: body.userIds ?? [],
      specialMonth: body.specialMonth ?? null,
      specialDay: body.specialDay ?? null,
      active: delivery === 'RULE' ? body.active !== false : false,
      lastRunOn: null,
      lastRunAt: delivery === 'RULE' || delivery === 'NOW' ? stamp : null,
      createdAt: stamp,
      recipientCount: audience === 'ALL' ? previewCustomers.length : body.userIds?.length || (body.userId ? 1 : 0),
    };
    previewNotifications.unshift(created);
    return created;
  }
  if (path.includes('/admin/discount-codes')) {
    if (method === 'GET') return previewDiscountCodes;
    if (method === 'POST') {
      const body = init?.body
        ? (JSON.parse(String(init.body)) as {
            code?: string;
            type?: 'PERCENT' | 'FIXED';
            value?: number;
            userId?: string;
            minOrder?: number;
            maxDiscount?: number;
            active?: boolean;
            endsAt?: string;
            maxUses?: number;
          })
        : {};
      const code = (body.code || '').trim().toUpperCase().replace(/\s+/g, '');
      if (previewDiscountCodes.some((row) => row.code === code)) {
        throw new Error('این کد قبلاً ثبت شده است');
      }
      const userId = body.userId?.trim() || null;
      const member = userId ? previewCustomers.find((c) => c.id === userId) : null;
      if (userId && !member) {
        throw new Error('عضو باشگاه پیدا نشد');
      }
      const created: PreviewDiscountCode = {
        id: `dc-${Date.now()}`,
        code: code || `CODE${previewDiscountCodes.length + 1}`,
        type: body.type === 'FIXED' ? 'FIXED' : 'PERCENT',
        value: Number(body.value) || 10,
        minOrder: typeof body.minOrder === 'number' ? body.minOrder : null,
        maxDiscount: typeof body.maxDiscount === 'number' ? body.maxDiscount : null,
        userId: member?.id ?? null,
        active: body.active !== false,
        startsAt: null,
        endsAt: body.endsAt || null,
        maxUses: typeof body.maxUses === 'number' && body.maxUses > 0 ? body.maxUses : 1,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        createdById: 'staff-owner',
        user: member ? clubUserBrief(member) : null,
      };
      previewDiscountCodes.unshift(created);
      return created;
    }
    if (method === 'PATCH') {
      const id = path.split('/').pop() || '';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as { active?: boolean; endsAt?: string | null; maxUses?: number })
        : {};
      const idx = previewDiscountCodes.findIndex((row) => row.id === id);
      if (idx >= 0) {
        previewDiscountCodes[idx] = {
          ...previewDiscountCodes[idx],
          active: typeof body.active === 'boolean' ? body.active : previewDiscountCodes[idx].active,
          endsAt: body.endsAt !== undefined ? body.endsAt : previewDiscountCodes[idx].endsAt,
          maxUses:
            typeof body.maxUses === 'number' && body.maxUses > 0
              ? body.maxUses
              : previewDiscountCodes[idx].maxUses,
        };
        return previewDiscountCodes[idx];
      }
      return { ok: true };
    }
  }
  if (path.includes('/admin/inventory/items/') && path.includes('/adjust') && method === 'POST') {
    const id = path.split('/admin/inventory/items/')[1]?.split('/')[0] || '';
    const body = init?.body ? (JSON.parse(String(init.body)) as { delta?: number }) : {};
    const delta = Number(body.delta) || 0;
    const idx = previewInventoryItems.findIndex((row) => row.id === id);
    if (idx < 0) return { ok: false };
    previewInventoryItems[idx] = presentPreviewItem({
      ...previewInventoryItems[idx],
      quantityOnHand: previewInventoryItems[idx].quantityOnHand + delta,
    });
    return previewInventoryItems[idx];
  }
  if (path.includes('/admin/inventory/items')) {
    if (method === 'GET') return previewInventoryItems.map((row) => presentPreviewItem(row));
    if (method === 'POST') {
      const body = init?.body
        ? (JSON.parse(String(init.body)) as {
            name?: string;
            unit?: string;
            quantityOnHand?: number;
            lowStockAt?: number | null;
            active?: boolean;
          })
        : {};
      const created = presentPreviewItem({
        id: `inv-${Date.now()}`,
        name: (body.name || 'ماده جدید').trim(),
        unit: (body.unit || 'عدد').trim() || 'عدد',
        quantityOnHand: Number(body.quantityOnHand) || 0,
        lowStockAt: typeof body.lowStockAt === 'number' ? body.lowStockAt : null,
        active: body.active !== false,
      });
      previewInventoryItems.unshift(created);
      return created;
    }
    if (method === 'PUT') {
      const id = path.split('/admin/inventory/items/')[1]?.split(/[/?]/)[0] || '';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as {
            name?: string;
            unit?: string;
            lowStockAt?: number | null;
            active?: boolean;
          })
        : {};
      const idx = previewInventoryItems.findIndex((row) => row.id === id);
      if (idx < 0) return { ok: false };
      previewInventoryItems[idx] = presentPreviewItem({
        ...previewInventoryItems[idx],
        name: body.name?.trim() || previewInventoryItems[idx].name,
        unit: body.unit?.trim() || previewInventoryItems[idx].unit,
        lowStockAt: body.lowStockAt === undefined ? previewInventoryItems[idx].lowStockAt : body.lowStockAt,
        active: typeof body.active === 'boolean' ? body.active : previewInventoryItems[idx].active,
      });
      return previewInventoryItems[idx];
    }
    if (method === 'DELETE') {
      const id = path.split('/admin/inventory/items/')[1]?.split(/[/?]/)[0] || '';
      const inUse = [...previewRecipes.values()].some((lines) => lines.some((line) => line.inventoryItemId === id));
      if (inUse) throw new Error('این ماده در دستور محصول استفاده شده است');
      const idx = previewInventoryItems.findIndex((row) => row.id === id);
      if (idx >= 0) previewInventoryItems.splice(idx, 1);
      return { ok: true };
    }
  }
  if (path.includes('/admin/inventory/recipes')) {
    if (method === 'GET') return buildPreviewRecipes();
    if (method === 'PUT') {
      const productId = path.split('/admin/inventory/recipes/')[1]?.split(/[/?]/)[0] || '';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as { lines?: { inventoryItemId: string; qtyPerUnit: number }[] })
        : {};
      const cleaned = (body.lines || [])
        .filter((line) => line.inventoryItemId && Number(line.qtyPerUnit) > 0)
        .map((line) => ({ inventoryItemId: line.inventoryItemId, qtyPerUnit: Number(line.qtyPerUnit) }));
      previewRecipes.set(productId, cleaned);
      return buildPreviewRecipes().find((row) => row.productId === productId) || { productId, lines: cleaned };
    }
  }
  if (path.includes('/admin/settings') || path.includes('/api/v1/config')) return previewSettings;
  if (path.includes('/admin/reports/summary')) return previewReport;
  if (path.includes('/admin/uploads')) {
    return { url: `https://picsum.photos/seed/cafejavid-upload/${Date.now()}/400/400` };
  }
  // Mutations in preview: acknowledge without backend.
  // Never use this for order status — that must return a full Order (see PATCH handler above).
  if (method !== 'GET') {
    if (path.includes('/admin/orders/') && path.includes('/status')) return null;
    return { ok: true };
  }
  return null;
}
