import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessPayload } from '../auth/auth.service';
import { CustomerGuard } from '../auth/guards';
import { DiscountsService } from './discounts.service';
import { ValidateDiscountDto } from './dto';

@ApiTags('cart')
@Controller('cart')
@UseGuards(CustomerGuard)
export class CartController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post('validate-discount')
  validate(@Req() req: Request & { user: AccessPayload }, @Body() body: ValidateDiscountDto) {
    return this.discounts.validateForUser(req.user.sub, body.code, body.subtotal);
  }
}
