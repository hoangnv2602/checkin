/**
 * apps/api-gateway/src/modules/events/dto/venues.dto.ts — I-202 + I-201
 */
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum VenueStatus {
  Active = "active",
  Inactive = "inactive",
  Archived = "archived",
}

export class CreateVenueDto {
  @ApiProperty({ example: "Saigon Convention Center" })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiProperty({ example: "VN", description: "ISO 3166-1 alpha-2" })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  streetLine1?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  streetLine2?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiProperty({ required: false, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ required: false, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class ListVenuesQueryDto {
  @ApiProperty({ required: false, enum: VenueStatus })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;

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
