import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {Archivo, Schibsted_Grotesk} from 'next/font/google';
import './globals.css';

// Display face. The wdth axis is loaded on purpose: headlines are set
// expanded, which is what gives them the signage read.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap'
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'TischKlick',
  description: 'Feedback per Fingertipp'
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="de" className={`${archivo.variable} ${schibsted.variable}`}>
      <body className="min-h-dvh bg-void text-chalk antialiased">
        <div aria-hidden className="grain-layer" />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
