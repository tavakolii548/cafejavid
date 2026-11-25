import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { API_URL, api, loadSession, saveSession, type Settings } from '../api';

const links = [
  { to: '/', label: 'سفارش‌ها', owner: false },
  { to: '/menu', label: 'منو و موجودی', owner: false },
  { to: '/inventory', label: 'انبارگردانی', owner: true },
  { to: '/reports', label: 'گزارش فروش', owner: true },
  { to: '/customers', label: 'باشگاه مشتریان', owner: true },
  { to: '/discount-codes', label: 'کدهای تخفیف', owner: true },
  { to: '/notifications', label: 'اعلان‌ها', owner: true },
  { to: '/settings', label: 'تنظیمات', owner: true },
];

function resolveLogo(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return '/cafe-logo.png';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;
  return `${API_URL.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}

export function Shell({ children }: { children: ReactNode }) {
  const session = loadSession();
  const navigate = useNavigate();
  const visible = links.filter((link) => !link.owner || session?.role === 'OWNER');
  const [brand, setBrand] = useState<{ name: string; logo: string }>({
    name: 'کافه جاوید',
    logo: '/cafe-logo.png',
  });

  useEffect(() => {
    void api<Settings>('/api/v1/admin/settings')
      .then((settings) => {
        setBrand({
          name: settings.cafeName?.trim() || 'کافه جاوید',
          logo: resolveLogo(settings.logoUrl),
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside
        className="relative flex w-[220px] shrink-0 flex-col overflow-hidden px-3 py-6 text-white"
        style={{
          background:
            'radial-gradient(420px 280px at 0% 0%, rgba(242,181,90,0.22), transparent 55%), linear-gradient(185deg, #245c46 0%, #1e4d3a 42%, #143628 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '14px 14px',
          }}
          aria-hidden
        />

        <div className="relative mb-8 px-2">
          <img
            src={brand.logo}
            alt=""
            className="mb-3 h-11 w-11 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
          />
          <div className="text-[1.05rem] font-bold leading-tight">{brand.name}</div>
          <div className="mt-1 text-[11px] text-white/65">پنل مدیریت</div>
        </div>

        <nav className="relative flex flex-1 flex-col gap-1">
          {visible.map((link, index) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                [
                  'shell-nav-link rounded-2xl px-3 py-2.5 text-sm transition',
                  isActive
                    ? 'bg-white font-bold text-ink shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                    : 'text-white/88 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
              style={{ animationDelay: `${index * 35}ms` }}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative mt-4 border-t border-white/15 pt-4">
          {session?.username ? (
            <div className="mb-2 px-3 text-[11px] text-white/55">
              {session.role === 'OWNER' ? 'مالک' : 'کارمند'} · {session.username}
            </div>
          ) : null}
          <button
            className="w-full rounded-2xl px-3 py-2.5 text-right text-sm text-white/85 transition hover:bg-white/10"
            onClick={() => {
              saveSession(null);
              navigate('/login');
            }}
          >
            خروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
