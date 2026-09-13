import React from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import styles from './NirViewModal.module.css';

export function NirViewModal({ nirData, onClose }) {
  if (!nirData) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div className={styles.brandRow}>
            <div className={styles.iconCircle}>
              <FileSpreadsheet size={20} color="#2563eb" />
            </div>
            <div>
              <h2 className={styles.title}>Vizualizare {nirData.sheetName}</h2>
              <p className={styles.sub}>
                Furnizor: <strong>{nirData.supplierName}</strong> • Factura: <strong>{nirData.invoiceNumber}</strong> din <strong>{nirData.invoiceDate}</strong>
              </p>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Denumire Produs</th>
                <th style={{ width: '70px' }}>U/M</th>
                <th style={{ width: '90px' }}>Cantitate</th>
                <th style={{ width: '110px' }}>Preț Unitar</th>
                <th style={{ width: '120px' }}>Valoare fără TVA</th>
                <th style={{ width: '90px' }}>Cod Intrare</th>
              </tr>
            </thead>
            <tbody>
              {nirData.items.map((item, i) => (
                <tr key={i}>
                  <td className={styles.center}>{item.idx || i + 1}</td>
                  <td className={styles.prodName}>{item.name}</td>
                  <td className={styles.center}>{item.um}</td>
                  <td className={styles.right}>{item.quantity}</td>
                  <td className={styles.right}>{Number(item.unitPrice || 0).toFixed(2)}</td>
                  <td className={styles.valRight}>{Number(item.total || 0).toFixed(2)} lei</td>
                  <td className={styles.center}>
                    <span className={styles.codBadge}>{item.cod}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeActionBtn} onClick={onClose}>
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}
