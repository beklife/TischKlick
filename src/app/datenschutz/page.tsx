export const metadata = {title: 'Datenschutzerklärung – TischKlick'};

// PLATZHALTER in eckigen Klammern vor dem Livegang durch echte Angaben ersetzen.
export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 leading-relaxed">
      <h1 className="text-3xl font-semibold">Datenschutzerklärung</h1>

      <h2 className="mt-8 text-xl font-medium">1. Verantwortlicher</h2>
      <p className="mt-3">
        [VOR- UND NACHNAME / FIRMA], [ANSCHRIFT], E-Mail: [E-MAIL-ADRESSE]
      </p>

      <h2 className="mt-8 text-xl font-medium">2. Feedback über Tisch-Karten (Gäste)</h2>
      <p className="mt-3">
        Wenn Sie über eine NFC-Karte oder einen QR-Code eine Bewertungsseite aufrufen, verarbeiten
        wir keine personenbezogenen Daten. Es werden keine Cookies gesetzt, keine IP-Adressen und
        keine Geräteinformationen gespeichert. Gespeichert wird lediglich, dass an einem Tisch zu
        einem Zeitpunkt eine Bewertungsseite geöffnet und ggf. eine Bewertung abgegeben wurde.
      </p>
      <p className="mt-3">
        Geben Sie freiwillig Kontaktdaten im Feedback-Formular an, werden diese ausschließlich an
        den jeweiligen Gastronomiebetrieb übermittelt, damit dieser Ihnen antworten kann
        (Art. 6 Abs. 1 lit. a DSGVO). Sie können die Löschung jederzeit beim Betrieb oder bei uns
        verlangen.
      </p>

      <h2 className="mt-8 text-xl font-medium">3. Weiterleitung zu Google</h2>
      <p className="mt-3">
        Entscheiden Sie sich, eine Google-Bewertung abzugeben, werden Sie zu Google (Google Ireland
        Limited) weitergeleitet. Ab diesem Zeitpunkt gilt die Datenschutzerklärung von Google.
      </p>

      <h2 className="mt-8 text-xl font-medium">4. Konten für Gastronomiebetriebe</h2>
      <p className="mt-3">
        Für registrierte Betriebe verarbeiten wir E-Mail-Adresse und Passwort (verschlüsselt) zur
        Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Es werden ausschließlich technisch
        notwendige Cookies für die Anmeldung verwendet.
      </p>

      <h2 className="mt-8 text-xl font-medium">5. Hosting</h2>
      <p className="mt-3">
        Diese Website wird bei Vercel (Region Frankfurt) gehostet; Daten werden bei Supabase
        (Region Frankfurt, EU) gespeichert. Mit beiden Anbietern bestehen
        Auftragsverarbeitungsverträge.
      </p>

      <h2 className="mt-8 text-xl font-medium">6. Ihre Rechte</h2>
      <p className="mt-3">
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch sowie ein Beschwerderecht bei einer
        Datenschutz-Aufsichtsbehörde.
      </p>
    </main>
  );
}
