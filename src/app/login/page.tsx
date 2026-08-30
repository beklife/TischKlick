import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {login, register} from './actions';

type Props = {searchParams: Promise<{modus?: string; fehler?: string}>};

export default async function LoginPage({searchParams}: Props) {
  const sp = await searchParams;
  const isRegister = sp.modus === 'registrieren';
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');

  const field =
    'mt-2 w-full rounded-2xl border border-hair bg-shell p-3.5 text-[0.9375rem] text-chalk transition-colors focus:border-flame/60 focus:outline-none';

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute top-8 left-1/2 h-64 w-80 -translate-x-1/2 rounded-full bg-flame/12 blur-[80px]"
      />

      <div className="relative">
        <Link href="/" className="display-tight text-lg">
          {tc('appName')}
          <span className="text-flame">.</span>
        </Link>

        <h1 className="mt-8 display text-[2rem]">
          {isRegister ? t('registerTitle') : t('loginTitle')}
        </h1>

        {sp.fehler ? (
          <p className="mt-5 rounded-2xl border border-berry/40 bg-berry/10 p-3.5 text-sm text-berry">
            {sp.fehler === 'register' ? t('registerFailed') : t('invalidCredentials')}
          </p>
        ) : null}

        <form action={isRegister ? register : login} className="mt-7 space-y-5">
          <div>
            <label htmlFor="email" className="text-sm font-semibold tracking-tight">
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-semibold tracking-tight">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className={field}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-2xl flame-grad flame-glow px-6 py-3.5 font-display text-[0.9375rem] font-bold tracking-tight text-void transition-transform active:scale-[0.98]"
          >
            {isRegister ? t('registerButton') : t('loginButton')}
          </button>
        </form>

        <Link
          href={isRegister ? '/login' : '/login?modus=registrieren'}
          className="mt-7 block text-center text-sm text-ash transition-colors hover:text-chalk"
        >
          {isRegister ? t('switchToLogin') : t('switchToRegister')}
        </Link>
      </div>
    </main>
  );
}
