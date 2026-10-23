import { Body, Controller, Get, HttpCode, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { PaginationQuery } from '../common/pagination';
import { Order, OrderItem, Product } from '../database/entities';
import { CreateOrderDto, OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Roles('customer') @Post()
  checkout(@CurrentUser() actor: AuthUser, @Body() dto: CreateOrderDto) {
    return this.service.checkout(actor.id, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() q: PaginationQuery) {
    return this.service.list(actor, q);
  }

  @Get(':id')
  get(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.get(actor, id);
  }

  @Post(':id/pay') @HttpCode(200)
  pay(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.transition(actor, id, 'pay');
  }

  @Roles('admin') @Post(':id/ship') @HttpCode(200)
  ship(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.transition(actor, id, 'ship');
  }

  @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.transition(actor, id, 'cancel');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
