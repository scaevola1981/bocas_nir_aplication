import React, { useState } from 'react';
import { CheckSquare, Square, Trash2, Send, X, AlertCircle, Info, Edit3, ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import styles from './NirReviewModal.module.css';

export function NirReviewModal({
  invoiceData,
  excelState,
  onItemToggle,
  onItemDelete,
  onItemChange,
  onConfirm,
  onCancel,
  saving
}) {
  const [forceDuplicate, setForceDuplicate] = useState(false);

  if (!invoiceData) return null;

  const validItems = invoiceData.items.filter(i => i.selected);
  const totalNIR = validItems.reduce((acc, curr) => acc + (curr.totalWithoutVat || 0), 0);
  const isDuplicate = Boolean(invoiceData.duplicateWarning?.isDuplicate);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.badgeRow}>
              <span className={styles.nirBadge}>Se va crea: Nir {excelState.nextNirNum}</span>
              <span className={styles.metaBadge}>Cod NIR: 2608{String(excelState.nextNirNum).padStart(2, '0')}</span>
              {isDuplicate && (
                <span className={styles.dupBadge}>
                  <ShieldAlert size={14} /> DUPLICAT DETECTAT
                </span>
              )}
            </div>
            <h2 className={styles.modalTitle}>Verificare și Filtrare NIR înainte de trimitere în Excel</h2>
            <p className={styles.modalSubtitle}>
              Factura <strong>{invoiceData.invoiceNumber}</strong> din <strong>{invoiceData.invoiceDate}</strong> de la <strong>{invoiceData.supplierName}</strong>
            </p>
          </div>

          <button className={styles.closeBtn} onClick={onCancel} disabled={saving}>
            <X size={20} />
          </button>
        </div>

        {/* Duplicate Warning Banner if invoice already exists */}
        {isDuplicate && (
          <div className={styles.duplicateAlert}>
            <div className={styles.dupIcon}>
              <ShieldAlert size={32} color="#dc2626" />
            </div>
            <div className={styles.dupContent}>
              <h4 className={styles.dupTitle}>🛡️ SIGURANȚĂ ACTIVATĂ: FACTURĂ DEJA ÎNREGISTRATĂ!</h4>
              <p className={styles.dupText}>
                Factura cu numărul <strong>{invoiceData.invoiceNumber}</strong> figurează deja asociată în fișierul Excel în foaia <strong>{invoiceData.duplicateWarning.existingSheet}</strong>
                {invoiceData.duplicateWarning.existingNumber && invoiceData.duplicateWarning.existingNumber !== invoiceData.invoiceNumber ? ` (factură existentă pe foaie: "${invoiceData.duplicateWarning.existingNumber}")` : ''}
                {invoiceData.duplicateWarning.existingSupplier ? ` (Furnizor: ${invoiceData.duplicateWarning.existingSupplier})` : ''}
                {invoiceData.duplicateWarning.existingDate ? ` din data de ${invoiceData.duplicateWarning.existingDate}` : ''}.
              </p>
              <p className={styles.dupExplanation}>
                Sistemul a blocat automat adăugarea pentru a preveni dublarea accidentală a stocurilor în <code>Gestiune</code>. Dacă este o eroare umană de re-introducere a aceleiași facturi, apăsați <strong>Renunță</strong>.
              </p>
              <div className={styles.forceUnlockArea}>
                <label className={styles.forceCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={forceDuplicate}
                    onChange={(e) => setForceDuplicate(e.target.checked)}
                  />
                  <span>Sunt sigur că doresc forțarea acestei facturi chiar dacă are același număr</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Guidance Notice */}
        <div className={styles.noticeBox}>
          <Info size={18} color="var(--primary)" />
          <div>
            <strong>Filtru contabilitate:</strong> Debifează sau șterge articolele care sunt consumabile (pungi, pietre de polizor, taxe etc.) și nu merg în fișa de stoc. Doar produsele bifate vor fi adăugate în <code>Gestiune</code>.
          </div>
        </div>

        {/* Items Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Inclus</th>
                <th style={{ width: '40px' }}>#</th>
                <th>Denumire Produs (Editează dacă dorești)</th>
                <th style={{ width: '75px' }}>U/M</th>
                <th style={{ width: '90px' }}>Cantitate</th>
                <th style={{ width: '110px' }}>Preț Unitar</th>
                <th style={{ width: '120px' }}>Valoare fără TVA</th>
                <th style={{ width: '95px' }}>Cod Atribuit</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, idx) => {
                const assignedCod = excelState.nextCod + idx;
                return (
                  <tr key={item.id} className={item.selected ? styles.rowSelected : styles.rowExcluded}>
                    <td className={styles.centerCell}>
                      <button
                        className={styles.checkBtn}
                        onClick={() => onItemToggle(item.id)}
                        disabled={saving}
                        title={item.selected ? 'Exclude din NIR' : 'Include în NIR'}
                      >
                        {item.selected ? (
                          <CheckSquare size={19} color="var(--primary)" />
                        ) : (
                          <Square size={19} color="#94a3b8" />
                        )}
                      </button>
                    </td>
                    <td className={styles.centerCell}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        className={styles.nameInput}
                        value={item.name}
                        onChange={(e) => onItemChange(item.id, 'name', e.target.value)}
                        disabled={!item.selected || saving}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={styles.smallInput}
                        value={item.um}
                        onChange={(e) => onItemChange(item.id, 'um', e.target.value)}
                        disabled={!item.selected || saving}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        className={styles.numInput}
                        value={item.quantity}
                        onChange={(e) => onItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={!item.selected || saving}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        className={styles.numInput}
                        value={item.unitPrice}
                        onChange={(e) => onItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        disabled={!item.selected || saving}
                      />
                    </td>
                    <td className={styles.valCell}>
                      {Number(item.totalWithoutVat !== undefined ? item.totalWithoutVat : (item.quantity * item.unitPrice)).toFixed(2)} lei
                    </td>
                    <td className={styles.centerCell}>
                      <span className={styles.codBadge}>{assignedCod}</span>
                    </td>
                    <td className={styles.centerCell}>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => onItemDelete(item.id)}
                        disabled={saving}
                        title="Șterge rândul"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.summaryBox}>
            <span className={styles.summaryLabel}>Total produse incluse în NIR:</span>
            <strong className={styles.summaryCount}>{validItems.length} articole</strong>
            <span className={styles.summaryDivider}>•</span>
            <span className={styles.summaryLabel}>Valoare totală fără TVA:</span>
            <strong className={styles.summaryTotal}>{totalNIR.toFixed(2)} RON</strong>
          </div>

          <div className={styles.actionButtons}>
            <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
              Renunță
            </button>
            <button
              className={isDuplicate && !forceDuplicate ? styles.blockedBtn : (isDuplicate && forceDuplicate ? styles.forceSubmitBtn : styles.submitBtn)}
              onClick={() => onConfirm(forceDuplicate)}
              disabled={validItems.length === 0 || saving || (isDuplicate && !forceDuplicate)}
            >
              {isDuplicate && !forceDuplicate ? (
                <>
                  <Lock size={18} />
                  <span>Factură Duplicat (Blocat)</span>
                </>
              ) : isDuplicate && forceDuplicate ? (
                <>
                  <AlertTriangle size={18} />
                  <span>Forțează Adăugarea Duplicatului (Nir {excelState.nextNirNum})</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>{saving ? 'Se scrie în Excel...' : `Trimite în Excel (Generează Nir ${excelState.nextNirNum})`}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
