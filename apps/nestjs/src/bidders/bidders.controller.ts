import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { BiddersService } from './bidders.service.js';
import { BidderQueryDto } from './dto/bidder-query.dto.js';
import { CreateBidderDto } from './dto/create-bidder.dto.js';
import { UpdateBidderDto } from './dto/update-bidder.dto.js';

@Controller('bidders')
export class BiddersController {
  constructor(private readonly biddersService: BiddersService) {}

  /** Profil bidder milik user yang sedang login. */
  @Get('me')
  @Roles(UserRole.BIDDER)
  getMine(@CurrentUser() user: JwtPayload) {
    return this.biddersService.findMine(user);
  }

  /** BIDDER mengubah profil miliknya sendiri. */
  @Patch('me')
  @Roles(UserRole.BIDDER)
  updateMine(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBidderDto) {
    return this.biddersService.updateMine(user, dto);
  }

  /** ADMIN melihat semua bidder. */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: BidderQueryDto) {
    return this.biddersService.findAll(query);
  }

  /** ADMIN membuat profil bidder untuk sebuah user. */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateBidderDto) {
    return this.biddersService.create(dto);
  }

  /** ADMIN melihat detail satu bidder. */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.biddersService.findOne(id);
  }

  /** ADMIN mengubah bidder mana pun. */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBidderDto) {
    return this.biddersService.update(id, dto);
  }
}
