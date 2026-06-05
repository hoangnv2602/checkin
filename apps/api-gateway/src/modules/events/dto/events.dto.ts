/**
 * apps/api-gateway/src/modules/events/dto/events.dto.ts — I-202
 */
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum EventStatus {
  Draft = "draft",
  Published = "published",
  Cancelled = "cancelled",
  Completed = "completed",
}

export class CreateEventDto {
  @ApiProperty({ example: "Tech Conference 2026" })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiProperty({ example: "2026-09-01T09:00:00Z" })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: "2026-09-01T18:00:00Z" })
  @IsDateString()
  endAt!: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity!: number;
}

export class UpdateEventDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity?: number;
}

export class ListEventsQueryDto {
  @ApiProperty({ required: false, enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;
}
