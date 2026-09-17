import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { EventIdQueryDto } from "../common/dto/event-id-query.dto.js";
import { CreateShuttleDto } from "./dto/create-shuttle.dto.js";
import { UpdateShuttleDto } from "./dto/update-shuttle.dto.js";
import { ShuttlesService } from "./shuttles.service.js";

/**
 * Gestion des navettes, réservée au back-office. La vue "planning" pour les
 * paxs (sans coordonnées) est exposée par PaxController sous /pax/me/shuttles.
 */
@UseGuards(AdminGuard)
@Controller("admin/shuttles")
export class ShuttlesController {
  constructor(private readonly shuttlesService: ShuttlesService) {}

  @Post()
  create(@Body() dto: CreateShuttleDto) {
    return this.shuttlesService.create(dto);
  }

  @Get()
  findAllForEvent(@Query() query: EventIdQueryDto) {
    return this.shuttlesService.findAllForEvent(query.eventId);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.shuttlesService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateShuttleDto) {
    return this.shuttlesService.update(id, dto);
  }
}
