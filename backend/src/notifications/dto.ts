import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;

  @IsIn(['ALL', 'USER', 'MULTI', 'BIRTHDAY', 'SPECIAL_DAY'])
  audience!: 'ALL' | 'USER' | 'MULTI' | 'BIRTHDAY' | 'SPECIAL_DAY';

  @IsOptional()
  @IsIn(['NOW', 'RULE'])
  delivery?: 'NOW' | 'RULE';

  /** CALENDAR = birthday/special day; INTERVAL = every N hours/days/weeks */
  @IsOptional()
  @IsIn(['CALENDAR', 'INTERVAL'])
  ruleKind?: 'CALENDAR' | 'INTERVAL';

  @ValidateIf((o: CreateNotificationDto) => o.delivery === 'RULE' && o.ruleKind === 'INTERVAL')
  @IsIn(['HOURS', 'DAYS', 'WEEKS'])
  intervalUnit?: 'HOURS' | 'DAYS' | 'WEEKS';

  @ValidateIf((o: CreateNotificationDto) => o.delivery === 'RULE' && o.ruleKind === 'INTERVAL')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  intervalValue?: number;

  @ValidateIf((o: CreateNotificationDto) => o.audience === 'USER')
  @IsString()
  userId?: string;

  @ValidateIf((o: CreateNotificationDto) => o.audience === 'MULTI' || o.audience === 'SPECIAL_DAY')
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  userIds?: string[];

  @ValidateIf((o: CreateNotificationDto) => o.audience === 'SPECIAL_DAY')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  specialMonth?: number;

  @ValidateIf((o: CreateNotificationDto) => o.audience === 'SPECIAL_DAY')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  specialDay?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateNotificationRuleDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body?: string;
}
