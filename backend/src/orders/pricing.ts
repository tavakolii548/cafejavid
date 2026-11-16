export class PriceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export type PriceChoice = { id: string; name: string; priceDelta: number };
export type PriceGroup = {
  id: string;
  name: string;
  type: 'SINGLE' | 'MULTI';
  required: boolean;
  choices: PriceChoice[];
};

export type PricedOption = {
  choiceId: string;
  groupName: string;
  choiceName: string;
  priceDelta: number;
};

/** Recompute a line from catalog data. Client prices are never an input. */
export function priceItem(
  basePrice: number,
  groups: PriceGroup[],
  choiceIds: string[],
  quantity: number,
): { unitPrice: number; lineTotal: number; options: PricedOption[] } {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new PriceError('INVALID_QTY');
  }
  if (new Set(choiceIds).size !== choiceIds.length) {
    throw new PriceError('DUPLICATE_CHOICE');
  }
  const byId = new Map<string, { choice: PriceChoice; group: PriceGroup }>();
  for (const group of groups) {
    for (const choice of group.choices) {
      byId.set(choice.id, { choice, group });
    }
  }
  for (const id of choiceIds) {
    if (!byId.has(id)) throw new PriceError('UNKNOWN_CHOICE');
  }
  const selected = new Set(choiceIds);
  const options: PricedOption[] = [];
  let delta = 0;
  for (const group of groups) {
    const chosen = group.choices.filter((c) => selected.has(c.id));
    if (group.type === 'SINGLE') {
      if (chosen.length > 1) throw new PriceError('SINGLE_OPTION');
      if (group.required && chosen.length !== 1) throw new PriceError('REQUIRED_OPTION');
    }
    for (const choice of chosen) {
      delta += choice.priceDelta;
      options.push({
        choiceId: choice.id,
        groupName: group.name,
        choiceName: choice.name,
        priceDelta: choice.priceDelta,
      });
    }
  }
  const unitPrice = basePrice + delta;
  return { unitPrice, lineTotal: unitPrice * quantity, options };
}
