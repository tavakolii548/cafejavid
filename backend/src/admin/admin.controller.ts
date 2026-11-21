import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { Request, Response } from 'express';
import { AccessPayload } from '../auth/auth.service';
import { assertOwner, StaffGuard } from '../auth/guards';
import { ApiException } from '../common/api.exception';
import { OrderEventsService } from '../events/order-events.service';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from '../discounts/dto';
import { DiscountsService } from '../discounts/discounts.service';
import {
  AdjustStockDto,
  SetProductRecipeDto,
  UpsertInventoryItemDto,
} from '../inventory/dto';
import { InventoryService } from '../inventory/inventory.service';
import { CreateNotificationDto, UpdateNotificationRuleDto } from '../notifications/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { StatusDto } from '../orders/dto';
import { AdminService } from './admin.service';
import {
  AvailabilityDto,
  CategoryDto,
  ClubMemberDto,
  ProductWriteDto,
  ReorderDto,
  SettingsDto,
  UpdateClubMemberDto,
} from './dto';
import { absolutizeMediaUrl, publicBaseUrl } from '../common/media-url';

function uploadDir() {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(StaffGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
    private readonly notifications: NotificationsService,
    private readonly discounts: DiscountsService,
    private readonly inventory: InventoryService,
  ) {}

  @Get('orders/stream')
  stream(@Req() req: Request, @Res() res: Response) {
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sub = this.events.admin.subscribe((payload) => {
      res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
    });
    const timer = setInterval(() => res.write(`: ping\n\n`), 20000);
    req.on('close', () => {
      clearInterval(timer);
      sub.unsubscribe();
    });
  }

  @Get('orders')
  listOrders(@Query('status') status?: string, @Query('date') date?: string) {
    return this.orders.listAdmin(status, date);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orders.getAdmin(id);
  }

  @Patch('orders/:id/status')
  setStatus(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string, @Body() body: StatusDto) {
    return this.orders.setStatus(id, req.user.sub, body.toStatus, body.reason, body.estimatedMinutes);
  }

  @Get('categories')
  categories() {
    return this.admin.listCategories();
  }

  @Post('categories')
  createCategory(@Body() body: CategoryDto) {
    return this.admin.createCategory(body);
  }

  @Put('categories/reorder')
  reorder(@Body() body: ReorderDto) {
    return this.admin.reorderCategories(body.ids);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: CategoryDto) {
    return this.admin.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  @Get('products')
  products() {
    return this.admin.listProducts();
  }

  @Post('products')
  createProduct(@Body() body: ProductWriteDto) {
    return this.admin.createProduct(body);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: ProductWriteDto) {
    return this.admin.updateProduct(id, body);
  }

  @Patch('products/:id/availability')
  availability(@Param('id') id: string, @Body() body: AvailabilityDto) {
    return this.admin.setAvailability(id, body.soldOut);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.admin.deleteProduct(id);
  }

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = uploadDir();
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').slice(0, 10);
          cb(null, `${randomBytes(8).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(@Req() req: Request, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new ApiException(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'فایل انتخاب نشده است');
    const relative = `/uploads/${file.filename}`;
    const url = absolutizeMediaUrl(relative, publicBaseUrl(req)) ?? relative;
    return { url };
  }

  @Get('reports/summary')
  report(@Req() req: Request & { user: AccessPayload }, @Query('from') from?: string, @Query('to') to?: string) {
    assertOwner(req);
    const day = tehranToday();
    return this.admin.report(from || day, to || day);
  }

  @Get('customers')
  customers(@Req() req: Request & { user: AccessPayload }, @Query('q') q?: string) {
    assertOwner(req);
    return this.admin.customers(q);
  }

  @Get('customers/:id/summary')
  customerSummary(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    assertOwner(req);
    const day = tehranToday();
    return this.admin.customerSummary(id, from || day, to || day);
  }

  @Get('customers/:id/orders')
  customerOrders(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    assertOwner(req);
    const take = limit ? Number(limit) : 30;
    return this.admin.customerOrders(id, Number.isFinite(take) ? take : 30);
  }

  @Get('customers/:id')
  customer(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string) {
    assertOwner(req);
    return this.admin.getCustomer(id);
  }

  @Post('customers')
  createCustomer(@Req() req: Request & { user: AccessPayload }, @Body() body: ClubMemberDto) {
    assertOwner(req);
    return this.admin.createClubMember(body);
  }

  @Patch('customers/:id')
  updateCustomer(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: UpdateClubMemberDto,
  ) {
    assertOwner(req);
    return this.admin.updateClubMember(id, body);
  }

  @Get('notifications')
  listNotifications(@Req() req: Request & { user: AccessPayload }) {
    assertOwner(req);
    return this.notifications.listCampaigns();
  }

  @Get('notifications/preview-recipients')
  previewRecipients(
    @Req() req: Request & { user: AccessPayload },
    @Query('audience') audience: CreateNotificationDto['audience'],
    @Query('userId') userId?: string,
    @Query('userIds') userIds?: string,
    @Query('specialMonth') specialMonth?: string,
    @Query('specialDay') specialDay?: string,
  ) {
    assertOwner(req);
    return this.notifications.previewRecipients({
      audience: audience || 'ALL',
      userId,
      userIds: userIds ? userIds.split(',').filter(Boolean) : undefined,
      specialMonth: specialMonth ? Number(specialMonth) : undefined,
      specialDay: specialDay ? Number(specialDay) : undefined,
    });
  }

  @Post('notifications')
  createNotification(@Req() req: Request & { user: AccessPayload }, @Body() body: CreateNotificationDto) {
    assertOwner(req);
    return this.notifications.createCampaign({
      title: body.title,
      body: body.body,
      audience: body.audience,
      delivery: body.delivery,
      ruleKind: body.ruleKind,
      intervalUnit: body.intervalUnit,
      intervalValue: body.intervalValue,
      userId: body.userId,
      userIds: body.userIds,
      specialMonth: body.specialMonth,
      specialDay: body.specialDay,
      active: body.active,
      createdById: req.user.sub,
    });
  }

  @Patch('notifications/:id')
  updateNotification(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: UpdateNotificationRuleDto,
  ) {
    assertOwner(req);
    return this.notifications.updateRule(id, body);
  }

  @Get('discount-codes')
  listDiscountCodes(@Req() req: Request & { user: AccessPayload }) {
    assertOwner(req);
    return this.discounts.list();
  }

  @Post('discount-codes')
  createDiscountCode(@Req() req: Request & { user: AccessPayload }, @Body() body: CreateDiscountCodeDto) {
    assertOwner(req);
    return this.discounts.create(body, req.user.sub);
  }

  @Patch('discount-codes/:id')
  updateDiscountCode(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: UpdateDiscountCodeDto,
  ) {
    assertOwner(req);
    return this.discounts.update(id, body);
  }

  @Get('inventory/items')
  listInventoryItems(@Req() req: Request & { user: AccessPayload }) {
    assertOwner(req);
    return this.inventory.listItems();
  }

  @Post('inventory/items')
  createInventoryItem(@Req() req: Request & { user: AccessPayload }, @Body() body: UpsertInventoryItemDto) {
    assertOwner(req);
    return this.inventory.createItem(body);
  }

  @Put('inventory/items/:id')
  updateInventoryItem(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: UpsertInventoryItemDto,
  ) {
    assertOwner(req);
    return this.inventory.updateItem(id, body);
  }

  @Post('inventory/items/:id/adjust')
  adjustInventoryItem(
    @Req() req: Request & { user: AccessPayload },
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
  ) {
    assertOwner(req);
    return this.inventory.adjustStock(id, body);
  }

  @Delete('inventory/items/:id')
  deleteInventoryItem(@Req() req: Request & { user: AccessPayload }, @Param('id') id: string) {
    assertOwner(req);
    return this.inventory.deleteItem(id);
  }

  @Get('inventory/recipes')
  listInventoryRecipes(@Req() req: Request & { user: AccessPayload }) {
    assertOwner(req);
    return this.inventory.listRecipes();
  }

  @Put('inventory/recipes/:productId')
  setInventoryRecipe(
    @Req() req: Request & { user: AccessPayload },
    @Param('productId') productId: string,
    @Body() body: SetProductRecipeDto,
  ) {
    assertOwner(req);
    return this.inventory.setProductRecipe(productId, body);
  }

  @Get('settings')
  getSettings(@Req() req: Request & { user: AccessPayload }) {
    assertOwner(req);
    return this.admin.getSettings();
  }

  @Put('settings')
  putSettings(@Req() req: Request & { user: AccessPayload }, @Body() body: SettingsDto) {
    assertOwner(req);
    return this.admin.putSettings(body);
  }
}

function tehranToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
