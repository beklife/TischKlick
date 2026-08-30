import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

// Static preview of the guest hub, drawn in markup rather than screenshotted so
// it stays truthful when the real hub changes and costs no image bytes.
function PhonePreview({venue, tagline}: {venue: string; tagline: string}) {
  const rows = [
    {icon: '🍽️', label: 'Speisekarte', primary: false},
    {icon: '⭐', label: 'Bewerten', primary: true},
    {icon: '📸', label: 'Instagram', primary: false},
    {icon: '🌐', label: 'Website', primary: false}
  ];
  return (
    <div className="relative mx-auto w-[17rem] shrink-0">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-flame/20 blur-[60px]"
      />
      <div className="relative rounded-[2.5rem] border border-hair-2 bg-shell p-2.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]">
        <div className="overflow-hidden rounded-[2rem] border border-hair bg-void px-5 pt-9 pb-7">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hair-2 bg-shell-2 display text-sm text-flame">
              CS
            </div>
            <p className="mt-3 display text-lg">{venue}</p>
            <p className="mt-1 text-[0.625rem] leading-snug text-ash">{tagline}</p>
          </div>
          <div className="mt-5 space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2 ${
                  r.primary ? 'flame-grad text-void' : 'border border-hair bg-shell'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-lg text-[0.6875rem] ${
                    r.primary ? 'bg-void/15' : 'bg-shell-2'
                  }`}
                >
                  {r.icon}
                </span>
                <span className="flex-1 text-[0.6875rem] font-semibold">{r.label}</span>
                <span aria-hidden className={r.primary ? 'text-void/55' : 'text-ash-2'}>
                  →
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const tg = await getTranslations('guest');

  const steps = [
    {n: '01', title: t('step1Title'), body: t('step1Body')},
    {n: '02', title: t('step2Title'), body: t('step2Body')},
    {n: '03', title: t('step3Title'), body: t('step3Body')}
  ];

  const features = [
    {title: t('feat1Title'), body: t('feat1Body'), icon: '🍽️'},
    {title: t('feat2Title'), body: t('feat2Body'), icon: '🔗'},
    {title: t('feat3Title'), body: t('feat3Body'), icon: '📊'},
    {title: t('feat4Title'), body: t('feat4Body'), icon: '🔒'}
  ];

  return (
    <div className="relative overflow-x-clip">
      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-hair/70 bg-void/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <span className="display-tight text-lg tracking-tight">
            {tc('appName')}
            <span className="text-flame">.</span>
          </span>
          <Link
            href="/login"
            className="rounded-full border border-hair-2 bg-shell px-4 py-1.5 text-[0.8125rem] font-semibold text-chalk transition-colors hover:border-flame/60 hover:bg-shell-2"
          >
            {t('login')}
          </Link>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative mx-auto max-w-5xl px-5 pt-14 pb-20 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/4 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-flame/15 blur-[90px]"
        />
        <div className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_auto]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hair-2 bg-shell px-3 py-1 text-[0.6875rem] font-medium tracking-wide text-ash">
              <span className="h-1.5 w-1.5 rounded-full bg-zest" />
              {t('badge')}
            </span>

            {/* The claim is the product: the two halves get two voices. */}
            <h1 className="mt-6 display text-[clamp(2.6rem,7vw,4.5rem)] text-balance">
              <span className="block">{t('claimA')}</span>
              <span className="block text-flame">{t('claimB')}</span>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-ash text-balance">
              {t('sub')}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-2xl flame-grad flame-glow px-6 py-3.5 font-display text-[0.9375rem] font-bold tracking-tight text-void transition-transform active:scale-[0.98]"
              >
                {t('ctaSecondary')}
              </Link>
              <a
                href="#weiche"
                className="rounded-2xl border border-hair-2 bg-shell px-6 py-3.5 text-[0.9375rem] font-semibold text-chalk transition-colors hover:border-hair-2 hover:bg-shell-2"
              >
                {t('ctaPrimary')}
              </a>
            </div>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <PhonePreview venue="Café Sonnenhof" tagline="Frisch geröstet, hausgemacht — seit 1998" />
            <p className="mt-5 text-center text-[0.6875rem] text-ash-2">{t('demoNote')}</p>
          </div>
        </div>
      </section>

      {/* ---------- how ---------- */}
      <section className="border-t border-hair">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <p className="eyebrow">{t('howEyebrow')}</p>
          <h2 className="mt-3 display text-[clamp(1.9rem,4.5vw,2.9rem)]">{t('howTitle')}</h2>

          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-3xl panel p-6">
                <span className="display text-3xl text-flame/30">{s.n}</span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ash">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- the split: the actual pitch ---------- */}
      <section id="weiche" className="scroll-mt-16 border-t border-hair bg-shell/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <p className="eyebrow">{t('splitEyebrow')}</p>
          <h2 className="mt-3 display text-[clamp(1.9rem,4.5vw,2.9rem)]">{t('splitTitle')}</h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ash">{t('splitBody')}</p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {/* low */}
            <div className="rounded-3xl border border-hair bg-shell p-7">
              <div aria-hidden className="flex gap-1 text-xl text-ash-2">
                ★★★<span className="text-hair-2">★★</span>
              </div>
              <p className="mt-4 eyebrow">{t('splitLowLabel')}</p>
              <h3 className="mt-2 display-tight text-xl">{t('splitLowTitle')}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ash">{t('splitLowBody')}</p>
              <div className="mt-6 flex items-center gap-2 rounded-2xl border border-hair-2 bg-void px-3.5 py-2.5 text-xs text-ash">
                <span aria-hidden>🔒</span> Ihr Postfach
              </div>
            </div>

            {/* high */}
            <div className="relative overflow-hidden rounded-3xl border border-flame/40 bg-shell p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-flame/20 blur-[50px]"
              />
              <div className="relative">
                <div aria-hidden className="flex gap-1 text-xl text-flame">
                  ★★★★★
                </div>
                <p className="mt-4 eyebrow text-flame">{t('splitHighLabel')}</p>
                <h3 className="mt-2 display-tight text-xl">{t('splitHighTitle')}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ash">{t('splitHighBody')}</p>
                <div className="mt-6 flex items-center gap-2 rounded-2xl flame-grad px-3.5 py-2.5 text-xs font-semibold text-void">
                  <span aria-hidden>→</span> Google-Bewertung
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section className="border-t border-hair">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <p className="eyebrow">{t('featEyebrow')}</p>
          <h2 className="mt-3 display text-[clamp(1.9rem,4.5vw,2.9rem)]">{t('featTitle')}</h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-3xl panel p-6">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-shell-2 text-lg"
                >
                  {f.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ash">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="border-t border-hair">
        <div className="relative mx-auto max-w-5xl overflow-hidden px-5 py-24 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 w-[30rem] rounded-full bg-flame/15 blur-[80px]"
          />
          <div className="relative">
            <h2 className="display text-[clamp(2rem,5vw,3.2rem)] text-balance">{t('finalTitle')}</h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ash text-balance">
              {t('finalBody')}
            </p>
            <Link
              href="/login"
              className="mt-9 inline-block rounded-2xl flame-grad flame-glow px-8 py-4 font-display text-base font-bold tracking-tight text-void transition-transform active:scale-[0.98]"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-ash-2">
          <span className="display-tight text-sm text-ash">
            {tc('appName')}
            <span className="text-flame">.</span>
          </span>
          <div className="flex gap-5">
            <Link href="/datenschutz" className="transition-colors hover:text-ash">
              {tg('footerPrivacy')}
            </Link>
            <Link href="/impressum" className="transition-colors hover:text-ash">
              {tg('footerImpressum')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
