// remoteTelemetry.js - Transmitere anonimizată a alertelor tehnice către canalul privat
// STRICT ZERO-LEAK POLICY: Nu se trimite NICIODATĂ conținut din facturi, CIF, prețuri sau date personale.

const SECRET_TOPIC = 'bocas-errors-7f39c2810a9e4d5882b7194639e7ca01';
const NTFY_URL = `https://ntfy.sh/${SECRET_TOPIC}`;

export function getRemoteAlertTopic() {
  return SECRET_TOPIC;
}

export function getRemoteAlertUrl() {
  return NTFY_URL;
}

// Filtru de securitate: elimină orice posibile date confidențiale din mesajele de eroare
function sanitizeErrorMessage(msg) {
  if (!msg) return 'Eroare nespecificată';
  let clean = String(msg);
  // Elimină coduri fiscale / CIF-uri
  clean = clean.replace(/RO\s*[0-9]{5,10}/gi, 'RO[PROTECTED]');
  // Elimină căi absolute locale care pot conține nume de utilizator
  clean = clean.replace(/\/Users\/[^\/]+\//g, '/Users/***/');
  clean = clean.replace(/C:\\Users\\[^\\]+\\/gi, 'C:\\Users\\***\\');
  // Elimină sume / prețuri posibile
  clean = clean.replace(/[0-9]+[.,][0-9]{2}\s*(RON|LEI|EUR|USD)/gi, '[SUM_PROTECTED]');
  return clean;
}

export async function sendRemoteErrorAlert(context, rawMessage, details = {}, priority = 'high') {
  // STRICT ZERO-LEAK POLICY: Conform AGENTS.md, nicio conexiune externă sau telemetrie nu este permisă.
  // Toate incidentele și diagnosticele rămân exclusiv locale în localHealthStore.
  return;
}
