import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import './globals.css';

export const metadata: Metadata = {
  title: 'TischKlick',
  description: 'Feedback per Fingertipp'
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="de">
      <body className="min-h-dvh bg-cream text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
