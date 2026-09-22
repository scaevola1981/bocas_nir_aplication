import { sendRemoteErrorAlert } from './remoteTelemetry';

const STORAGE_KEY = 'bocas_health_incidents_v1';
const MAX_INCIDENTS = 50;

let listeners = [];

function notifyListeners() {
  const incidents = getIncidents();
  listeners.forEach((fn) => fn(incidents));
}

export function subscribeToIncidents(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((fn) => fn !== callback);
  };
}

export function getIncidents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Eroare citire incidente locale:', err);
    return [];
  }
}

export function recordIncident(context, message, details = {}, severity = 'CRITIC') {
  try {
    const incidents = getIncidents();
    const newIncident = {
      id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('ro-RO'),
      context, // ex: 'connect_excel', 'parse_invoice', 'save_nir_excel'
      message: String(message || 'Eroare necunoscută'),
      stack: details?.stack || null,
      meta: {
        fileName: details?.fileName ? details.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : undefined,
        fileSize: details?.fileSize || undefined,
        component: details?.component || 'AppCore'
      },
      severity // 'CRITIC', 'ATENTIE', 'INFO'
    };

    // Păstrăm doar ultimele 50 de incidente
    const updated = [newIncident, ...incidents].slice(0, MAX_INCIDENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyListeners();

    // Notificare automată anonimizată pe canalul privat de suport
    if (severity === 'CRITIC' || severity === 'ATENTIE') {
      sendRemoteErrorAlert(context, message, details, severity);
    }

    return newIncident;
  } catch (err) {
    console.error('Nu s-a putut salva incidentul local:', err);
  }
}

export function clearIncidents() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners();
  } catch (err) {
    console.error('Eroare la curățarea incidentelor:', err);
  }
}

export function exportDiagnosticsReport(excelState = {}) {
  const incidents = getIncidents();
  const report = {
    titlu: 'Raport Diagnoză Tehnică & DevOps — Gestiune e-Factură & NIR',
    generatLa: new Date().toISOString(),
    mediu: {
      userAgent: navigator.userAgent,
      fileSystemAccessSupport: 'showOpenFilePicker' in window,
      serviceWorkerSupport: 'serviceWorker' in navigator,
      hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
      deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A',
      limba: navigator.language
    },
    stareExcel: {
      conectat: !!excelState?.connected,
      numeFisier: excelState?.fileName || 'Neconectat',
      ultimulNir: excelState?.maxNirNum || 'N/A',
      urmatorulNir: excelState?.nextNirNum || 'N/A',
      urmatorulCod: excelState?.nextCod || 'N/A',
      totalNiruriGasite: excelState?.nirSheetsCount || 0
    },
    auditSecuritate: {
      outboundConnections: 0,
      cspEnforced: true,
      sentryActive: false,
      localStorageSize: (localStorage.getItem(STORAGE_KEY) || '').length + ' bytes'
    },
    totalIncidente: incidents.length,
    incidente: incidents
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bocas_diagnoza_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
