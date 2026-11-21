import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertInventoryItemDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(40)
  unit!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quantityOnHand?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockAt?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class RecipeLineDto {
  @IsString()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtyPerUnit!: number;
}

export class SetProductRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}
