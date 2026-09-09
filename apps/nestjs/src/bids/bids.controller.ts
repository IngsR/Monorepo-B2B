import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { BidsService } from './bids.service.js';
import { PlaceBidDto } from './dto/place-bid.dto.js';

@Controller('auctions/:lotId/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Get()
  findByLot(@Param('lotId', ParseUUIDPipe) lotId: string) {
    return this.bidsService.findByLot(lotId);
  }

  @Post()
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  placeBid(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: PlaceBidDto,
  ) {
    return this.bidsService.placeBid(lotId, user.userId, dto);
  }
}
