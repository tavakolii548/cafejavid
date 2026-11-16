import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { DiscountsService } from './discounts.service';

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
