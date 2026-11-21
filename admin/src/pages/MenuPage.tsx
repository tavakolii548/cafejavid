import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Category, type OptionGroup, type Product } from '../api';
import { PriceInput } from '../components/PriceInput';
import { formatPrice, formatPriceGrouped, toPersianDigits } from '../lib/format';

const emptyGroup = (): OptionGroup => ({
  name: 'سایز',
  type: 'SINGLE',
  required: true,
  choices: [{ name: 'معمولی', priceDelta: 0, isDefault: true }],
});

export function MenuPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/api/v1/admin/categories') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/api/v1/admin/products') });
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [error, setError] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all');

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categories.data]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products.data ?? []) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products.data]);

  const visibleProducts = useMemo(() => {
    const list = products.data ?? [];
    if (filterCategoryId === 'all') return list;
    return list.filter((product) => product.categoryId === filterCategoryId);
  }, [products.data, filterCategoryId]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);
  }

  function openNewCategory() {
    setEditingCategory({ id: '', name: '', sortOrder: categories.data?.length ?? 0, active: true });
    setCategoryNameDraft('');
    setError('');
  }

  function openRenameCategory(category: Category) {
    setFilterCategoryId(category.id);
    setEditingCategory(category);
    setCategoryNameDraft(category.name);
    setError('');
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!editingCategory) return;
    const name = categoryNameDraft.trim();
    if (!name) {
      setError('نام دسته را وارد کنید');
      return;
    }
    setError('');
    try {
      if (!editingCategory.id) {
        await api('/api/v1/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name, sortOrder: categories.data?.length ?? 0, active: true }),
        });
      } else {
        await api(`/api/v1/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            sortOrder: editingCategory.sortOrder,
            active: editingCategory.active,
          }),
        });
      }
      setEditingCategory(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره دسته نشد');
    }
  }

  async function toggleCategoryActive(category: Category) {
    setError('');
    try {
      await api(`/api/v1/admin/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: category.name, sortOrder: category.sortOrder, active: !category.active }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'وضعیت دسته عوض نشد');
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`دسته «${category.name}» حذف شود؟\nاگر محصول داشته باشد حذف نمی‌شود.`)) return;
    setError('');
    try {
      await api(`/api/v1/admin/categories/${category.id}`, { method: 'DELETE' });
      if (filterCategoryId === category.id) setFilterCategoryId('all');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف دسته نشد');
    }
  }

  async function dropCategory(event: DragEvent, targetId: string) {
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || !categories.data) return;
    const ids = categories.data.map((item) => item.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setError('');
    try {
      await api('/api/v1/admin/categories/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'جابه‌جایی دسته نشد');
    }
  }

  const selectedCategory = useMemo(
    () => (filterCategoryId === 'all' ? null : (categories.data ?? []).find((c) => c.id === filterCategoryId) ?? null),
    [categories.data, filterCategoryId],
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing?.name || !editing.categoryId) return;
    setError('');
    const startH = editing.serviceStartHour;
    const endH = editing.serviceEndHour;
    const hasWindow =
      startH !== null &&
      startH !== undefined &&
      endH !== null &&
      endH !== undefined &&
      !Number.isNaN(Number(startH)) &&
      !Number.isNaN(Number(endH));
    const body = {
      categoryId: editing.categoryId,
      name: editing.name,
      description: editing.description || '',
      price: Number(editing.price || 0),
      imageUrl: editing.imageUrl || undefined,
      featured: Boolean(editing.featured),
      soldOut: Boolean(editing.soldOut),
      hidden: Boolean(editing.hidden),
      sortOrder: Number(editing.sortOrder || 0),
      serviceStartHour: hasWindow ? Number(startH) : null,
      serviceEndHour: hasWindow ? Number(endH) : null,
      optionGroups: editing.optionGroups ?? [],
    };
    try {
      if (editing.id) {
        await api(`/api/v1/admin/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/v1/admin/products', { method: 'POST', body: JSON.stringify(body) });
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره نشد');
    }
  }

  async function upload(file: File) {
    const data = new FormData();
    data.append('file', file);
    const result = await api<{ url: string }>('/api/v1/admin/uploads', { method: 'POST', body: data });
    setEditing((current) => (current ? { ...current, imageUrl: result.url } : current));
  }

  async function toggleSoldOut(product: Product) {
    await api(`/api/v1/admin/products/${product.id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ soldOut: !product.soldOut }),
    });
    await refresh();
  }

  async function toggleHidden(product: Product) {
    await api(`/api/v1/admin/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        featured: product.featured,
        soldOut: product.soldOut,
        hidden: !product.hidden,
        sortOrder: product.sortOrder,
        serviceStartHour: product.serviceStartHour ?? null,
        serviceEndHour: product.serviceEndHour ?? null,
        optionGroups: product.optionGroups ?? [],
      }),
    });
    await refresh();
  }

  return (
    <div className="panel-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-primary/80">کافه جاوید</p>
          <h1 className="panel-title">منو و موجودی</h1>
          <p className="panel-subtitle">
            {toPersianDigits((products.data ?? []).length)} محصول در {toPersianDigits((categories.data ?? []).length)} دسته
            {filterCategoryId !== 'all' ? ` · نمایش ${toPersianDigits(visibleProducts.length)} مورد` : ''}
          </p>
        </div>
        <button
          className="h-12 shrink-0 rounded-btn bg-primary px-5 font-bold text-white shadow-[0_10px_24px_rgba(30,77,58,0.22)] transition hover:brightness-110"
          onClick={() =>
            setEditing({
              categoryId: filterCategoryId !== 'all' ? filterCategoryId : categories.data?.[0]?.id,
              name: '',
              description: '',
              price: 0,
              featured: false,
              soldOut: false,
              hidden: false,
              serviceStartHour: null,
              serviceEndHour: null,
              optionGroups: [],
            })
          }
        >
          محصول جدید
        </button>
      </header>

      <section className="mb-4 rounded-[22px] border border-line/70 bg-white/75 p-3.5 shadow-[var(--shadow-soft)] backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-sm font-bold">دسته‌ها</h2>
          <p className="text-[11px] text-muted">کشیدن برای ترتیب · دابل‌کلیک برای ویرایش نام</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterCategoryId('all')}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              filterCategoryId === 'all'
                ? 'border-primary/30 bg-tint font-bold text-primary shadow-sm'
                : 'border-line bg-white hover:border-primary/25 hover:bg-tint/40'
            }`}
          >
            همه
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-ink">
              {toPersianDigits((products.data ?? []).length)}
            </span>
          </button>
          {(categories.data ?? []).map((category) => {
            const active = filterCategoryId === category.id;
            const count = productCountByCategory.get(category.id) ?? 0;
            return (
              <div
                key={category.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', category.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void dropCategory(event, category.id)}
                className={`inline-flex cursor-grab items-center gap-2 rounded-full border px-4 py-2 text-sm transition active:cursor-grabbing ${
                  active
                    ? 'border-primary/30 bg-tint font-bold text-primary shadow-sm'
                    : 'border-line bg-white hover:border-primary/25 hover:bg-tint/40'
                } ${category.active ? '' : 'opacity-55'}`}
                onClick={() => setFilterCategoryId(category.id)}
                onDoubleClick={() => openRenameCategory(category)}
                title={category.active ? 'یک‌بار کلیک: انتخاب · دابل‌کلیک: ویرایش نام' : 'غیرفعال — در اپ نمایش داده نمی‌شود'}
              >
                <span className={category.active ? '' : 'line-through'}>{category.name}</span>
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-ink">
                  {toPersianDigits(count)}
                </span>
              </div>
            );
          })}
          <button
            className="rounded-full border border-dashed border-primary/35 bg-tint/30 px-4 py-2 text-sm text-primary transition hover:bg-tint/60"
            onClick={openNewCategory}
          >
            + دسته جدید
          </button>
        </div>

        {selectedCategory ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line/70 bg-tint/35 px-3 py-2.5">
            <span className="text-sm text-muted">
              دسته انتخاب‌شده: <strong className="text-ink">{selectedCategory.name}</strong>
              {!selectedCategory.active ? <span className="mr-2 text-xs text-danger"> · غیرفعال در اپ</span> : null}
            </span>
            <div className="ms-auto flex flex-wrap gap-2">
              <button type="button" className="toolbar-chip !h-9" onClick={() => openRenameCategory(selectedCategory)}>
                ویرایش نام
              </button>
              <button type="button" className="toolbar-chip !h-9" onClick={() => void toggleCategoryActive(selectedCategory)}>
                {selectedCategory.active ? 'غیرفعال در اپ' : 'فعال در اپ'}
              </button>
              <button
                type="button"
                className="toolbar-chip !h-9 text-danger hover:!border-danger/30"
                onClick={() => void removeCategory(selectedCategory)}
              >
                حذف دسته
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {error && !editing && !editingCategory ? (
        <p className="mb-3 rounded-2xl border border-danger/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {(categories.isError || products.isError) && (
        <button className="mb-4 rounded-btn bg-primary px-4 py-2 text-white" onClick={() => void refresh()}>
          تلاش دوباره
        </button>
      )}

      <div className="grid gap-3">
        {visibleProducts.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line bg-white/60 px-4 py-14 text-center text-sm text-muted">
            در این دسته محصولی نیست.
          </div>
        ) : (
          visibleProducts.map((product) => (
            <article
              key={product.id}
              className={`order-card flex flex-wrap items-center justify-between gap-3 ${
                product.soldOut ? 'opacity-90' : ''
              } ${product.hidden ? 'border-dashed' : ''}`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ${
                    product.soldOut ? 'bg-sand text-ink' : 'bg-tint text-primary'
                  }`}
                >
                  {(product.name || '?').slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{product.name}</h3>
                    {product.featured ? (
                      <span className="rounded-full bg-accent/80 px-2 py-0.5 text-[11px] font-bold text-ink">پیشنهاد</span>
                    ) : null}
                    {product.soldOut ? (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium">تمام شد</span>
                    ) : null}
                    {product.hidden ? (
                      <span className="rounded-full bg-line/70 px-2 py-0.5 text-[11px] font-medium text-muted">مخفی</span>
                    ) : null}
                    {product.serviceStartHour != null && product.serviceEndHour != null ? (
                      <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-medium text-primary">
                        {toPersianDigits(product.serviceStartHour)}–{toPersianDigits(product.serviceEndHour)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span>{categoryName.get(product.categoryId) ?? 'بدون دسته'}</span>
                    <span className="text-line">·</span>
                    <span className="font-bold text-primary">{formatPrice(product.price)}</span>
                    {(product.optionGroups?.length ?? 0) > 0 ? (
                      <>
                        <span className="text-line">·</span>
                        <span>{toPersianDigits(product.optionGroups.length)} گروه گزینه</span>
                      </>
                    ) : null}
                  </div>
                  {product.description ? (
                    <p className="mt-1 truncate text-xs text-muted/90">{product.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  className={`h-11 rounded-btn px-3.5 text-sm font-bold transition ${
                    product.soldOut ? 'bg-sand text-ink' : 'bg-tint text-primary hover:bg-tint'
                  }`}
                  onClick={() => void toggleSoldOut(product)}
                >
                  {product.soldOut ? 'تموم شد' : 'موجود'}
                </button>
                <button
                  className={`h-11 rounded-btn border px-3.5 text-sm transition ${
                    product.hidden ? 'border-line bg-line/40 text-muted' : 'border-line bg-white hover:bg-tint/40'
                  }`}
                  onClick={() => void toggleHidden(product)}
                >
                  {product.hidden ? 'مخفی' : 'نمایان'}
                </button>
                <button
                  className="h-11 rounded-btn border border-primary/20 bg-primary px-3.5 text-sm font-bold text-white transition hover:brightness-110"
                  onClick={() => setEditing(product)}
                >
                  ویرایش
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="fixed inset-0 z-10 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]">
            <h2 className="mb-1 text-lg font-bold">{editing.id ? 'ویرایش محصول' : 'محصول جدید'}</h2>
            <p className="mb-4 text-sm text-muted">اطلاعات منو برای اپ و پنل هم‌زمان به‌روز می‌شود.</p>
            <label className="mb-1 block text-xs text-muted">دسته</label>
            <select
              className="mb-3 h-12 w-full rounded-btn border border-line px-3 outline-none focus:border-primary"
              value={editing.categoryId || ''}
              onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}
            >
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs text-muted">نام</label>
            <input
              className="mb-3 h-12 w-full rounded-btn border border-line px-3 outline-none focus:border-primary"
              placeholder="نام"
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <label className="mb-1 block text-xs text-muted">توضیح</label>
            <input
              className="mb-3 h-12 w-full rounded-btn border border-line px-3 outline-none focus:border-primary"
              placeholder="توضیح"
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <label className="mb-1 block text-xs text-muted">قیمت</label>
            <div className="mb-3">
              <PriceInput
                value={editing.price ?? 0}
                onChange={(v) => setEditing({ ...editing, price: Number(v) || 0 })}
                min={0}
                placeholder="قیمت تومان"
              />
            </div>
            <label className="mb-3 flex items-center gap-2 rounded-2xl bg-tint/50 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={Boolean(editing.featured)} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              پیشنهاد امروز
            </label>
            <div className="mb-3 rounded-2xl border border-line/80 bg-tint/25 p-3">
              <p className="mb-2 text-xs font-medium text-primary/90">محدودیت ساعت سفارش (تهران)</p>
              <p className="mb-2 text-[11px] text-muted">خالی = همیشه قابل سفارش. مثال: ۷ تا ۱۹ یعنی از ۷:۰۰ تا قبل از ۱۹:۰۰</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">از ساعت</span>
                  <select
                    className="h-11 w-full appearance-none rounded-btn border border-line bg-white px-3 outline-none focus:border-primary"
                    value={editing.serviceStartHour ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        serviceStartHour: v === '' ? null : Number(v),
                        serviceEndHour: v === '' ? null : (editing.serviceEndHour ?? 19),
                      });
                    }}
                  >
                    <option value="">بدون محدودیت</option>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {toPersianDigits(h)}:۰۰
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">تا ساعت</span>
                  <select
                    className="h-11 w-full appearance-none rounded-btn border border-line bg-white px-3 outline-none focus:border-primary"
                    value={editing.serviceEndHour ?? ''}
                    disabled={editing.serviceStartHour == null}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        serviceEndHour: v === '' ? null : Number(v),
                      });
                    }}
                  >
                    <option value="">—</option>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {toPersianDigits(h)}:۰۰
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <label className="mb-3 block text-xs text-muted">تصویر</label>
            <input className="mb-4 block w-full text-sm" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <div className="mb-3 space-y-2">
              {(editing.optionGroups ?? []).map((group, index) => (
                <div key={index} className="rounded-2xl border border-line bg-tint/25 p-3 text-sm">
                  <input
                    className="mb-1 h-10 w-full rounded-btn border border-line bg-white px-2 outline-none focus:border-primary"
                    value={group.name}
                    onChange={(e) => {
                      const optionGroups = [...(editing.optionGroups ?? [])];
                      optionGroups[index] = { ...group, name: e.target.value };
                      setEditing({ ...editing, optionGroups });
                    }}
                  />
                  <div className="text-xs text-muted">
                    {group.type === 'SINGLE' ? 'تک‌انتخابی' : 'چندانتخابی'} · {group.required ? 'اجباری' : 'اختیاری'}
                  </div>
                  {group.choices.map((choice) => (
                    <div key={choice.name + choice.priceDelta} className="text-xs">
                      {choice.name}
                      {choice.priceDelta
                        ? ` · ${choice.priceDelta > 0 ? '+' : ''}${formatPriceGrouped(choice.priceDelta)} تومان`
                        : ''}
                    </div>
                  ))}
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-medium text-primary"
                onClick={() => setEditing({ ...editing, optionGroups: [...(editing.optionGroups ?? []), emptyGroup()] })}
              >
                + افزودن گروه گزینه
              </button>
            </div>
            {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110" type="submit">
                ذخیره
              </button>
              <button className="h-12 flex-1 rounded-btn border border-line" type="button" onClick={() => setEditing(null)}>
                بستن
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {editingCategory ? (
        <form onSubmit={saveCategory} className="fixed inset-0 z-20 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(23,37,30,0.22)]">
            <h2 className="mb-1 text-lg font-bold">{editingCategory.id ? 'ویرایش نام دسته' : 'دسته جدید'}</h2>
            <p className="mb-4 text-sm text-muted">نام دسته در اپ مشتری هم دیده می‌شود.</p>
            <input
              autoFocus
              className="mb-3 h-12 w-full rounded-btn border border-line px-3 outline-none focus:border-primary"
              placeholder="نام دسته"
              value={categoryNameDraft}
              onChange={(e) => setCategoryNameDraft(e.target.value)}
            />
            {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-btn bg-primary font-bold text-white transition hover:brightness-110" type="submit">
                ذخیره
              </button>
              <button
                className="h-12 flex-1 rounded-btn border border-line"
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setError('');
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
