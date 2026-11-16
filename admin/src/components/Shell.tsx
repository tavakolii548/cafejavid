import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { loadSession, saveSession } from '../api';

const links = [
  { to: '/', label: 'سفارش‌ها', owner: false },
  { to: '/menu', label: 'منو و موجودی', owner: false },
  { to: '/reports', label: 'گزارش فروش', owner: true },
  { to: '/customers', label: 'باشگاه مشتریان', owner: true },
  { to: '/discount-codes', label: 'کدهای تخفیف', owner: true },
  { to: '/notifications', label: 'اعلان‌ها', owner: true },
  { to: '/settings', label: 'تنظیمات', owner: true },
];

export function Shell({ children }: { children: ReactNode }) {
  const session = loadSession();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[200px] shrink-0 flex-col bg-primary px-3 py-6 text-white">
        <div className="mb-8 px-2 text-base font-bold">کافه جاوید</div>
        <nav className="flex flex-1 flex-col gap-1">
          {links
            .filter((link) => !link.owner || session?.role === 'OWNER')
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-sm ${isActive ? 'bg-white font-bold text-ink' : 'text-white/90'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
        </nav>
        <button
          className="mt-4 rounded-full px-3 py-2 text-right text-sm"
          onClick={() => {
            saveSession(null);
            navigate('/login');
          }}
        >
          خروج
        </button>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
