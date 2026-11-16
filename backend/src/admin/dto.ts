import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OptionType } from '@prisma/client';

export class CategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export class ChoiceWriteDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  priceDelta!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class GroupWriteDto {
  @IsString()
  name!: string;

  @IsEnum(OptionType)
  type!: OptionType;

  @IsBoolean()
  required!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceWriteDto)
  choices!: ChoiceWriteDto[];
}

export class ProductWriteDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(400)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  soldOut?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupWriteDto)
  optionGroups?: GroupWriteDto[];
}

export class AvailabilityDto {
  @IsBoolean()
  soldOut!: boolean;
}

export class ClubMemberDto {
  @IsString()
  @MaxLength(20)
  phone!: string;

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
  @MaxLength(20)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerCode?: string;
}

export class UpdateClubMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

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
  @MaxLength(20)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerCode?: string;
}

export class SettingsDto {
  @IsOptional()
  @IsString()
  cafeName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsString()
  receiptFooter?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  packagingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tableCount?: number;

  @IsOptional()
  @IsBoolean()
  acceptingOrders?: boolean;
}
