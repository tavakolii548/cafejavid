import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { ApiException } from '../common/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPayload } from './auth.service';
import { CustomerGuard } from './guards';

class AddressDto {
  @IsString()
  @MaxLength(40)
  title!: string;

  @IsString()
  @MaxLength(400)
  details!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

@ApiTags('addresses')
@Controller('me/addresses')
@UseGuards(CustomerGuard)
export class AddressController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() req: Request & { user: AccessPayload }) {
    return this.prisma.address.findMany({
      where: { userId: req.user.sub },
      orderBy: { title: 'asc' },
    });
  }

  @Post()
  create(@Req() req: Request & { user: AccessPayload }, @Body() body: AddressDto) {
    return this.prisma.address.create({ data: { ...body, userId: req.user.sub } });
  }

  @Put(':id')
  async update(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: AddressDto,
  ) {
    const row = await this.prisma.address.findFirst({ where: { id, userId: req.user.sub } });
    if (!row) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'آدرس پیدا نشد');
    return this.prisma.address.update({ where: { id }, data: body });
  }

  @Delete(':id')
  async remove(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string) {
    const row = await this.prisma.address.findFirst({ where: { id, userId: req.user.sub } });
    if (!row) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'آدرس پیدا نشد');
    await this.prisma.address.delete({ where: { id } });
    return { ok: true };
  }
}
