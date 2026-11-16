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
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-card border border-line bg-white p-8">
        <h1 className="mb-6 text-center text-[22px] font-bold">ورود کارکنان</h1>
        {PREVIEW_MODE ? (
          <p className="mb-4 rounded-btn bg-sand px-3 py-2 text-sm text-muted">
            حالت نمایشی فعال است؛ بدون سرور می‌توانی همه صفحات را ببینی.
          </p>
        ) : null}
        <label className="mb-2 block text-sm text-muted">نام کاربری</label>
        <input className="mb-4 h-12 w-full rounded-btn border border-line px-3" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label className="mb-2 block text-sm text-muted">رمز عبور</label>
        <input className="mb-4 h-12 w-full rounded-btn border border-line px-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="mb-3 text-sm text-primary">{error}</p> : null}
        <button className="h-14 w-full rounded-btn bg-primary text-base font-bold text-white" type="submit">
          ورود
        </button>
        {PREVIEW_MODE ? (
          <button className="mt-3 h-12 w-full rounded-btn border border-line text-sm font-bold" type="button" onClick={enterPreview}>
            ورود نمایشی به پنل
          </button>
        ) : null}
      </form>
    </main>
  );
}
