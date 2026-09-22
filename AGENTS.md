# POLITICĂ STRICTĂ DE SECURITATE ȘI CONFIDENȚIALITATE (ZERO-LEAK POLICY)

Acest document este o directivă obligatorie pentru orice dezvoltator și asistent AI (Antigravity, Claude, Copilot etc.) care lucrează la acest proiect.

---

## 1. Confidentialitatea Datelor Financiare & ale Clienților
- **Nicio conexiune externă de date (Zero Outbound Telemetry)**: Este interzisă trimiterea oricărei informații extrase din facturi (e-Factura XML, PDF), foi de calcul Excel (.xlsx) sau date de identificare firmă (CIF, cont bancar, prețuri, produse) către servicii terțe, API-uri cloud sau servere externe.
- **Procesare 100% Locală (Client-Side Only)**: Toate operațiunile de citire, transformare, validare și scriere în fișiere Excel sau generare NIR trebuie să ruleze exclusiv în memoria locală a dispozitivului clientului (browser / Electron).
- **Fără librării de tracking sau crash-reporting**: Este interzisă instalarea sau reactivarea unor servicii de telemetrie precum Sentry, Google Analytics, Mixpanel, LogRocket etc., care pot intercepta sau transmite conținut din memorie / erori cu date de facturare.

---

## 2. Protecție Strictă a Fișierelor & Git
- **Fără documente reale în Git**: Niciun fișier Excel (`.xlsx`, `.xls`, `.xlsm`), factură (`.xml`, `.pdf`) sau fișier cu date reale ale clienților nu are voie să fie adăugat în repository-ul Git sau împins pe GitHub.
- **Fișiere de test**: Dacă sunt necesare teste, se vor folosi exclusiv fișiere mock cu date fictive (ex. Furnizor Exemplu SRL, 000000).
- **Certificate și Chei**: Nu se comit certificate digitale ANAF (`.p12`, `.pfx`), chei private sau fișiere `.env`.

---

## 3. Resurse și Dependințe Offline
- Toate librăriile și workerii (inclusiv `pdf.worker.min.js`, iconițe, fonturi esențiale) trebuie să fie servite local din proiect (`public/` sau bundle local), fără apeluri către CDN-uri externe (Cloudflare, unpkg, cdnjs).
- Politica Content Security Policy (CSP) din `index.html` trebuie menținută activă, cu `connect-src 'self'` pentru a bloca la nivel de browser orice tentativă de exfiltrare.
