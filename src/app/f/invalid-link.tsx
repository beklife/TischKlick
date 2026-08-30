import {getTranslations} from 'next-intl/server';

export async function InvalidLink() {
  const t = await getTranslations('guest');
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-hair bg-shell text-2xl text-ash-2">
        ⃠
      </div>
      <h1 className="mt-5 display-tight text-xl text-balance">{t('invalidTitle')}</h1>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ash text-balance">
        {t('invalidBody')}
      </p>
    </div>
  );
}
