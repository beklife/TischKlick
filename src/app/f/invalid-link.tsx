import {getTranslations} from 'next-intl/server';

export async function InvalidLink() {
  const t = await getTranslations('guest');
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold">{t('invalidTitle')}</h1>
      <p className="mt-3 text-muted">{t('invalidBody')}</p>
    </div>
  );
}
