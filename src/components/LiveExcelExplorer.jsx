import React, { useState, useRef, useEffect } from 'react';
import { Table, Eye, CheckCircle2, ChevronRight, Download, ChevronDown, Check } from 'lucide-react';
import styles from './LiveExcelExplorer.module.css';

export function LiveExcelExplorer({ excelState, onDownloadExcel, activeTab: externalActiveTab, onTabChange }) {
  const [internalTab, setInternalTab] = useState('Gestiune');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalTab;
  const setActiveTab = onTabChange || setInternalTab;
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
    }
    if (historyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [historyOpen]);

  if (!excelState.connected || !excelState.workbook) return null;

  const currentSheet = excelState.workbook.getWorksheet(activeTab) || excelState.workbook.getWorksheet('Gestiune');

  // Extract sheet rows
  const rowsData = [];
  if (currentSheet) {
    currentSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Limit to columns 1 to 16
      const cells = [];
      for (let c = 1; c <= 16; c++) {
        const cell = row.getCell(c);
        let val = cell.value;
        if (typeof val === 'object' && val !== null) {
          val = val.result !== undefined ? val.result : (val.formula ? `=${val.formula}` : '');
        }
        cells.push(val !== null && val !== undefined ? String(val) : '');
      }
      rowsData.push({ rowNumber, cells });
    });
  }

  // If viewing Gestiune, focus on recent rows by default or show all
  const isGestiune = activeTab === 'Gestiune';

  return (
    <section className={styles.container} id="live-excel-explorer">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <Table size={20} color="var(--primary)" />
          </div>
          <div>
            <h3 className={styles.title}>Explorator Excel Live (Conținutul Fișierului de pe Desktop)</h3>
            <p className={styles.sub}>
              Vizualizează în timp real datele din <strong>{excelState.fileName}</strong> fără a avea nevoie de programul Excel instalat.
            </p>
          </div>
        </div>

        <button className={styles.downloadBtn} onClick={onDownloadExcel}>
          <Download size={15} /> Descarcă Fișierul (.xlsx)
        </button>
      </div>

      {/* Sheet Tabs Bar: Show Gestiune & Latest NIR only */}
      {(() => {
        const latestNirName = excelState.maxNirNum > 0 ? `Nir ${excelState.maxNirNum}` : null;
        
        // Preluăm NIR-urile anterioare sortate descrescător (cele mai recente primele) și limitate la 10
        const allOlderNir = (excelState.sheetsList || [])
          .filter(name => /^Nir\s*/i.test(name) && name !== latestNirName)
          .sort((a, b) => {
            const numA = parseInt(a.replace(/\D+/g, '') || '0', 10);
            const numB = parseInt(b.replace(/\D+/g, '') || '0', 10);
            return numB - numA;
          });

        const olderNirSheets = allOlderNir.slice(0, 10);
        const hasSelectedOlder = activeTab.startsWith('Nir') && activeTab !== latestNirName;

        return (
          <div className={styles.tabBar}>
            {/* Tab Gestiune */}
            <button
              className={`${styles.tabBtn} ${activeTab === 'Gestiune' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('Gestiune')}
            >
              <span>Gestiune</span>
            </button>

            {/* Tab Ultimul NIR */}
            {latestNirName && (
              <button
                className={`${styles.tabBtn} ${activeTab === latestNirName ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(latestNirName)}
              >
                <span>{latestNirName}</span>
                <span className={styles.latestTag}>ULTIMUL NIR</span>
              </button>
            )}

            {/* Selector dropdown personalizat poziționat exact sub buton (limitat la max 10) */}
            {olderNirSheets.length > 0 && (
              <div className={styles.olderNirContainer} ref={historyRef}>
                <button
                  type="button"
                  className={`${styles.olderNirBtn} ${historyOpen ? styles.olderNirBtnOpen : ''} ${
                    hasSelectedOlder ? styles.olderNirBtnActive : ''
                  }`}
                  onClick={() => setHistoryOpen(prev => !prev)}
                  title="Afișează istoricul celor mai recente 10 NIR-uri arhivate"
                >
                  <span>
                    {hasSelectedOlder ? activeTab : `Istoric NIR-uri (${olderNirSheets.length})`}
                  </span>
                  <ChevronDown size={14} className={`${styles.chevron} ${historyOpen ? styles.chevronOpen : ''}`} />
                </button>

                {historyOpen && (
                  <div className={styles.dropdownMenu}>
                    <div className={styles.dropdownHeader}>
                      Ultimele {olderNirSheets.length} NIR-uri
                    </div>
                    <div className={styles.dropdownList}>
                      {olderNirSheets.map(name => {
                        const isSelected = activeTab === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ''}`}
                            onClick={() => {
                              setActiveTab(name);
                              setHistoryOpen(false);
                            }}
                          >
                            <span>{name}</span>
                            {isSelected && <Check size={14} className={styles.itemCheck} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Sheet Content Viewer */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <tbody>
            {rowsData.map(({ rowNumber, cells }) => {
              // Highlight rows added recently (above 366 in Gestiune)
              const isNewlyAdded = isGestiune && rowNumber >= 367 && cells[0] && !cells[0].includes('Intocmit');
              const isHeader = isGestiune && (rowNumber === 3 || rowNumber === 4);
              const isTotal = isGestiune && cells.some(c => c.includes('SUM') || c.includes('345334') || c.includes('367624'));

              return (
                <tr
                  key={rowNumber}
                  className={`
                    ${isNewlyAdded ? styles.newRow : ''}
                    ${isHeader ? styles.headerRow : ''}
                    ${isTotal ? styles.totalRow : ''}
                  `}
                >
                  <td className={styles.rowNumberCell}>{rowNumber}</td>
                  {cells.map((val, cIdx) => (
                    <td key={cIdx} className={styles.cell} title={val}>
                      {val}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.footerNote}>
        <span className={styles.legendNew}>■ Verde deschis</span>: Rânduri adăugate automat de aplicație în urma testelor tale.
      </div>
    </section>
  );
}
