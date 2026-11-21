import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toPersianDigits } from '../lib/format';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  unitLabel: string;
  quantityOnHand: number;
  lowStockAt: number | null;
  active: boolean;
  lowStock: boolean;
}

interface RecipeLine {
  id?: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  unit?: string;
  unitLabel?: string;
  qtyPerUnit: number;
}

interface ProductRecipe {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  lines: RecipeLine[];
}

type ItemForm = {
  name: string;
  unit: string;
  quantityOnHand: string;
  lowStockAt: string;
  active: boolean;
};

const emptyItemForm: ItemForm = {
  name: '',
  unit: '',
  quantityOnHand: '0',
  lowStockAt: '',
  active: true,
};

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'recipes'>('stock');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [recipeProductId, setRecipeProductId] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeLine[]>([]);

  const items = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api<InventoryItem[]>('/api/v1/admin/inventory/items'),
  });
  const recipes = useQuery({
    queryKey: ['inventory-recipes'],
    queryFn: () => api<ProductRecipe[]>('/api/v1/admin/inventory/recipes'),
  });

  const lowCount = useMemo(() => (items.data ?? []).filter((row) => row.lowStock && row.active).length, [items.data]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-recipes'] }),
    ]);
  }

  const saveItem = useMutation({
    mutationFn: async () => {
      const body = {
        name: itemForm.name.trim(),
        unit: itemForm.unit,
        quantityOnHand: editingItem ? undefined : Number(itemForm.quantityOnHand || '0'),
        lowStockAt: itemForm.lowStockAt.trim() ? Number(itemForm.lowStockAt) : null,
        active: itemForm.active,
      };
      if (editingItem) {
        return api(`/api/v1/admin/inventory/items/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return api('/api/v1/admin/inventory/items', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      setItemForm(emptyItemForm);
      setEditingItem(null);
      setError('');
      setMessage(editingItem ? 'ماده به‌روز شد' : 'ماده ثبت شد');
      await refresh();
    },
    onError: (err: Error) => {
      setMessage('');
      setError(err.message);
    },
  });

  const adjust = useMutation({
    mutationFn: () =>
      api(`/api/v1/admin/inventory/items/${adjustId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          delta: Number(adjustDelta),
          note: adjustNote.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setAdjustId(null);
      setAdjustDelta('');
      setAdjustNote('');
      setMessage('موجودی اصلاح شد');
      await refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api(`/api/v1/admin/inventory/items/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setMessage('ماده حذف شد');
      await refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveRecipe = useMutation({
    mutationFn: () =>
      api(`/api/v1/admin/inventory/recipes/${recipeProductId}`, {
        method: 'PUT',
        body: JSON.stringify({
          lines: recipeDraft
            .filter((line) => line.inventoryItemId && Number(line.qtyPerUnit) > 0)
            .map((line) => ({
              inventoryItemId: line.inventoryItemId,
              qtyPerUnit: Number(line.qtyPerUnit),
            })),
        }),
      }),
    onSuccess: async () => {
      setRecipeProductId(null);
      setRecipeDraft([]);
      setMessage('دستور محصول ذخیره شد');
      await refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      unit: item.unit,
      quantityOnHand: String(item.quantityOnHand),
      lowStockAt: item.lowStockAt == null ? '' : String(item.lowStockAt),
      active: item.active,
    });
    setError('');
    setMessage('');
  }

  function openRecipe(product: ProductRecipe) {
    setRecipeProductId(product.productId);
    setRecipeDraft(
      product.lines.length
        ? product.lines.map((line) => ({ ...line }))
        : [{ inventoryItemId: '', qtyPerUnit: 1 }],
    );
    setError('');
  }

  function onSubmitItem(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!itemForm.name.trim()) {
      setError('نام ماده را وارد کنید');
      return;
    }
    if (!itemForm.unit.trim()) {
      setError('واحد را وارد کنید (مثلاً گرم، عدد، میلی‌لیتر)');
      return;
    }
    if (!editingItem && !Number.isFinite(Number(itemForm.quantityOnHand))) {
      setError('موجودی اولیه معتبر نیست');
      return;
    }
    saveItem.mutate();
  }

  return (
    <div className="panel-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
          <h1 className="panel-title">انبارگردانی</h1>
          <p className="panel-subtitle">
            مواد انبار را ثبت کنید، برای هر محصول مصرف مشخص کنید؛ با فروش سفارش، موجودی خودکار کم می‌شود
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`toolbar-chip ${tab === 'stock' ? 'toolbar-chip-on' : ''}`}
            onClick={() => setTab('stock')}
          >
            مواد انبار
          </button>
          <button
            type="button"
            className={`toolbar-chip ${tab === 'recipes' ? 'toolbar-chip-on' : ''}`}
            onClick={() => setTab('recipes')}
          >
            دستور محصولات
          </button>
        </div>
      </header>

      {lowCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-accent/40 bg-sand px-4 py-2.5 text-sm shadow-sm">
          <span className="rounded-full border border-danger/25 bg-[var(--color-danger-soft)] px-2.5 py-0.5 text-[11px] font-bold text-danger">
            {toPersianDigits(lowCount)} ماده کم‌موجود
          </span>
          <span className="text-ink/90">مواد فعال زیر آستانه‌اند — موجودی را اصلاح یا تأمین کنید.</span>
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-2xl border border-danger/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-2xl border border-primary/20 bg-tint/50 px-3 py-2 text-sm font-medium text-primary">{message}</p>
      ) : null}

      {tab === 'stock' ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <form onSubmit={onSubmitItem} className="order-card">
            <h2 className="mb-1 text-lg font-bold">{editingItem ? 'ویرایش ماده' : 'ماده جدید'}</h2>
            <p className="mb-3 text-sm text-muted">واحد و آستانه کم‌موجودی برای هشدار انبار</p>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">نام</span>
              <input
                className="h-12 w-full rounded-btn border border-line px-3"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثلاً شیر یا پودر اسپرسو"
                required
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">واحد</span>
              <UnitField
                value={itemForm.unit}
                onChange={(unit) => setItemForm((f) => ({ ...f, unit }))}
              />
            </label>
            {!editingItem ? (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block text-muted">موجودی اولیه</span>
                <input
                  type="number"
                  className="h-12 w-full rounded-btn border border-line px-3"
                  value={itemForm.quantityOnHand}
                  onChange={(e) => setItemForm((f) => ({ ...f, quantityOnHand: e.target.value }))}
                />
              </label>
            ) : null}
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-muted">آستانه کم‌موجودی (اختیاری)</span>
              <input
                type="number"
                min={0}
                className="h-12 w-full rounded-btn border border-line px-3"
                value={itemForm.lowStockAt}
                onChange={(e) => setItemForm((f) => ({ ...f, lowStockAt: e.target.value }))}
                placeholder="مثلاً ۵۰۰"
              />
            </label>
            <label className="mb-4 flex items-center gap-2 rounded-2xl bg-tint/50 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={itemForm.active}
                onChange={(e) => setItemForm((f) => ({ ...f, active: e.target.checked }))}
              />
              فعال
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                disabled={saveItem.isPending}
              >
                ذخیره
              </button>
              {editingItem ? (
                <button
                  type="button"
                  className="h-12 flex-1 rounded-btn border border-line"
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm(emptyItemForm);
                  }}
                >
                  انصراف
                </button>
              ) : null}
            </div>
          </form>

          <div className="board-column border border-line/70 bg-white/75">
            <h2 className="mb-3 text-sm font-bold">فهرست مواد</h2>
            <div className="overflow-x-auto rounded-[18px] border border-line/70 bg-white/95">
              <table className="w-full min-w-[560px] text-right text-sm">
                <thead className="bg-tint/50 text-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">ماده</th>
                    <th className="px-3 py-2.5 font-medium">موجودی</th>
                    <th className="px-3 py-2.5 font-medium">وضعیت</th>
                    <th className="px-3 py-2.5 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {(items.data ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-line/80 transition hover:bg-tint/30">
                      <td className="px-2 py-3">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-xs text-muted">{item.unitLabel}</div>
                      </td>
                      <td className="px-2 py-3 font-bold">
                        {toPersianDigits(item.quantityOnHand)} {item.unitLabel}
                      </td>
                      <td className="px-3 py-3">
                        {!item.active ? (
                          <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-[11px] font-medium text-muted">غیرفعال</span>
                        ) : item.lowStock ? (
                          <span className="rounded-full border border-danger/25 bg-[var(--color-danger-soft)] px-2.5 py-0.5 text-[11px] font-bold text-danger">
                            کم‌موجود
                          </span>
                        ) : (
                          <span className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-bold text-primary">کافی</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="toolbar-chip !h-8 !px-3 !text-xs" onClick={() => openEditItem(item)}>
                            ویرایش
                          </button>
                          <button
                            type="button"
                            className="toolbar-chip !h-8 !px-3 !text-xs"
                            onClick={() => {
                              setAdjustId(item.id);
                              setAdjustDelta('');
                              setAdjustNote('');
                            }}
                          >
                            اصلاح موجودی
                          </button>
                          <button
                            type="button"
                            className="toolbar-chip !h-8 !px-3 !text-xs text-danger hover:!border-danger/30"
                            onClick={() => {
                              if (window.confirm(`«${item.name}» حذف شود؟`)) removeItem.mutate(item.id);
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.isLoading && (items.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-8 text-center text-muted">
                        هنوز ماده‌ای ثبت نشده است
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="board-column border border-line/70 bg-white/75">
          <h2 className="mb-3 text-sm font-bold">مصرف مواد برای هر محصول</h2>
          <div className="grid gap-3">
            {(recipes.data ?? []).map((product) => (
              <article key={product.productId} className="order-card !shadow-none hover:!translate-y-0 hover:!shadow-none">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{product.productName}</div>
                    <div className="text-xs text-muted">{product.categoryName}</div>
                  </div>
                  <button type="button" className="toolbar-chip !h-9" onClick={() => openRecipe(product)}>
                    تنظیم دستور
                  </button>
                </div>
                {product.lines.length ? (
                  <ul className="space-y-1 text-sm text-muted">
                    {product.lines.map((line) => (
                      <li key={`${product.productId}-${line.inventoryItemId}`}>
                        {line.inventoryItemName}: {toPersianDigits(line.qtyPerUnit)} {line.unitLabel} برای هر واحد فروش
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">هنوز دستوری تعریف نشده — با فروش از انبار کم نمی‌شود</p>
                )}
              </article>
            ))}
            {!recipes.isLoading && (recipes.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-muted">محصولی در منو نیست</p>
            ) : null}
          </div>
        </div>
      )}

      {adjustId ? (
        <form
          className="fixed inset-0 z-20 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!Number.isFinite(Number(adjustDelta)) || Number(adjustDelta) === 0) {
              setError('مقدار تغییر را وارد کنید (مثبت برای افزایش، منفی برای کاهش)');
              return;
            }
            adjust.mutate();
          }}
        >
          <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]">
            <h2 className="mb-1 text-lg font-bold">اصلاح موجودی</h2>
            <p className="mb-3 text-sm text-muted">عدد مثبت موجودی را زیاد و عدد منفی کم می‌کند</p>
            <input
              type="number"
              className="mb-2 h-12 w-full rounded-btn border border-line px-3"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              placeholder="مثلاً ۵۰۰ یا -۲۰۰"
              required
            />
            <input
              className="mb-3 h-12 w-full rounded-btn border border-line px-3"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="یادداشت (اختیاری)"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
              >
                ذخیره
              </button>
              <button type="button" className="h-12 flex-1 rounded-btn border border-line" onClick={() => setAdjustId(null)}>
                بستن
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {recipeProductId ? (
        <form
          className="fixed inset-0 z-20 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onSubmit={(event) => {
            event.preventDefault();
            saveRecipe.mutate();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]">
            <h2 className="mb-1 text-lg font-bold">دستور محصول</h2>
            <p className="mb-3 text-sm text-muted">برای هر واحد فروش، مقدار مصرف هر ماده را مشخص کنید.</p>
            <div className="mb-3 space-y-2">
              {recipeDraft.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2">
                  <select
                    className="h-11 rounded-btn border border-line px-2 text-sm"
                    value={line.inventoryItemId}
                    onChange={(e) => {
                      const next = [...recipeDraft];
                      next[index] = { ...line, inventoryItemId: e.target.value };
                      setRecipeDraft(next);
                    }}
                  >
                    <option value="">انتخاب ماده</option>
                    {(items.data ?? [])
                      .filter((item) => item.active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unitLabel})
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="h-11 rounded-btn border border-line px-2 text-sm"
                    value={line.qtyPerUnit}
                    onChange={(e) => {
                      const next = [...recipeDraft];
                      next[index] = { ...line, qtyPerUnit: Number(e.target.value) || 1 };
                      setRecipeDraft(next);
                    }}
                  />
                  <button
                    type="button"
                    className="h-11 rounded-btn border border-line px-3 text-sm"
                    onClick={() => setRecipeDraft((rows) => rows.filter((_, i) => i !== index))}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mb-4 text-sm font-medium text-primary"
              onClick={() => setRecipeDraft((rows) => [...rows, { inventoryItemId: '', qtyPerUnit: 1 }])}
            >
              + افزودن ماده
            </button>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110"
                disabled={saveRecipe.isPending}
              >
                ذخیره دستور
              </button>
              <button
                type="button"
                className="h-12 flex-1 rounded-btn border border-line"
                onClick={() => {
                  setRecipeProductId(null);
                  setRecipeDraft([]);
                }}
              >
                بستن
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

const UNIT_PRESETS = ['گرم', 'عدد', 'میلی‌لیتر', 'لیتر', 'کیلوگرم', 'بسته'] as const;

const unitSelectClass =
  'h-12 w-full appearance-none rounded-btn border border-line bg-white bg-no-repeat px-3 pe-9 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

const unitChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236B7A72' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundPosition: 'left 0.85rem center',
  backgroundSize: '12px 12px',
} as const;

function UnitField({ value, onChange }: { value: string; onChange: (unit: string) => void }) {
  const isPreset = (UNIT_PRESETS as readonly string[]).includes(value);
  const selectValue = isPreset ? value : '__custom__';

  return (
    <div className="space-y-2">
      <select
        className={unitSelectClass}
        style={unitChevronStyle}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '__custom__') onChange(isPreset ? '' : value);
          else onChange(next);
        }}
        aria-label="واحد پیشنهادی"
      >
        <option value="" disabled>
          انتخاب واحد
        </option>
        {UNIT_PRESETS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
        <option value="__custom__">سایر…</option>
      </select>
      {!isPreset ? (
        <input
          className="h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="واحد دلخواه را بنویسید"
          required
        />
      ) : null}
    </div>
  );
}
