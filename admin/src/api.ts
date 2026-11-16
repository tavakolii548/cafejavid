export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type Role = 'OWNER' | 'STAFF';

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  role: Role;
  username: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  options: { choiceName: string; groupName?: string; priceDelta: number }[];
  note: string | null;
  lineTotal: number;
}

export interface Order {
  id: string;
  number: number;
  status: string;
  fulfillment: string;
  tableNumber: number | null;
  addressSnapshot: unknown;
  customerNote: string | null;
  subtotal: number;
  deliveryFee: number;
  packagingFee?: number;
  discountAmount?: number;
  discountCode?: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  cancelReason: string | null;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; phone: string; name: string | null };
  items: OrderItem[];
}

export interface Choice {
  id?: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface OptionGroup {
  id?: string;
  name: string;
  type: 'SINGLE' | 'MULTI';
  required: boolean;
  choices: Choice[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  featured: boolean;
  soldOut: boolean;
  hidden: boolean;
  sortOrder: number;
  optionGroups: OptionGroup[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface Settings {
  cafeName: string;
  phone: string;
  address: string;
  openingHours: string;
  deliveryFee: number;
  packagingFee: number;
  minOrder: number;
  tableCount: number;
  acceptingOrders: boolean;
  receiptFooter: string;
}

const KEY = 'cafe-staff-session';

export function loadSession(): StaffSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StaffSession | null) {
  if (!session) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(session));
}

async function raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = loadSession();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session?.refreshToken && !path.includes('/auth/login')) {
    const refreshed = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshed.ok) {
      const data = await refreshed.json();
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.staff?.role ?? session.role,
        username: data.staff?.username ?? session.username,
      });
      return raw(path, init, false);
    }
    saveSession(null);
  }
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { PREVIEW_MODE, previewResponse } = await import('./preview');
  if (PREVIEW_MODE) {
    const mocked = previewResponse(path, init);
    if (mocked !== null) return mocked as T;
  }
  const response = await raw(path, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error?.message || 'خطا در ارتباط با سرور');
  }
  return body as T;
}
