import React, { useState } from 'react';
import { FolderOpen, RefreshCw, Eye, Layers, Table } from 'lucide-react';
import styles from './ExcelConnector.module.css';

export function ExcelConnector({
  excelState,
  onConnectExcel,
  onDownloadExcel,
  onViewSheet,
  onViewGestiune,
  loading,
  error
}) {
  const [showAllSheets, setShowAllSheets] = useState(false);

  return (
    <section className={styles.card}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.heading}>Pasul 1: Conectează Registrul Excel</h2>
          <p className={styles.description}>
            Aplicația citește șablonul NIR și tab-ul <code>Gestiune</code> pentru a aloca automat următorul număr de NIR și următoarele coduri.
          </p>
        </div>

        {excelState.connected && (
          <div className={styles.topActions}>
            <button
              className={styles.connectBtn}
              onClick={onConnectExcel}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className={styles.spinner} size={18} />
              ) : (
                <FolderOpen size={18} />
              )}
              Schimbă / Reîncarcă Fișierul
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span>{error}</span>
        </div>
      )}

      {!excelState.connected ? (
        <div className={styles.emptyPromptCard} onClick={onConnectExcel} title="Click pentru a alege fișierul Excel de pe calculator">
          <div className={styles.emptyPromptIcon}>
            <FolderOpen size={32} color="#0284c7" />
          </div>
          <div className={styles.emptyPromptText}>
            <h3 className={styles.emptyPromptTitle}>Niciun registru conectat momentan</h3>
            <p className={styles.emptyPromptSub}>
              Apasă aici pentru a alege fișierul Excel de gestiune din calculatorul tău (indiferent cum se numește fișierul).
            </p>
          </div>
          <button type="button" className={styles.emptyActionBtn} disabled={loading}>
            {loading ? <RefreshCw className={styles.spinner} size={16} /> : <FolderOpen size={16} />}
            <span>{loading ? 'Se analizează...' : 'Alege Fișierul Excel (.xlsx)'}</span>
          </button>
        </div>
      ) : (
        <>
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Fișier activ pe disc</span>
              <span className={styles.detailValue}>{excelState.fileName}</span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Luna / Anul</span>
              <span className={styles.detailValue}>{excelState.monthStr} {excelState.yearStr}</span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Ultimul NIR înregistrat</span>
              <span className={styles.detailValue}>
                NIR {excelState.maxNirNum} <small className={styles.nextNote}>(Următorul: {excelState.nextNirNum})</small>
              </span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Ultimul Cod în Gestiune</span>
              <span className={styles.detailValue}>
                {excelState.maxCod} <small className={styles.nextNote}>(Următorul: {excelState.nextCod})</small>
              </span>
            </div>
          </div>

          {/* Sheets List & Quick View: Show Gestiune and populated NIRs */}
          {excelState.sheetsList && excelState.sheetsList.length > 0 && (() => {
            const isNirSheet = (name) => /^(?:Nir\s*)?[0-9]+$/i.test(String(name).trim());
            const latestNirName = excelState.lastNirSheetName || (excelState.maxNirNum > 0 ? (excelState.sheetsList.includes(String(excelState.maxNirNum)) ? String(excelState.maxNirNum) : `Nir ${excelState.maxNirNum}`) : null);

            // Selectăm doar NIR-urile populate efectiv cu facturi
            const populatedSheetNames = (excelState.existingInvoices || []).map(inv => inv.sheetName);
            const olderNirSheets = (excelState.sheetsList || [])
              .filter(name => isNirSheet(name) && name !== latestNirName && (populatedSheetNames.length === 0 || populatedSheetNames.includes(name)))
              .sort((a, b) => {
                const numA = parseInt(String(a).replace(/\D+/g, '') || '0', 10);
                const numB = parseInt(String(b).replace(/\D+/g, '') || '0', 10);
                return numB - numA;
              })
              .slice(0, 10);

            const latestNirDisplay = excelState.maxNirNum > 0 ? `NIR ${excelState.maxNirNum}` : latestNirName;
            const gestiuneLabel = excelState.gestiuneSheetName === 'G' ? 'Gestiune (G)' : (excelState.gestiuneSheetName || 'Gestiune');

            return (
              <div className={styles.sheetsRow}>
                <span className={styles.sheetsLabel}>
                  <Layers size={15} /> Foi prezente în Excel:
                </span>
                <div className={styles.sheetsChips}>
                  {/* Foaia Gestiune - Navighează la tabelul live de gestiune */}
                  <button
                    type="button"
                    className={`${styles.sheetChip} ${styles.sheetGestiune}`}
                    onClick={() => {
                      if (onViewGestiune) onViewGestiune();
                      const el = document.getElementById('live-excel-explorer');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    title="Click pentru a vizualiza foaia Gestiune în tabelul de mai jos"
                  >
                    <span>{gestiuneLabel}</span>
                    <Table size={13} className={styles.eyeIcon} />
                  </button>

                  {/* Doar ultimul NIR încărcat */}
                  {latestNirName && (
                    <button
                      className={`${styles.sheetChip} ${styles.sheetLatest}`}
                      onClick={() => onViewSheet && onViewSheet(latestNirName)}
                      title={`Click pentru a vizualiza ${latestNirDisplay} direct în aplicație`}
                    >
                      <span>{latestNirDisplay}</span>
                      <span className={styles.newDot}>ULTIMUL NIR</span>
                      <Eye size={13} className={styles.eyeIcon} />
                    </button>
                  )}

                  {/* Buton opțional pentru istoric anterior (max 10) */}
                  {olderNirSheets.length > 0 && (
                    <>
                      <button
                        className={styles.toggleOlderBtn}
                        onClick={() => setShowAllSheets(prev => !prev)}
                        title="Comută afișarea ultimelor NIR-uri înregistrate"
                      >
                        {showAllSheets ? 'Ascunde istoricul' : `+ ${olderNirSheets.length} NIR-uri anterioare`}
                      </button>

                      {showAllSheets && olderNirSheets.map((name) => {
                        const nirNum = parseInt(String(name).replace(/\D+/g, '') || '0', 10);
                        const displayName = nirNum > 0 ? `NIR ${nirNum}` : name;
                        return (
                          <button
                            key={name}
                            className={styles.sheetChip}
                            onClick={() => onViewSheet && onViewSheet(name)}
                            title={`Click pentru a vizualiza ${displayName}`}
                          >
                            <span>{displayName}</span>
                            <Eye size={13} className={styles.eyeIcon} />
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}
