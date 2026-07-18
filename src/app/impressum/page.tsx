export const metadata = {title: 'Impressum – TischKlick'};

// PLATZHALTER in eckigen Klammern vor dem Livegang durch echte Angaben ersetzen.
export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 leading-relaxed">
      <h1 className="text-3xl font-semibold">Impressum</h1>
      <h2 className="mt-8 text-xl font-medium">Angaben gemäß § 5 DDG</h2>
      <p className="mt-3">
        [VOR- UND NACHNAME / FIRMA]<br />
        [STRASSE UND HAUSNUMMER]<br />
        [PLZ UND ORT]<br />
        Deutschland
      </p>
      <h2 className="mt-8 text-xl font-medium">Kontakt</h2>
      <p className="mt-3">
        E-Mail: [E-MAIL-ADRESSE]<br />
        Telefon: [TELEFONNUMMER]
      </p>
      <h2 className="mt-8 text-xl font-medium">Umsatzsteuer-ID</h2>
      <p className="mt-3">[USt-IdNr. FALLS VORHANDEN, SONST ABSCHNITT ENTFERNEN]</p>
      <h2 className="mt-8 text-xl font-medium">Verantwortlich für den Inhalt</h2>
      <p className="mt-3">[VOR- UND NACHNAME, ANSCHRIFT WIE OBEN]</p>
    </main>
  );
}
