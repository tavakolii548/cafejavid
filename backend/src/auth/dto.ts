import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  phone!: string;

  @IsString()
  code!: string;
}

export class CustomerLoginDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsBoolean()
  register?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  birthDate?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class StaffLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  birthDate?: string;
}
