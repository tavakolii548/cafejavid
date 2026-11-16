import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AccessPayload } from '../auth/auth.service';
import { CustomerGuard } from '../auth/guards';
import { ApiException } from '../common/api.exception';
import { OrderEventsService } from '../events/order-events.service';
import { CancelOrderDto, CreateOrderDto } from './dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
@UseGuards(CustomerGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
  ) {}

  @Post()
  create(
    @Req() req: Request & { user: AccessPayload },
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.create(req.user.sub, body, idempotencyKey?.trim() || undefined);
  }

  @Get()
  list(@Req() req: Request & { user: AccessPayload }) {
    return this.orders.listMine(req.user.sub);
  }

  @Get(':id/stream')
  async stream(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const current = await this.orders.getOwned(req.user.sub, id);
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: order.updated\ndata: ${JSON.stringify(current)}\n\n`);
    const sub = this.events.customer(id).subscribe((payload) => {
      res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
    });
    const timer = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 20000);
    req.on('close', () => {
      clearInterval(timer);
      sub.unsubscribe();
    });
  }

  @Get(':id')
  get(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string) {
    return this.orders.getOwned(req.user.sub, id);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: CancelOrderDto,
  ) {
    return this.orders.cancelMine(req.user.sub, id, body.reason);
  }

  @Post(':id/reorder-preview')
  reorder(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string) {
    return this.orders.reorderPreview(req.user.sub, id);
  }
}

export function assertId(id: string) {
  if (!id) throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'شناسه معتبر نیست');
}
