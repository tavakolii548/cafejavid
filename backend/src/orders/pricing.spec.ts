import { priceItem, PriceError, PriceGroup } from './pricing';

const groups: PriceGroup[] = [
  {
    id: 'g1',
    name: 'سایز',
    type: 'SINGLE',
    required: true,
    choices: [
      { id: 's', name: 'کوچک', priceDelta: 0 },
      { id: 'm', name: 'متوسط', priceDelta: 15000 },
      { id: 'l', name: 'بزرگ', priceDelta: 30000 },
    ],
  },
  {
    id: 'g2',
    name: 'شات اضافه',
    type: 'MULTI',
    required: false,
    choices: [{ id: 'shot', name: 'شات اضافه', priceDelta: 20000 }],
  },
];

describe('priceItem', () => {
  it('uses catalog deltas and ignores any client price', () => {
    const line = priceItem(115000, groups, ['m', 'shot'], 2);
    expect(line.unitPrice).toBe(150000);
    expect(line.lineTotal).toBe(300000);
    expect(line.options.map((o) => o.choiceName)).toEqual(['متوسط', 'شات اضافه']);
  });

  it('rejects missing required groups, unknown choices, and sold-out style bad ids', () => {
    expect(() => priceItem(115000, groups, [], 1)).toThrow(PriceError);
    expect(() => priceItem(115000, groups, ['nope'], 1)).toThrow(PriceError);
    expect(() => priceItem(115000, groups, ['s', 'm'], 1)).toThrow(PriceError);
    expect(() => priceItem(115000, groups, ['s'], 21)).toThrow(PriceError);
  });
});
