/**
 * apps/api-gateway/src/modules/auth/dto/auth.dto.ts
 *
 * DTOs cho /v1/auth/* endpoints. Validate bằng class-validator.
 */
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "alice@acme.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "AliceP@ss123" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: "Opaque refresh token (httponly cookie value)" })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class RegisterDto {
  @ApiProperty({ example: "bob@acme.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Bob Nguyễn" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty({ example: "BobP@ss123" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: "Bob Events" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organizationName!: string;

  @ApiProperty({ example: "bob-events" })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  organizationSlug!: string;
}

export interface AuthSuccessResponse {
  userId: string;
  organizationId?: string;
  accessToken: string;
  accessExpiresAt: string;
}
