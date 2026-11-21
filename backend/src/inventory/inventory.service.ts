import { HttpStatus, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { ApiException } from '../common/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, SetProductRecipeDto, UpsertInventoryItemDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listItems() {
    return this.prisma.inventoryItem
      .findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
      .then((rows) => rows.map((row) => this.presentItem(row)));
  }

  async createItem(dto: UpsertInventoryItemDto) {
    const name = dto.name.trim();
    const unit = dto.unit.trim();
    if (!name) throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_NAME', 'نام ماده را وارد کنید');
    if (!unit) throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_UNIT', 'واحد را وارد کنید');
    const created = await this.prisma.inventoryItem.create({
      data: {
        name,
        unit,
        quantityOnHand: dto.quantityOnHand ?? 0,
        lowStockAt: dto.lowStockAt ?? null,
        active: dto.active !== false,
      },
    });
    if ((dto.quantityOnHand ?? 0) !== 0) {
      await this.prisma.inventoryMovement.create({
        data: {
          inventoryItemId: created.id,
          type: InventoryMovementType.ADJUST,
          delta: dto.quantityOnHand ?? 0,
          note: 'موجودی اولیه',
        },
      });
    }
    return this.presentItem(created);
  }

  async updateItem(id: string, dto: UpsertInventoryItemDto) {
    await this.requireItem(id);
    const name = dto.name.trim();
    const unit = dto.unit.trim();
    if (!name) throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_NAME', 'نام ماده را وارد کنید');
    if (!unit) throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_UNIT', 'واحد را وارد کنید');
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        unit,
        lowStockAt: dto.lowStockAt === undefined ? undefined : dto.lowStockAt,
        active: dto.active,
      },
    });
    return this.presentItem(updated);
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    if (!dto.delta) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_DELTA', 'مقدار تغییر موجودی صفر است');
    }
    await this.requireItem(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { quantityOnHand: { increment: dto.delta } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: id,
          type: InventoryMovementType.ADJUST,
          delta: dto.delta,
          note: dto.note?.trim() || null,
        },
      });
      return item;
    });
    return this.presentItem(updated);
  }

  async deleteItem(id: string) {
    const used = await this.prisma.productRecipeLine.count({ where: { inventoryItemId: id } });
    if (used > 0) {
      throw new ApiException(HttpStatus.CONFLICT, 'ITEM_IN_USE', 'این ماده در دستور محصول استفاده شده است');
    }
    await this.requireItem(id);
    await this.prisma.inventoryItem.delete({ where: { id } });
    return { ok: true };
  }

  async listRecipes() {
    const products = await this.prisma.product.findMany({
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        recipeLines: {
          include: { inventoryItem: true },
          orderBy: { inventoryItem: { name: 'asc' } },
        },
      },
    });
    return products.map((product) => ({
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      lines: product.recipeLines.map((line) => ({
        id: line.id,
        inventoryItemId: line.inventoryItemId,
        inventoryItemName: line.inventoryItem.name,
        unit: line.inventoryItem.unit,
        unitLabel: line.inventoryItem.unit,
        qtyPerUnit: line.qtyPerUnit,
      })),
    }));
  }

  async setProductRecipe(productId: string, dto: SetProductRecipeDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'محصول پیدا نشد');

    const cleaned = new Map<string, number>();
    for (const line of dto.lines ?? []) {
      const itemId = line.inventoryItemId?.trim();
      if (!itemId || line.qtyPerUnit < 1) continue;
      cleaned.set(itemId, (cleaned.get(itemId) ?? 0) + line.qtyPerUnit);
    }
    const itemIds = [...cleaned.keys()];
    if (itemIds.length) {
      const found = await this.prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } });
      if (found.length !== itemIds.length) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'ITEM_NOT_FOUND', 'یکی از مواد انبار پیدا نشد');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productRecipeLine.deleteMany({ where: { productId } });
      if (cleaned.size === 0) return;
      await tx.productRecipeLine.createMany({
        data: [...cleaned.entries()].map(([inventoryItemId, qtyPerUnit]) => ({
          productId,
          inventoryItemId,
          qtyPerUnit,
        })),
      });
    });

    const recipes = await this.listRecipes();
    return recipes.find((row) => row.productId === productId)!;
  }

  /** Deduct ingredients for sold order lines (inside existing transaction). */
  async consumeForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: { productId: string; quantity: number }[],
  ) {
    if (!items.length) return;
    const productIds = [...new Set(items.map((item) => item.productId))];
    const lines = await tx.productRecipeLine.findMany({
      where: { productId: { in: productIds } },
    });
    if (!lines.length) return;

    const need = new Map<string, number>();
    for (const item of items) {
      for (const line of lines) {
        if (line.productId !== item.productId) continue;
        need.set(line.inventoryItemId, (need.get(line.inventoryItemId) ?? 0) + line.qtyPerUnit * item.quantity);
      }
    }
    for (const [inventoryItemId, amount] of need) {
      if (amount <= 0) continue;
      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantityOnHand: { decrement: amount } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId,
          type: InventoryMovementType.SALE,
          delta: -amount,
          orderId,
          note: 'کسر بابت فروش',
        },
      });
    }
  }

  /** Restore ingredients when an order is cancelled. */
  async restoreForOrder(orderId: string) {
    const sales = await this.prisma.inventoryMovement.findMany({
      where: { orderId, type: InventoryMovementType.SALE },
    });
    if (!sales.length) return;
    const already = await this.prisma.inventoryMovement.count({
      where: { orderId, type: InventoryMovementType.RESTORE },
    });
    if (already > 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const row of sales) {
        const amount = Math.abs(row.delta);
        if (!amount) continue;
        await tx.inventoryItem.update({
          where: { id: row.inventoryItemId },
          data: { quantityOnHand: { increment: amount } },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: row.inventoryItemId,
            type: InventoryMovementType.RESTORE,
            delta: amount,
            orderId,
            note: 'برگشت بابت لغو سفارش',
          },
        });
      }
    });
  }

  private async requireItem(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'ماده انبار پیدا نشد');
    return item;
  }

  private presentItem(row: {
    id: string;
    name: string;
    unit: string;
    quantityOnHand: number;
    lowStockAt: number | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const low =
      typeof row.lowStockAt === 'number' ? row.quantityOnHand <= row.lowStockAt : row.quantityOnHand <= 0;
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      unitLabel: row.unit,
      quantityOnHand: row.quantityOnHand,
      lowStockAt: row.lowStockAt,
      active: row.active,
      lowStock: low,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
