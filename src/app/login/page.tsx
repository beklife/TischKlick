import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {login, register} from './actions';

type Props = {searchParams: Promise<{modus?: string; fehler?: string}>};

export default async function LoginPage({searchParams}: Props) {
  const sp = await searchParams;
  const isRegister = sp.modus === 'registrieren';
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5">
      <h1 className="text-2xl font-semibold">{isRegister ? t('registerTitle') : t('loginTitle')}</h1>
      {sp.fehler ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {sp.fehler === 'register' ? t('registerFailed') : t('invalidCredentials')}
        </p>
      ) : null}
      <form action={isRegister ? register : login} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">{t('email')}</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            className="mt-1 w-full rounded-xl border border-line bg-card p-3" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">{t('password')}</label>
          <input id="password" name="password" type="password" required minLength={8}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            className="mt-1 w-full rounded-xl border border-line bg-card p-3" />
        </div>
        <button type="submit"
          className="w-full rounded-2xl bg-terra px-6 py-3 font-semibold text-white active:bg-terra-dark">
          {isRegister ? t('registerButton') : t('loginButton')}
        </button>
      </form>
      <Link href={isRegister ? '/login' : '/login?modus=registrieren'}
        className="mt-6 text-center text-sm text-muted underline">
        {isRegister ? t('switchToLogin') : t('switchToRegister')}
      </Link>
    </main>
  );
}
