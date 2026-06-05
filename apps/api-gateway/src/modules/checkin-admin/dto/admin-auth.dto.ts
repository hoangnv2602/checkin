/**
 * apps/api-gateway/src/modules/checkin-admin/dto/admin-auth.dto.ts
 */
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AdminLoginDto {
  @ApiProperty({ example: "owner@saas-checkin.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "VeryStrongP@ss123" })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiProperty({ required: false, example: "123456" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "TOTP code must be 6 digits" })
  totpCode?: string;
}

export class AdminRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AdminMfaVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  setupToken!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "TOTP code must be 6 digits" })
  totpCode!: string;
}
