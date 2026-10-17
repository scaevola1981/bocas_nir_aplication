import React from 'react';
import { CheckCircle2, FileSpreadsheet, X, Download } from 'lucide-react';
import styles from './SuccessBanner.module.css';

export function SuccessBanner({ result, onDismiss }) {
  if (!result) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <div className={styles.iconCircle}>
          <CheckCircle2 size={24} color="#16a34a" />
        </div>
        <div>
          <h3 className={styles.title}>
            {result.title || `${result.nirSheetName} a fost adăugat cu succes în Excel!`}
          </h3>
          <p className={styles.details}>
            {result.customMessage ? (
              result.customMessage
            ) : (
              <>
                S-au înregistrat <strong>{result.itemsAdded} produse</strong> în foaia <code>Gestiune</code> cu codurile <strong>{result.firstCod} - {result.lastCod}</strong> (Cod NIR: <code>{result.nirGestiuneCode}</code>).
              </>
            )}
          </p>
          <span className={styles.savedLocation}>
            {result.savedInPlace
              ? `✓ Modificările au fost salvate direct în fișierul original pe PC.`
              : `✓ Fișierul actualizat a fost descărcat: ${result.fileName}`}
          </span>
        </div>
      </div>

      <button className={styles.closeBtn} onClick={onDismiss} title="Închide">
        <X size={18} />
      </button>
    </div>
  );
}
