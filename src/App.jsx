import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ExcelConnector } from './components/ExcelConnector';
import { DropZone } from './components/DropZone';
import { NirReviewModal } from './components/NirReviewModal';
import { SuccessBanner } from './components/SuccessBanner';
import { openLocalExcelFile, saveExcelFile, fetchDefaultExcelFile } from './services/fileSystem';
import { analyzeExcelWorkbook, processInvoiceIntoExcel, getNirSheetContent, checkInvoiceDuplicate } from './services/excelEngine';
import { NirViewModal } from './components/NirViewModal';
import { LiveExcelExplorer } from './components/LiveExcelExplorer';
import { InstructionsModal } from './components/InstructionsModal';
import { parseInvoicePdf } from './services/pdfParser';
import { parseInvoiceXml } from './services/xmlParser';
import { Info, HelpCircle } from 'lucide-react';
import styles from './App.module.css';

export function App() {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [excelState, setExcelState] = useState({
    connected: false,
    fileName: '',
    workbook: null,
    fileHandle: null,
    isLocalApi: false,
    sheetsList: [],
    existingInvoices: [],
    maxNirNum: 0,
    nextNirNum: 1,
    maxCod: 0,
    nextCod: 1,
    lastGestiuneRow: 4,
    monthStr: 'AUGUST',
    yearStr: '2026'
  });

  const [loadingExcel, setLoadingExcel] = useState(false);
  const [excelError, setExcelError] = useState('');

  const [processingInvoice, setProcessingInvoice] = useState(false);
  const [currentReviewInvoice, setCurrentReviewInvoice] = useState(null);
  const [invoiceQueue, setInvoiceQueue] = useState([]);
  const [savingNir, setSavingNir] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [inspectedNir, setInspectedNir] = useState(null);

  // Clientul își alege singur fișierul Excel la prima utilizare prin butonul de conectare.
  // Nu se mai forțează automat niciun fișier predefinit pe ecran.

  // 1. Connect Local Excel File
  const handleConnectExcel = async () => {
    setLoadingExcel(true);
    setExcelError('');
    try {
      const fileData = await openLocalExcelFile();
      if (!fileData) {
        setLoadingExcel(false);
        return;
      }

      const analysis = await analyzeExcelWorkbook(fileData.buffer);
      setExcelState({
        connected: true,
        fileName: fileData.fileName,
        workbook: analysis.workbook,
        fileHandle: fileData.handle,
        isNativeHandle: fileData.isNativeHandle,
        sheetsList: analysis.sheetsList,
        existingInvoices: analysis.existingInvoices,
        maxNirNum: analysis.maxNirNum,
        nextNirNum: analysis.nextNirNum,
        maxCod: analysis.maxCod,
        nextCod: analysis.nextCod,
        lastGestiuneRow: analysis.lastGestiuneRow,
        monthStr: analysis.monthStr,
        yearStr: analysis.yearStr
      });
      setSuccessResult(null);
    } catch (err) {
      console.error(err);
      setExcelError(`Eroare la deschiderea fișierului Excel: ${err.message}`);
    } finally {
      setLoadingExcel(false);
    }
  };

  // 2. Handle Invoices Dropped
  const handleFilesSelected = async (files) => {
    if (!excelState.connected) {
      setErrorMsg('Te rugăm să conectezi mai întâi registrul Excel de gestiune la Pasul 1.');
      return;
    }

    setProcessingInvoice(true);
    setErrorMsg('');
    const parsedList = [];
    const allInvoicesToCheck = [...(excelState.existingInvoices || [])];

    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        let parsedData = null;

        if (file.name.toLowerCase().endsWith('.xml')) {
          const text = new TextDecoder('utf-8').decode(buffer);
          parsedData = parseInvoiceXml(text);
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          parsedData = await parseInvoicePdf(buffer);
        }

        if (parsedData) {
          parsedData.originalFileName = file.name;
          // Duplicate verification against existing NIR sheets and earlier files in this batch (by number & products):
          const dupCheck = checkInvoiceDuplicate(
            allInvoicesToCheck,
            parsedData.invoiceNumber,
            parsedData.supplierName,
            parsedData.items
          );
          parsedData.duplicateWarning = dupCheck;
          parsedList.push(parsedData);

          // Add to tracked invoices so duplicates within the same batch are also caught
          allInvoicesToCheck.push({
            sheetName: `Lotul curent (${file.name})`,
            invoiceNumber: parsedData.invoiceNumber,
            supplierName: parsedData.supplierName,
            invoiceDate: parsedData.invoiceDate,
            items: parsedData.items
          });
        }
      }

      if (parsedList.length > 0) {
        // Open first invoice in review modal, queue the rest
        setCurrentReviewInvoice(parsedList[0]);
        setInvoiceQueue(parsedList.slice(1));
      } else {
        setErrorMsg('Nu s-au putut extrage date din fișierele încărcate.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`Eroare la citirea facturii: ${err.message}`);
    } finally {
      setProcessingInvoice(false);
    }
  };

  // 3. Review Modal Item Actions
  const handleItemToggle = (itemId) => {
    if (!currentReviewInvoice) return;
    setCurrentReviewInvoice(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    }));
  };

  const handleItemDelete = (itemId) => {
    if (!currentReviewInvoice) return;
    setCurrentReviewInvoice(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleItemChange = (itemId, field, value) => {
    if (!currentReviewInvoice) return;
    setCurrentReviewInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.totalWithoutVat = Number((updated.quantity * updated.unitPrice).toFixed(4));
          }
          return updated;
        }
        return item;
      })
    }));
  };

  // 4. Confirm & Write to Excel
  const handleConfirmNir = async (forceDuplicate = false) => {
    if (!currentReviewInvoice || !excelState.workbook) return;

    setSavingNir(true);
    setErrorMsg('');

    try {
      const invoicePayload = {
        ...currentReviewInvoice,
        forceDuplicate: Boolean(forceDuplicate)
      };

      // 1. Append NIR and update Gestiune
      const result = await processInvoiceIntoExcel(excelState.workbook, invoicePayload);

      // 2. Save file on disk (in-place or download)
      const saveResult = await saveExcelFile(excelState.workbook, {
        handle: excelState.fileHandle,
        fileName: excelState.fileName,
        isLocalApi: excelState.isLocalApi
      });

      // 3. Re-analyze workbook to increment NIR counter and Cod counter for subsequent invoices
      const reAnalysis = await analyzeExcelWorkbook(await excelState.workbook.xlsx.writeBuffer());
      setExcelState(prev => ({
        ...prev,
        sheetsList: reAnalysis.sheetsList,
        existingInvoices: reAnalysis.existingInvoices,
        maxNirNum: reAnalysis.maxNirNum,
        nextNirNum: reAnalysis.nextNirNum,
        maxCod: reAnalysis.maxCod,
        nextCod: reAnalysis.nextCod,
        lastGestiuneRow: reAnalysis.lastGestiuneRow
      }));

      setSuccessResult({
        ...result,
        ...saveResult
      });

      // Advance to next queued invoice if any
      if (invoiceQueue.length > 0) {
        setCurrentReviewInvoice(invoiceQueue[0]);
        setInvoiceQueue(prev => prev.slice(1));
      } else {
        setCurrentReviewInvoice(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`Eroare la scrierea în Excel: ${err.message}`);
    } finally {
      setSavingNir(false);
    }
  };

  const handleCancelReview = () => {
    setCurrentReviewInvoice(null);
    setInvoiceQueue([]);
  };

  const handleDownloadExcel = async () => {
    if (!excelState.workbook) return;
    const buffer = await excelState.workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = excelState.fileName || 'Registru_Gestiune.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewSheet = (sheetName) => {
    if (!excelState.workbook) return;
    const nirData = getNirSheetContent(excelState.workbook, sheetName);
    setInspectedNir(nirData);
  };

  return (
    <div className={styles.appWrapper}>
      <Header
        excelConnected={excelState.connected}
        excelFileName={excelState.fileName}
        nextNir={excelState.nextNirNum}
        nextCod={excelState.nextCod}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      <main className={styles.mainContent}>
        <SuccessBanner
          result={successResult}
          onDismiss={() => setSuccessResult(null)}
        />

        {errorMsg && (
          <div className={styles.errorBanner}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')}>✕</button>
          </div>
        )}

        <ExcelConnector
          excelState={excelState}
          onConnectExcel={handleConnectExcel}
          onDownloadExcel={handleDownloadExcel}
          onViewSheet={handleViewSheet}
          loading={loadingExcel}
          error={excelError}
        />

        <DropZone
          onFilesSelected={handleFilesSelected}
          disabled={!excelState.connected}
          processing={processingInvoice}
        />

        {/* Quick Instructions Card - Apare DOAR pana cand clientul conecteaza Excel-ul */}
        {!excelState.connected && (
          <section className={styles.helpCard}>
            <div className={styles.helpIcon}>
              <HelpCircle size={22} color="var(--primary)" />
            </div>
            <div>
              <h4 className={styles.helpTitle}>Cum funcționează?</h4>
              <ol className={styles.helpList}>
                <li>La <strong>Pasul 1</strong>, alegi fișierul Excel de gestiune din calculatorul tău (apeși butonul <em>Alege Fișierul Excel</em>). Poți apăsa pe oricare NIR din listă pentru a-l vizualiza sau descărca direct.</li>
                <li>La <strong>Pasul 2</strong>, tragi factura proaspăt descărcată (PDF sau XML e-Factura).</li>
                <li>Aplicația deschide automat ecranul de <strong>Verificare NIR</strong>. Debifezi consumabilele (pungi, pietre polizor) care nu merg pe stoc.</li>
                <li>Apeși <strong>„Trimite în Excel”</strong> → fișierul se actualizează instant pe calculator cu noul tab de NIR și rândurile din Gestiune.</li>
              </ol>
            </div>
          </section>
        )}

        {/* Live Excel Explorer to view Gestiune and all NIRs without needing Excel installed */}
        <LiveExcelExplorer
          excelState={excelState}
          onDownloadExcel={handleDownloadExcel}
        />
      </main>

      {/* Review & Edit Modal for incoming invoice */}
      {currentReviewInvoice && (
        <NirReviewModal
          invoiceData={currentReviewInvoice}
          excelState={excelState}
          onItemToggle={handleItemToggle}
          onItemDelete={handleItemDelete}
          onItemChange={handleItemChange}
          onConfirm={handleConfirmNir}
          onCancel={handleCancelReview}
          saving={savingNir}
        />
      )}

      {/* Inspector Modal for existing NIR sheets in Excel */}
      {inspectedNir && (
        <NirViewModal
          nirData={inspectedNir}
          onClose={() => setInspectedNir(null)}
        />
      )}

      {/* Ghid de Utilizare & Modal de Ajutor cu butonul ? */}
      <InstructionsModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
}
