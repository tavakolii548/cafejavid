import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { absolutizeMediaUrl, publicBaseUrl } from '../common/media-url';
import { isOutsideServiceHours } from '../common/service-window';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: Request) {
    const mediaBase = publicBaseUrl(req);
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { hidden: false },
          orderBy: { sortOrder: 'asc' },
          include: {
            optionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    const featured = categories.flatMap((category) => category.products).find((product) => product.featured) ?? null;
    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        products: category.products.map((product) => presentProduct(product, mediaBase)),
      })),
      featured: featured ? presentProduct(featured, mediaBase) : null,
    };
  }
}

function presentProduct(
  product: {
    id: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string | null;
    featured: boolean;
    soldOut: boolean;
    sortOrder: number;
    serviceStartHour: number | null;
    serviceEndHour: number | null;
    optionGroups: {
      id: string;
      name: string;
      type: string;
      required: boolean;
      sortOrder: number;
      choices: { id: string; name: string; priceDelta: number; isDefault: boolean; sortOrder: number }[];
    }[];
  },
  mediaBase: string,
) {
  const outsideServiceHours = isOutsideServiceHours(product.serviceStartHour, product.serviceEndHour);
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: absolutizeMediaUrl(product.imageUrl, mediaBase),
    featured: product.featured,
    soldOut: product.soldOut,
    sortOrder: product.sortOrder,
    serviceStartHour: product.serviceStartHour,
    serviceEndHour: product.serviceEndHour,
    outsideServiceHours,
    optionGroups: product.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      sortOrder: group.sortOrder,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        name: choice.name,
        priceDelta: choice.priceDelta,
        isDefault: choice.isDefault,
        sortOrder: choice.sortOrder,
      })),
    })),
  };
}
