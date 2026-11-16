import { PrismaClient } from '@prisma/client';

const CODE_PREFIX = 'CJ-';
const CODE_START = 1001;

/** Next unique club code like CJ-1001. */
export async function nextCustomerCode(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.user.findMany({
    where: { customerCode: { not: null } },
    select: { customerCode: true },
  });
  let max = CODE_START - 1;
  for (const row of rows) {
    const raw = row.customerCode ?? '';
    const match = /^CJ-(\d+)$/i.exec(raw.trim());
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${CODE_PREFIX}${max + 1}`;
}

export async function ensureCustomerCode(
  prisma: PrismaClient,
  userId: string,
  existing?: string | null,
): Promise<string> {
  if (existing?.trim()) return existing.trim();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await nextCustomerCode(prisma);
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { customerCode: code },
        select: { customerCode: true },
      });
      if (updated.customerCode) return updated.customerCode;
    } catch {
      // Unique race — retry with a fresh max
    }
  }
  throw new Error('FAILED_CUSTOMER_CODE');
}
