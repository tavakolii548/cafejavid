import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api';
import { PREVIEW_MODE, previewSession } from '../preview';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (PREVIEW_MODE) {
        saveSession(previewSession);
        navigate('/');
        return;
      }
      const data = await api<{
        accessToken: string;
        refreshToken: string;
        staff: { username: string; role: 'OWNER' | 'STAFF' };
      }>('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.staff.role,
        username: data.staff.username,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود');
    }
  }

  function enterPreview() {
    saveSession(previewSession);
    navigate('/');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 480px at 85% 10%, rgba(242,181,90,0.28), transparent 55%), radial-gradient(700px 420px at 10% 80%, rgba(30,77,58,0.22), transparent 50%), linear-gradient(165deg, #f7f9f5, #e8efe9)',
        }}
        aria-hidden
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-[24px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_60px_rgba(23,37,30,0.12)] backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-bold text-accent">ج</div>
          <h1 className="text-[1.45rem] font-bold text-ink">کافه جاوید</h1>
          <p className="mt-1 text-sm text-muted">ورود کارکنان</p>
        </div>
        {PREVIEW_MODE ? (
          <p className="mb-4 rounded-2xl border border-accent/30 bg-sand px-3 py-2 text-sm text-muted">
            حالت نمایشی فعال است؛ بدون سرور می‌توانی همه صفحات را ببینی.
          </p>
        ) : null}
        <label className="mb-2 block text-sm text-muted">نام کاربری</label>
        <input
          className="mb-4 h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="mb-2 block text-sm text-muted">رمز عبور</label>
        <input
          className="mb-4 h-12 w-full rounded-btn border border-line bg-white px-3 outline-none transition focus:border-primary"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
        <button className="h-14 w-full rounded-btn bg-primary text-base font-bold text-white transition hover:brightness-110" type="submit">
          ورود
        </button>
        {PREVIEW_MODE ? (
          <button
            className="mt-3 h-12 w-full rounded-btn border border-line text-sm font-bold transition hover:bg-tint/50"
            type="button"
            onClick={enterPreview}
          >
            ورود نمایشی به پنل
          </button>
        ) : null}
      </form>
    </main>
  );
}
