import React, { useState } from 'react';
import { UploadCloud, FileText, FileCode, AlertTriangle, ShieldCheck } from 'lucide-react';
import styles from './DropZone.module.css';

export function DropZone({ onFilesSelected, disabled, processing }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled || processing) return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || processing) return;

    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.pdf') || f.name.endsWith('.xml')
    );

    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pasul 2: Încarcă Factura (PDF sau XML e-Factura)</h2>
        <p className={styles.subtitle}>
          Trage factura descărcată din e-Factura / SmartBill direct în zona de mai jos pentru citire automată.
        </p>
      </div>

      <label
        className={`${styles.dropBox} ${isDragOver ? styles.dragOver : ''} ${disabled ? styles.disabled : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf,.xml"
          multiple
          onChange={handleFileInput}
          disabled={disabled || processing}
          className={styles.hiddenInput}
        />

        <div className={styles.dropContent}>
          <div className={styles.uploadIcon}>
            <UploadCloud size={38} color="var(--primary)" />
          </div>

          <h3 className={styles.dropTitle}>
            {processing ? 'Se procesează factura...' : 'Trage factura aici (Drag & Drop)'}
          </h3>
          <p className={styles.dropText}>
            sau <span className={styles.browseLink}>click pentru a selecta fișierul</span> de pe calculator
          </p>

          <div className={styles.badgesRow}>
            <span className={styles.fileBadge}>
              <FileText size={14} /> Factură PDF (SmartBill / SPV)
            </span>
            <span className={styles.fileBadge}>
              <FileCode size={14} /> Factură XML (e-Factura UBL)
            </span>
            <span className={styles.securityBadge}>
              <ShieldCheck size={14} color="#16a34a" /> Protecție anti-duplicat activă (verificare număr factură)
            </span>
          </div>

          {disabled && (
            <div className={styles.warningNote}>
              <AlertTriangle size={16} />
              <span>Conectează mai întâi fișierul Excel de gestiune la Pasul 1.</span>
            </div>
          )}
        </div>
      </label>
    </section>
  );
}
