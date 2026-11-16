import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Category, type OptionGroup, type Product } from '../api';
import { PriceInput } from '../components/PriceInput';
import { formatPrice, formatPriceGrouped } from '../lib/format';

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
  const [error, setError] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all');

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categories.data]);

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

  async function addCategory() {
    const name = window.prompt('نام دسته');
    if (!name) return;
    await api('/api/v1/admin/categories', { method: 'POST', body: JSON.stringify({ name, sortOrder: categories.data?.length ?? 0 }) });
    await refresh();
  }

  async function dropCategory(event: React.DragEvent, targetId: string) {
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || !categories.data) return;
    const ids = categories.data.map((item) => item.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await api('/api/v1/admin/categories/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
    await refresh();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing?.name || !editing.categoryId) return;
    setError('');
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

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">منو و موجودی</h1>
          <p className="text-sm text-muted">
            {(products.data ?? []).length} محصول در {(categories.data ?? []).length} دسته
            {filterCategoryId !== 'all' ? ` · نمایش ${visibleProducts.length} مورد` : ''}
          </p>
        </div>
        <button
          className="h-12 shrink-0 rounded-btn bg-primary px-4 font-bold text-white"
          onClick={() =>
            setEditing({
              categoryId: filterCategoryId !== 'all' ? filterCategoryId : categories.data?.[0]?.id,
              name: '',
              description: '',
              price: 0,
              featured: false,
              soldOut: false,
              hidden: false,
              optionGroups: [],
            })
          }
        >
          محصول جدید
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategoryId('all')}
          className={`rounded-full border px-4 py-2 text-sm ${filterCategoryId === 'all' ? 'border-primary bg-tint font-bold' : 'border-line bg-white'}`}
        >
          همه
        </button>
        {(categories.data ?? []).map((category) => (
          <div
            key={category.id}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', category.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void dropCategory(event, category.id)}
            className={`cursor-grab rounded-full border px-4 py-2 text-sm ${
              filterCategoryId === category.id ? 'border-primary bg-tint font-bold' : 'border-line bg-white'
            }`}
            onClick={() => setFilterCategoryId(category.id)}
          >
            {category.name}
          </div>
        ))}
        <button className="rounded-full border border-dashed border-line px-4 py-2 text-sm" onClick={() => void addCategory()}>
          دسته جدید
        </button>
      </div>
      {(categories.isError || products.isError) && (
        <button className="mb-4 rounded-btn bg-ink px-4 py-2 text-white" onClick={() => void refresh()}>
          تلاش دوباره
        </button>
      )}
      <div className="grid gap-3">
        {visibleProducts.map((product) => (
          <article key={product.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
            <div className="min-w-0">
              <div className="font-bold">{product.name}</div>
              <div className="text-sm text-muted">
                {categoryName.get(product.categoryId) ?? 'بدون دسته'} · {formatPrice(product.price)}
                {product.featured ? ' · پیشنهاد' : ''}
                {(product.optionGroups?.length ?? 0) > 0 ? ` · ${product.optionGroups.length} گروه گزینه` : ''}
              </div>
              {product.description ? <div className="mt-1 truncate text-xs text-muted">{product.description}</div> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className={`h-11 rounded-btn px-3 text-sm font-bold ${product.soldOut ? 'bg-sand' : 'bg-tint'}`}
                onClick={async () => {
                  await api(`/api/v1/admin/products/${product.id}/availability`, {
                    method: 'PATCH',
                    body: JSON.stringify({ soldOut: !product.soldOut }),
                  });
                  await refresh();
                }}
              >
                {product.soldOut ? 'تموم شد' : 'موجود'}
              </button>
              <button
                className="h-11 rounded-btn border border-line px-3 text-sm"
                onClick={async () => {
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
                      optionGroups: product.optionGroups ?? [],
                    }),
                  });
                  await refresh();
                }}
              >
                {product.hidden ? 'مخفی' : 'نمایان'}
              </button>
              <button className="h-11 rounded-btn border border-line px-3 text-sm" onClick={() => setEditing(product)}>
                ویرایش
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <form onSubmit={save} className="fixed inset-0 z-10 grid place-items-center bg-ink/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-card bg-white p-5">
            <h2 className="mb-3 font-bold">{editing.id ? 'ویرایش محصول' : 'محصول جدید'}</h2>
            <select
              className="mb-2 h-12 w-full rounded-btn border border-line px-3"
              value={editing.categoryId || ''}
              onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}
            >
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input className="mb-2 h-12 w-full rounded-btn border border-line px-3" placeholder="نام" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <input className="mb-2 h-12 w-full rounded-btn border border-line px-3" placeholder="توضیح" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="mb-2">
              <PriceInput
                value={editing.price ?? 0}
                onChange={(v) => setEditing({ ...editing, price: Number(v) || 0 })}
                min={0}
                placeholder="قیمت تومان"
              />
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(editing.featured)} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              پیشنهاد امروز
            </label>
            <input className="mb-3 block text-sm" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <div className="mb-3 space-y-2">
              {(editing.optionGroups ?? []).map((group, index) => (
                <div key={index} className="rounded-btn border border-line p-2 text-sm">
                  <input className="mb-1 h-10 w-full rounded-btn border border-line px-2" value={group.name} onChange={(e) => {
                    const optionGroups = [...(editing.optionGroups ?? [])];
                    optionGroups[index] = { ...group, name: e.target.value };
                    setEditing({ ...editing, optionGroups });
                  }} />
                  <div className="text-xs text-muted">{group.type === 'SINGLE' ? 'تک‌انتخابی' : 'چندانتخابی'} · {group.required ? 'اجباری' : 'اختیاری'}</div>
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
              <button type="button" className="text-sm text-primary" onClick={() => setEditing({ ...editing, optionGroups: [...(editing.optionGroups ?? []), emptyGroup()] })}>
                افزودن گروه گزینه
              </button>
            </div>
            {error ? <p className="mb-2 text-sm">{error}</p> : null}
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-btn bg-primary font-bold text-white" type="submit">ذخیره</button>
              <button className="h-12 flex-1 rounded-btn border border-line" type="button" onClick={() => setEditing(null)}>بستن</button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
