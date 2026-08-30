export const metadata = {title: 'Impressum – TischKlick'};

// PLATZHALTER in eckigen Klammern vor dem Livegang durch echte Angaben ersetzen.
export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 text-[0.9375rem] leading-relaxed text-ash">
      <h1 className="display text-[2.2rem]">Impressum</h1>
      <h2 className="mt-10 display-tight text-lg text-chalk">Angaben gemäß § 5 DDG</h2>
      <p className="mt-3">
        [VOR- UND NACHNAME / FIRMA]<br />
        [STRASSE UND HAUSNUMMER]<br />
        [PLZ UND ORT]<br />
        Deutschland
      </p>
      <h2 className="mt-10 display-tight text-lg text-chalk">Kontakt</h2>
      <p className="mt-3">
        E-Mail: [E-MAIL-ADRESSE]<br />
        Telefon: [TELEFONNUMMER]
      </p>
      <h2 className="mt-10 display-tight text-lg text-chalk">Umsatzsteuer-ID</h2>
      <p className="mt-3">[USt-IdNr. FALLS VORHANDEN, SONST ABSCHNITT ENTFERNEN]</p>
      <h2 className="mt-10 display-tight text-lg text-chalk">Verantwortlich für den Inhalt</h2>
      <p className="mt-3">[VOR- UND NACHNAME, ANSCHRIFT WIE OBEN]</p>
    </main>
  );
}
