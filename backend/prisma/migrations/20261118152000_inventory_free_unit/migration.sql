-- Convert inventory unit enum to free-text label
ALTER TABLE "InventoryItem" ALTER COLUMN "unit" TYPE TEXT USING (
  CASE "unit"::text
    WHEN 'GRAM' THEN 'گرم'
    WHEN 'ML' THEN 'میلی‌لیتر'
    WHEN 'PIECE' THEN 'عدد'
    ELSE "unit"::text
  END
);

DROP TYPE "InventoryUnit";
