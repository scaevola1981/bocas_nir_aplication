import ExcelJS from 'exceljs';
import { BOCAS_LOGO_BASE64 } from './logoAsset.js';

// Helper pentru adaugare logo antet in foaia NIR (in zona E1:G4)
export function addNirHeaderLogo(workbook, worksheet) {
  if (!workbook || !worksheet || !BOCAS_LOGO_BASE64) return;
  try {
    const existingImages = worksheet.getImages ? worksheet.getImages() : [];
    if (existingImages && existingImages.length > 0) return;

    const imageId = workbook.addImage({
      base64: BOCAS_LOGO_BASE64,
      extension: 'jpeg'
    });
    worksheet.addImage(imageId, {
      tl: { col: 4.2, row: 0.1 },
      ext: { width: 175, height: 75 }
    });
  } catch (err) {
    console.warn('Nu s-a putut adăuga logo-ul în NIR:', err);
  }
}

const NIR_THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

// Helper robust pentru identificarea tab-ului Gestiune (tolerant la litere mari/mici, spații accidentale, prefixe sau tab-ul "G")
export function getGestiuneSheet(workbook) {
  if (!workbook) return null;
  // 1. Potrivire exactă
  let sheet = workbook.getWorksheet('Gestiune');
  if (sheet) return sheet;

  // 2. Potrivire fără spații și case-insensitive
  sheet = workbook.worksheets.find(s => s.name && s.name.trim().toLowerCase() === 'gestiune');
  if (sheet) return sheet;

  // 3. Foaia numită 'G' (abreviere uzuală pentru Gestiune în registrul original Bocas)
  sheet = workbook.worksheets.find(s => s.name && s.name.trim().toUpperCase() === 'G');
  if (sheet) return sheet;

  // 4. Potrivire parțială (ex: "Gestiune 2026", "Foaie Gestiune")
  sheet = workbook.worksheets.find(s => s.name && s.name.trim().toLowerCase().includes('gestiune'));
  if (sheet) return sheet;

  // 5. Căutare după conținutul antetului: orice foaie care conține "DENUMIRE PRODUS" și "COD"
  sheet = workbook.worksheets.find(s => {
    try {
      const row4 = s.getRow(4).values;
      const str = JSON.stringify(row4 || '').toUpperCase();
      return str.includes('DENUMIRE') && str.includes('COD');
    } catch (e) {
      return false;
    }
  });
  return sheet || null;
}

export async function analyzeExcelWorkbook(arrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const gestiuneSheet = getGestiuneSheet(workbook);
  if (!gestiuneSheet) {
    const existingSheets = workbook.worksheets.map(s => `"${s.name}"`).join(', ');
    throw new Error(
      `Nu s-a găsit foaia "Gestiune" în fișierul Excel încărcat.\n` +
      `Foile identificate în acest fișier sunt: [${existingSheets || 'niciuna'}].\n\n` +
      `Sfat: La Pasul 1 trebuie să conectezi registrul central de lucru (de exemplu fișierul "Document de lucru.xlsx" sau "gestiune...xlsx"), NU o factură sau un fișier Excel descărcat de la furnizor.`
    );
  }

  // 1. Determine highest NIR number and collect existing invoices for duplicate safety
  let maxNirNum = 0;
  let lastNirSheetName = null;
  const sheetsList = [];
  const existingInvoices = [];

  workbook.eachSheet((sheet) => {
    sheetsList.push(sheet.name);

    // Recunoaște atât formatul "Nir 12", "NIR 12" cât și formatul simplu "12" (din registrul original)
    const match = sheet.name.trim().match(/^(?:Nir\s*)?([0-9]+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);

      // Verificăm dacă foaia are conținut efectiv de NIR (furnizor, factură sau rânduri de produse)
      const invNum = sheet.getCell('D11').value;
      const supp = sheet.getCell('E9').value;
      const invDate = sheet.getCell('F11').value;
      const f7Val = sheet.getCell('F7').value;
      const hasContent = Boolean(invNum || supp || (f7Val && sheet.actualRowCount > 5));

      if (hasContent) {
        if (num > maxNirNum) {
          maxNirNum = num;
          lastNirSheetName = sheet.name;
        }

        const totCell = sheet.getCell('F37');
        const totalNir = typeof totCell.value === 'object' ? (totCell.result || 0) : Number(totCell.value || 0);

        const sheetItems = [];
        for (let r = 15; r <= 36; r++) {
          const pName = sheet.getCell(`B${r}`).value;
          const pQty = sheet.getCell(`D${r}`).value;
          if (pName && String(pName).trim()) {
            sheetItems.push({
              name: String(pName).trim().toUpperCase(),
              quantity: Number(pQty || 0)
            });
          }
        }

        existingInvoices.push({
          sheetName: sheet.name,
          nirNumber: num,
          invoiceNumber: String(invNum || '').trim(),
          supplierName: String(supp || '').trim(),
          invoiceDate: String(invDate || '').trim(),
          totalNir,
          items: sheetItems
        });
      }
    }
  });

  const nextNirNum = maxNirNum > 0 ? maxNirNum + 1 : 1;

  // 2. Find Total Row and last populated product row in Gestiune
  let totalRowNumber = null;
  let lastPopulatedProductRow = 4;
  let maxCod = 0;

  gestiuneSheet.eachRow((row, rowNumber) => {
    const col7Formula = row.getCell(7).formula || '';
    const col10Formula = row.getCell(10).formula || '';
    const col1Val = row.getCell(1).value;

    // Check if this row is the TOTAL row
    if (/SUM\s*\(/i.test(col7Formula) || /SUM\s*\(/i.test(col10Formula)) {
      totalRowNumber = rowNumber;
    }

    const trimmedCol1 = String(col1Val || '').trim();

    // Check if this row is a populated product row (must be before Total row if detected)
    if (rowNumber >= 5 && (!totalRowNumber || rowNumber < totalRowNumber) && trimmedCol1 && !/Intocmit/i.test(trimmedCol1)) {
      lastPopulatedProductRow = Math.max(lastPopulatedProductRow, rowNumber);
      const codVal = row.getCell(2).value;
      if (codVal) {
        const parsed = parseInt(String(codVal).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > maxCod) {
          maxCod = parsed;
        }
      }
    }
  });

  // If there are pre-numbered blank rows right after the last populated product
  let firstAvailableRow = lastPopulatedProductRow + 1;
  const nextCod = maxCod > 0 ? maxCod + 1 : 10001;

  // 3. Detect Month / Year from Gestiune Row 1
  let monthStr = 'AUGUST';
  let yearStr = '2026';
  try {
    const r1f = gestiuneSheet.getCell('F1').value;
    const r1i = gestiuneSheet.getCell('I1').value;
    if (r1f) monthStr = String(r1f).trim();
    if (r1i) yearStr = String(r1i).trim();
  } catch (e) {
    console.warn('Could not read month/year from Gestiune:', e);
  }

  return {
    workbook,
    gestiuneSheetName: gestiuneSheet.name,
    sheetsList,
    existingInvoices,
    maxNirNum,
    nextNirNum,
    lastNirSheetName,
    maxCod,
    nextCod,
    totalRowNumber,
    lastPopulatedProductRow,
    firstAvailableRow,
    monthStr,
    yearStr
  };
}

export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}${isoMatch[2].padStart(2, '0')}${isoMatch[1]}`;
  }
  const roMatch = s.match(/^(\d{1,2})[-/.,](\d{1,2})[-/.,](\d{4})/);
  if (roMatch) {
    return `${roMatch[1].padStart(2, '0')}${roMatch[2].padStart(2, '0')}${roMatch[3]}`;
  }
  return s.replace(/\D/g, '');
}

export function areDatesMatching(d1, d2) {
  const norm1 = normalizeDate(d1);
  const norm2 = normalizeDate(d2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

export function areSuppliersMatching(s1, s2) {
  if (!s1 || !s2) return false;
  const clean = (str) => String(str)
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?C\.?|SRL|SA|SC|PFA|II|IF|ROMANIA|SOCIETATEA|COM|IMPEX)\b/gi, '')
    .replace(/[^A-Z0-9]/g, '');

  const c1 = clean(s1);
  const c2 = clean(s2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length >= 4 && c2.length >= 4) {
    if (c1.includes(c2) || c2.includes(c1)) return true;
  }
  return false;
}

// Check if an incoming invoice is already recorded in the existing NIR sheets
export function checkInvoiceDuplicate(
  existingInvoices,
  newInvoiceNumber,
  newSupplierName,
  newItems = [],
  newTotal = 0,
  newInvoiceDate = ''
) {
  if (!existingInvoices || !existingInvoices.length) return { isDuplicate: false };

  const cleanStr = (str) => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const getDigits = (str) => String(str || '').replace(/[^0-9]/g, '');

  const targetClean = cleanStr(newInvoiceNumber);
  const targetDigits = getDigits(newInvoiceNumber);
  const targetNormDigits = targetDigits.replace(/^0+/, '');

  for (const inv of existingInvoices) {
    const existingClean = cleanStr(inv.invoiceNumber);
    const existingDigits = getDigits(inv.invoiceNumber);
    const existingNormDigits = existingDigits.replace(/^0+/, '');

    const hasTargetNum = targetClean.length >= 2;
    const hasExistingNum = existingClean.length >= 2;

    // CAZ 1: Ambele documente au număr de factură explicit
    if (hasTargetNum && hasExistingNum) {
      let isNumberMatch = false;

      // Potrivire exactă alfanumerică
      if (targetClean === existingClean) {
        isNumberMatch = true;
      } else if (targetDigits.length >= 4 && existingDigits.length >= 4 && targetDigits === existingDigits) {
        isNumberMatch = true;
      } else if (targetNormDigits.length >= 3 && existingNormDigits.length >= 3 && targetNormDigits === existingNormDigits) {
        isNumberMatch = true;
      }

      if (isNumberMatch) {
        // Dacă ambele au furnizor specificat, verificăm dacă e același furnizor
        const supplierMatches = !newSupplierName || !inv.supplierName || areSuppliersMatching(newSupplierName, inv.supplierName);
        if (supplierMatches) {
          return {
            isDuplicate: true,
            matchReason: 'invoice_number',
            existingSheet: inv.sheetName,
            existingNumber: inv.invoiceNumber || 'Fără număr',
            existingSupplier: inv.supplierName,
            existingDate: inv.invoiceDate
          };
        }
      }

      // CRITICAL: Ambele facturi au numere explicite și sunt DIFERITE (ex: 4401356219 vs 4401355420).
      // Sunt facturi fiscale distincte! Nu se trece NICIODATĂ la fallback de produse identice!
      continue;
    }

    // CAZ 2: Fallback DOAR dacă cel puțin una dintre facturi NU are număr (ex: NIR manual necompletat în Excel)
    if (!hasTargetNum || !hasExistingNum) {
      const supplierMatches = newSupplierName && inv.supplierName && areSuppliersMatching(newSupplierName, inv.supplierName);
      if (!supplierMatches) continue;

      // Dacă ambele au date și datele diferă, sunt achiziții diferite
      if (newInvoiceDate && inv.invoiceDate && !areDatesMatching(newInvoiceDate, inv.invoiceDate)) {
        continue;
      }

      // Comparăm produsele și totalurile
      if (inv.items && inv.items.length > 0 && newItems && newItems.length > 0) {
        const matchCount = newItems.filter(ni => {
          const niName = cleanStr(ni.name);
          return inv.items.some(ei => {
            const eiClean = cleanStr(ei.name);
            return (eiClean.includes(niName) || niName.includes(eiClean)) && Math.abs(Number(ei.quantity) - Number(ni.quantity)) < 0.01;
          });
        }).length;

        const isSingleItem = newItems.length === 1 && inv.items.length === 1;
        const totalMatches = newTotal > 0 && inv.totalNir > 0 && Math.abs(newTotal - inv.totalNir) < 0.5;

        if ((matchCount >= 2 && matchCount === newItems.length && newItems.length === inv.items.length) ||
            (isSingleItem && matchCount === 1 && (totalMatches || areDatesMatching(newInvoiceDate, inv.invoiceDate)))) {
          return {
            isDuplicate: true,
            matchReason: 'content_fallback',
            existingSheet: inv.sheetName,
            existingNumber: inv.invoiceNumber || 'Fără număr',
            existingSupplier: inv.supplierName,
            existingDate: inv.invoiceDate
          };
        }
      }
    }
  }

  return { isDuplicate: false };
}

export function getNirSheetContent(workbook, sheetName) {
  if (!workbook) return null;
  let ws = workbook.getWorksheet(sheetName);
  if (!ws) {
    const cleanNum = String(sheetName).replace(/\D+/g, '');
    ws = workbook.getWorksheet(cleanNum) || workbook.getWorksheet(`Nir ${cleanNum}`);
  }
  if (!ws) return null;

  const items = [];
  for (let r = 15; r <= 36; r++) {
    const name = ws.getCell(`B${r}`).value;
    if (name) {
      const valCell = ws.getCell(`F${r}`);
      items.push({
        idx: ws.getCell(`A${r}`).value,
        name: String(name),
        um: ws.getCell(`C${r}`).value || 'BUC.',
        quantity: ws.getCell(`D${r}`).value,
        unitPrice: ws.getCell(`E${r}`).value,
        total: typeof valCell.value === 'object' ? (valCell.result || 0) : valCell.value,
        cod: ws.getCell(`G${r}`).value
      });
    }
  }
  return {
    sheetName: ws.name,
    nirNum: ws.getCell('F7').value || sheetName,
    supplierName: ws.getCell('E9').value,
    invoiceNumber: ws.getCell('D11').value,
    invoiceDate: ws.getCell('F11').value,
    totalNIR: ws.getCell('F37').value,
    cumulatNIR: ws.getCell('F38').value,
    items
  };
}

// Generate the 6-digit NIR code for Gestiune (e.g., 260835 for year 2026, month 08, nir 35)
export function calculateNirGestiuneCode(yearStr, monthStr, nirNum) {
  const yy = String(yearStr).slice(-2);
  const monthMap = {
    'IANUARIE': '01', 'FEBRUARIE': '02', 'MARTIE': '03', 'APRILIE': '04',
    'MAI': '05', 'IUNIE': '06', 'IULIE': '07', 'AUGUST': '08',
    'SEPTEMBRIE': '09', 'OCTOMBRIE': '10', 'NOIEMBRIE': '11', 'DECEMBRIE': '12'
  };
  const mm = monthMap[monthStr.toUpperCase()] || '08';
  const nn = String(nirNum).padStart(2, '0');
  return `${yy}${mm}${nn}`;
}

export async function processInvoiceIntoExcel(workbook, invoiceData) {
  const {
    supplierName,
    invoiceNumber,
    invoiceDate,
    items
  } = invoiceData;

  const validItems = items.filter(item => item.selected);
  if (validItems.length === 0) {
    throw new Error('Nu a fost selectat niciun produs pentru generare NIR.');
  }

  const analysis = await analyzeExcelWorkbook(await workbook.xlsx.writeBuffer());
  const {
    nextNirNum,
    lastNirSheetName,
    nextCod,
    totalRowNumber,
    lastPopulatedProductRow,
    yearStr,
    monthStr
  } = analysis;

  // Duplicate safety check: verify against all existing invoices in the workbook
  const validTotal = validItems.reduce((acc, curr) => acc + (curr.totalWithoutVat || 0), 0);
  const dupCheck = checkInvoiceDuplicate(analysis.existingInvoices, invoiceNumber, supplierName, validItems, validTotal, invoiceDate);
  if (dupCheck.isDuplicate && !invoiceData.forceDuplicate) {
    const sheetNumInfo = dupCheck.existingNumber ? ` (factura înregistrată: "${dupCheck.existingNumber}")` : '';
    const dateInfo = dupCheck.existingDate ? ` din data de ${dupCheck.existingDate}` : '';
    throw new Error(`SIGURANȚĂ ACTIVATĂ: Factura "${invoiceNumber || 'fără număr'}" figurează deja înregistrată în Excel (foaia ${dupCheck.existingSheet}${sheetNumInfo}, furnizor: ${dupCheck.existingSupplier || 'Nespecificat'}${dateInfo}). Pentru a preveni dublarea accidentală a stocurilor în gestiune, generarea NIR a fost oprită.`);
  }

  // Respectăm convenția de denumire a foilor NIR din registrul utilizatorului (ex: "Nir 13" sau simplu "13")
  const usesNirPrefix = lastNirSheetName && /^Nir\s*/i.test(lastNirSheetName);
  const nirSheetName = usesNirPrefix ? `Nir ${nextNirNum}` : String(nextNirNum);
  const nirGestiuneCode = calculateNirGestiuneCode(yearStr, monthStr, nextNirNum);

  // 1. Clone or Create NIR Sheet
  const templateSheet = lastNirSheetName ? workbook.getWorksheet(lastNirSheetName) : null;
  
  // Dacă foaia există deja în registrul utilizatorului (ex: foi goale 13..35 pre-create de contabil), o refolosim
  let newSheet = workbook.getWorksheet(nirSheetName) ||
                 (usesNirPrefix ? workbook.getWorksheet(String(nextNirNum)) : workbook.getWorksheet(`Nir ${nextNirNum}`));

  if (newSheet) {
    if (templateSheet && newSheet !== templateSheet) {
      copySheetStructure(templateSheet, newSheet);
    }
  } else {
    newSheet = workbook.addWorksheet(nirSheetName);
    if (templateSheet) {
      copySheetStructure(templateSheet, newSheet);
    } else {
      setupDefaultNirSheet(newSheet, workbook);
    }
  }

  // Adaugă logo-ul în antetul foii NIR (dacă nu există deja)
  addNirHeaderLogo(workbook, newSheet);

  // 2. Populate NIR Header
  newSheet.getCell('F7').value = nextNirNum;
  newSheet.getCell('E9').value = supplierName;
  newSheet.getCell('D11').value = invoiceNumber;
  newSheet.getCell('F11').value = invoiceDate;

  // 3. Populate NIR Items (rows 15 to 36) - font strict Arial, marime 8
  let currentCod = nextCod;
  validItems.forEach((item, idx) => {
    const r = 15 + idx;
    item.assignedCod = currentCod;

    const effectiveUnitPrice = (item.totalWithoutVat && item.quantity)
      ? (Math.abs(item.quantity * item.unitPrice - item.totalWithoutVat) > 0.005
          ? Number((item.totalWithoutVat / item.quantity).toFixed(4))
          : Number(item.unitPrice))
      : Number(item.unitPrice);

    const safeName = typeof item.name === 'string' && /^[=+\-@]/.test(item.name.trim()) ? `'${item.name}` : item.name;

    // A: nr.crt.
    const aCell = newSheet.getCell(`A${r}`);
    aCell.value = idx + 1;
    aCell.alignment = { horizontal: 'center', vertical: 'middle' };
    aCell.font = { name: 'Arial', size: 8 };
    aCell.border = NIR_THIN_BORDER;

    // B: Denumire produs
    const bCell = newSheet.getCell(`B${r}`);
    bCell.value = safeName;
    bCell.alignment = { horizontal: 'left', vertical: 'middle' };
    bCell.font = { name: 'Arial', size: 8 };
    bCell.border = NIR_THIN_BORDER;

    // C: U/M
    const cCell = newSheet.getCell(`C${r}`);
    cCell.value = item.um || 'BUC.';
    cCell.alignment = { horizontal: 'left', vertical: 'middle' };
    cCell.font = { name: 'Arial', size: 8 };
    cCell.border = NIR_THIN_BORDER;

    // D: Cantitate - aliniat la dreapta lângă linia celulei
    const dCell = newSheet.getCell(`D${r}`);
    dCell.value = Number(item.quantity);
    dCell.alignment = { horizontal: 'right', vertical: 'middle' };
    dCell.font = { name: 'Arial', size: 8 };
    dCell.numFmt = '#,##0.00';
    dCell.border = NIR_THIN_BORDER;

    // E: Preț unitar - aliniat la dreapta lângă linia celulei
    const eCell = newSheet.getCell(`E${r}`);
    eCell.value = effectiveUnitPrice;
    eCell.alignment = { horizontal: 'right', vertical: 'middle' };
    eCell.font = { name: 'Arial', size: 8 };
    eCell.numFmt = '#,##0.00';
    eCell.border = NIR_THIN_BORDER;

    // F: Valoare fără TVA - aliniat la dreapta lângă linia celulei
    const fCell = newSheet.getCell(`F${r}`);
    fCell.value = { formula: `D${r}*E${r}`, result: Number(item.totalWithoutVat) };
    fCell.alignment = { horizontal: 'right', vertical: 'middle' };
    fCell.numFmt = '#,##0.00';
    fCell.font = { name: 'Arial', size: 8, bold: false };
    fCell.border = NIR_THIN_BORDER;

    // G: Cod intrare
    const gCell = newSheet.getCell(`G${r}`);
    gCell.value = String(currentCod);
    gCell.alignment = { horizontal: 'center', vertical: 'middle' };
    gCell.font = { name: 'Arial', size: 8 };
    gCell.border = NIR_THIN_BORDER;

    currentCod++;
  });

  // Clear any remaining item rows up to 36 with Arial 8 and borders
  for (let r = 15 + validItems.length; r <= 36; r++) {
    const aCell = newSheet.getCell(`A${r}`);
    aCell.value = r - 14;
    aCell.alignment = { horizontal: 'center', vertical: 'middle' };
    aCell.font = { name: 'Arial', size: 8 };
    aCell.border = NIR_THIN_BORDER;

    const bCell = newSheet.getCell(`B${r}`);
    bCell.value = '';
    bCell.font = { name: 'Arial', size: 8 };
    bCell.border = NIR_THIN_BORDER;

    const cCell = newSheet.getCell(`C${r}`);
    cCell.value = '';
    cCell.font = { name: 'Arial', size: 8 };
    cCell.border = NIR_THIN_BORDER;

    const dCell = newSheet.getCell(`D${r}`);
    dCell.value = null;
    dCell.alignment = { horizontal: 'right', vertical: 'middle' };
    dCell.font = { name: 'Arial', size: 8 };
    dCell.border = NIR_THIN_BORDER;

    const eCell = newSheet.getCell(`E${r}`);
    eCell.value = null;
    eCell.alignment = { horizontal: 'right', vertical: 'middle' };
    eCell.font = { name: 'Arial', size: 8 };
    eCell.border = NIR_THIN_BORDER;

    const fCell = newSheet.getCell(`F${r}`);
    fCell.value = { formula: `D${r}*E${r}`, result: 0 };
    fCell.alignment = { horizontal: 'right', vertical: 'middle' };
    fCell.numFmt = '#,##0.00';
    fCell.font = { name: 'Arial', size: 8, bold: false };
    fCell.border = NIR_THIN_BORDER;

    const gCell = newSheet.getCell(`G${r}`);
    gCell.value = '';
    gCell.font = { name: 'Arial', size: 8 };
    gCell.border = NIR_THIN_BORDER;
  }

  // NIR Total Formulas & Formatting (TOTAL Arial 8 bold, F37 Arial 8 bold, F38 Arial 8)
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
    newSheet.getCell(`${col}37`).border = NIR_THIN_BORDER;
  });

  const b37Cell = newSheet.getCell('B37');
  b37Cell.value = 'TOTAL';
  b37Cell.font = { name: 'Arial', size: 8, bold: true };
  b37Cell.alignment = { horizontal: 'left', vertical: 'middle' };

  const f37Cell = newSheet.getCell('F37');
  f37Cell.value = { formula: 'SUM(F15:F36)' };
  f37Cell.font = { name: 'Arial', size: 8, bold: true };
  f37Cell.alignment = { horizontal: 'right', vertical: 'middle' };
  f37Cell.numFmt = '#,##0.00';
  
  const f38Cell = newSheet.getCell('F38');
  if (lastNirSheetName) {
    f38Cell.value = { formula: `F37+'${lastNirSheetName}'!F38` };
  } else {
    f38Cell.value = { formula: 'F37' };
  }
  f38Cell.font = { name: 'Arial', size: 8, bold: false };
  f38Cell.alignment = { horizontal: 'right', vertical: 'middle' };
  f38Cell.numFmt = '#,##0.00';

  // 4. Update Gestiune Sheet (Insert BEFORE Total Row)
  const gestiuneSheet = getGestiuneSheet(workbook);
  let currentRowIndex = lastPopulatedProductRow + 1;

  for (const item of validItems) {
    // If we've reached or passed the Total row, we need to insert a new row above Total
    if (totalRowNumber && currentRowIndex >= totalRowNumber) {
      gestiuneSheet.spliceRows(currentRowIndex, 0, []);
    }

    const row = gestiuneSheet.getRow(currentRowIndex);
    const r = currentRowIndex;
    row.height = 18;

    const safeName = typeof item.name === 'string' && /^[=+\-@]/.test(item.name.trim()) ? `'${item.name}` : item.name;
    row.getCell(1).value = safeName; // A: Denumire
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(2).value = String(item.assignedCod); // B: Cod
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(3).value = String(nirGestiuneCode); // C: NIR
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(4).value = item.um || 'BUC.'; // D: U/M
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    
    // E, F, G: Stoc initial
    row.getCell(5).value = null;
    row.getCell(6).value = null;
    row.getCell(7).value = 0;

    const effectiveUnitPrice = (item.totalWithoutVat && item.quantity)
      ? (Math.abs(item.quantity * item.unitPrice - item.totalWithoutVat) > 0.005
          ? Number((item.totalWithoutVat / item.quantity).toFixed(4))
          : Number(item.unitPrice))
      : Number(item.unitPrice);

    // H, I, J: Intrari
    row.getCell(8).value = Number(item.quantity);
    row.getCell(9).value = effectiveUnitPrice;
    row.getCell(10).value = { formula: `H${r}*I${r}`, result: Number(item.totalWithoutVat) };

    // K, L, M: Iesiri
    row.getCell(11).value = null;
    row.getCell(12).value = { formula: `I${r}`, result: effectiveUnitPrice };
    row.getCell(13).value = { formula: `K${r}*L${r}`, result: 0 };

    // N, O, P: Stoc final
    row.getCell(14).value = { formula: `E${r}+H${r}-K${r}`, result: Number(item.quantity) };
    row.getCell(15).value = { formula: `I${r}`, result: effectiveUnitPrice };
    row.getCell(16).value = { formula: `N${r}*O${r}`, result: Number(item.totalWithoutVat) };

    // Copiază stilul și garantează alinierea numerelor la dreapta pe coloanele 5..16
    const prevRow = gestiuneSheet.getRow(r - 1);
    for (let c = 1; c <= 16; c++) {
      if (prevRow.getCell(c).style) {
        row.getCell(c).style = { ...prevRow.getCell(c).style };
      }
      if (c >= 5) {
        row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(c).numFmt = '#,##0.00';
      }
    }

    row.commit();
    currentRowIndex++;
  }

  // Update total formulas in Gestiune if rows were added
  const endProductRow = currentRowIndex - 1;
  const updatedTotalRowIdx = totalRowNumber ? Math.max(totalRowNumber, currentRowIndex) : null;
  if (updatedTotalRowIdx) {
    const totalRow = gestiuneSheet.getRow(updatedTotalRowIdx);
    totalRow.height = 22;
    totalRow.getCell(7).value = { formula: `SUM(G5:G${endProductRow})` };
    totalRow.getCell(10).value = { formula: `SUM(J5:J${endProductRow})` };
    totalRow.getCell(13).value = { formula: `SUM(M5:M${endProductRow})` };
    totalRow.getCell(16).value = { formula: `SUM(P5:P${endProductRow})` };
    [7, 10, 13, 16].forEach(c => {
      totalRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(c).numFmt = '#,##0.00';
    });
    totalRow.commit();
  }

  // Repară și standardizează automat stilurile tuturor foilor NIR și Gestiune din registru
  repairAllWorkbookFormatting(workbook);

  return {
    nextNirNum,
    nirSheetName,
    nirGestiuneCode,
    itemsAdded: validItems.length,
    firstCod: nextCod,
    lastCod: currentCod - 1
  };
}

export function repairAllNirSheetsFormatting(workbook) {
  if (!workbook) return 0;
  let fixedCount = 0;
  workbook.eachSheet((sheet) => {
    const match = sheet.name.trim().match(/^(?:Nir\s*)?([0-9]+)$/i);
    if (match) {
      // 1. Lățimi coloane identice cu NIR-model.xlsx
      sheet.getColumn(1).width = 6.11;
      sheet.getColumn(2).width = 29.0;
      sheet.getColumn(3).width = 5.0;
      sheet.getColumn(4).width = 10.5;
      sheet.getColumn(5).width = 9.5;
      sheet.getColumn(6).width = 10.5;
      sheet.getColumn(7).width = 9.0;

      // 2. Înălțimi rânduri conform modelului oficial
      sheet.getRow(1).height = 20.4;
      sheet.getRow(2).height = 18;
      sheet.getRow(3).height = 18;
      sheet.getRow(4).height = 18;
      sheet.getRow(7).height = 20.4;
      sheet.getRow(8).height = 22.8;
      sheet.getRow(9).height = 18;
      sheet.getRow(11).height = 18;
      sheet.getRow(13).height = 15;
      sheet.getRow(14).height = 15;

      // 3. Antet firmă complet (Liniile 1..4) cu font strict Arial
      const a1 = sheet.getCell('A1');
      if (!a1.value || !String(a1.value).trim()) a1.value = 'S.C. BOCAS PROJECT SRL';
      a1.font = { name: 'Arial', size: 14, bold: true };

      const a2 = sheet.getCell('A2');
      if (!a2.value || !String(a2.value).trim()) a2.value = 'Nr.R.C./Aut: J40/15128/2006, C.U.I.: RO 19039850  ,Sediu : B-dul 1Decembrie 1918, Nr.8,  ';
      a2.font = { name: 'Arial', size: 8 };

      const a3 = sheet.getCell('A3');
      if (!a3.value || !String(a3.value).trim()) a3.value = 'Cont IBAN    RO 07 RNCB 0079 0614 9233 0001 Banca             B.C.R. TITAN';
      a3.font = { name: 'Arial', size: 8 };

      const a4 = sheet.getCell('A4');
      if (!a4.value || !String(a4.value).trim()) a4.value = 'Tel.Fax.   0213456135 ; mobil 0721456653    Maill :  bocas.project@gmail.com';
      a4.font = { name: 'Arial', size: 8 };

      // Inserare logo în antet (E1:G4)
      addNirHeaderLogo(workbook, sheet);

      // 4. Detalii NIR (rândurile 7, 9, 11) - font Arial
      const b7 = sheet.getCell('B7');
      b7.font = { name: 'Arial', size: 14, bold: true };
      b7.alignment = { horizontal: 'left', vertical: 'middle' };

      const e7 = sheet.getCell('E7');
      e7.font = { name: 'Arial', size: 14, bold: true };
      e7.alignment = { horizontal: 'right', vertical: 'middle' };

      const f7 = sheet.getCell('F7');
      f7.font = { name: 'Arial', size: 14, bold: true };
      f7.alignment = { horizontal: 'left', vertical: 'middle' };

      const b9 = sheet.getCell('B9');
      b9.font = { name: 'Arial', size: 8 };
      b9.alignment = { horizontal: 'left', vertical: 'middle' };

      const e9 = sheet.getCell('E9');
      e9.font = { name: 'Arial', size: 8, bold: true };
      e9.alignment = { horizontal: 'left', vertical: 'middle' };

      const b11 = sheet.getCell('B11');
      b11.font = { name: 'Arial', size: 8 };
      b11.alignment = { horizontal: 'left', vertical: 'middle' };

      const d11 = sheet.getCell('D11');
      d11.font = { name: 'Arial', size: 8 };
      d11.alignment = { horizontal: 'left', vertical: 'middle' };

      const e11 = sheet.getCell('E11');
      e11.font = { name: 'Arial', size: 8 };
      e11.alignment = { horizontal: 'right', vertical: 'middle' };

      const f11 = sheet.getCell('F11');
      f11.font = { name: 'Arial', size: 8 };
      f11.alignment = { horizontal: 'left', vertical: 'middle' };

      // 5. Cap tabel Rând 14 (Arial 8 bold cu chenare)
      const headers = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      headers.forEach(col => {
        const cell = sheet.getCell(`${col}14`);
        cell.font = { name: 'Arial', size: 8, bold: true };
        cell.border = NIR_THIN_BORDER;
      });

      // 6. Rândurile de produse 15..36 (strict Arial, mărime 8, numere aliniate la dreapta, chenar complet)
      for (let r = 15; r <= 36; r++) {
        sheet.getRow(r).height = 18;

        const cellA = sheet.getCell(`A${r}`);
        cellA.font = { name: 'Arial', size: 8 };
        cellA.alignment = { horizontal: 'center', vertical: 'middle' };
        cellA.border = NIR_THIN_BORDER;

        const cellB = sheet.getCell(`B${r}`);
        cellB.font = { name: 'Arial', size: 8 };
        cellB.alignment = { horizontal: 'left', vertical: 'middle' };
        cellB.border = NIR_THIN_BORDER;

        const cellC = sheet.getCell(`C${r}`);
        cellC.font = { name: 'Arial', size: 8 };
        cellC.alignment = { horizontal: 'left', vertical: 'middle' };
        cellC.border = NIR_THIN_BORDER;

        // D: Cantitate - aliniat la dreapta
        const cellD = sheet.getCell(`D${r}`);
        cellD.font = { name: 'Arial', size: 8 };
        cellD.alignment = { horizontal: 'right', vertical: 'middle' };
        cellD.border = NIR_THIN_BORDER;
        if (cellD.value !== null && cellD.value !== undefined && cellD.value !== '') {
          cellD.numFmt = '#,##0.00';
        }

        // E: Pret unitar - aliniat la dreapta
        const cellE = sheet.getCell(`E${r}`);
        cellE.font = { name: 'Arial', size: 8 };
        cellE.alignment = { horizontal: 'right', vertical: 'middle' };
        cellE.border = NIR_THIN_BORDER;
        if (cellE.value !== null && cellE.value !== undefined && cellE.value !== '') {
          cellE.numFmt = '#,##0.00';
        }

        // F: Valoare fara tva - aliniat la dreapta
        const cellF = sheet.getCell(`F${r}`);
        cellF.font = { name: 'Arial', size: 8, bold: false };
        cellF.alignment = { horizontal: 'right', vertical: 'middle' };
        cellF.border = NIR_THIN_BORDER;
        cellF.numFmt = '#,##0.00';

        // G: Cod intrare
        const cellG = sheet.getCell(`G${r}`);
        cellG.font = { name: 'Arial', size: 8 };
        cellG.alignment = { horizontal: 'center', vertical: 'middle' };
        cellG.border = NIR_THIN_BORDER;
      }

      // 7. Totaluri aliniate la dreapta cu format monetar și chenar
      sheet.getRow(37).height = 20;
      headers.forEach(col => {
        sheet.getCell(`${col}37`).border = NIR_THIN_BORDER;
      });

      const b37 = sheet.getCell('B37');
      b37.value = 'TOTAL';
      b37.font = { name: 'Arial', size: 8, bold: true };
      b37.alignment = { horizontal: 'left', vertical: 'middle' };

      const f37 = sheet.getCell('F37');
      f37.font = { name: 'Arial', size: 8, bold: true };
      f37.alignment = { horizontal: 'right', vertical: 'middle' };
      f37.numFmt = '#,##0.00';

      sheet.getRow(38).height = 18;
      const f38 = sheet.getCell('F38');
      f38.font = { name: 'Arial', size: 8, bold: false };
      f38.alignment = { horizontal: 'right', vertical: 'middle' };
      f38.numFmt = '#,##0.00';

      fixedCount++;
    }
  });
  return fixedCount;
}

export function repairGestiuneFormatting(workbook) {
  if (!workbook) return false;
  const gestiuneSheet = getGestiuneSheet(workbook);
  if (!gestiuneSheet) return false;

  gestiuneSheet.getRow(4).height = 25;
  for (let c = 1; c <= 16; c++) {
    const cell = gestiuneSheet.getRow(4).getCell(c);
    cell.font = { name: 'Arial', size: 8, bold: true };
  }

  gestiuneSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber >= 5) {
      row.height = 18;
      const col1Val = String(row.getCell(1).value || '').trim();
      const isTotal = /TOTAL/i.test(col1Val) || /SUM\s*\(/i.test(row.getCell(7).formula || '') || /SUM\s*\(/i.test(row.getCell(10).formula || '');

      if (isTotal) {
        row.height = 22;
        row.getCell(1).font = { name: 'Arial', size: 8, bold: true };
        [7, 10, 13, 16].forEach(col => {
          const cell = row.getCell(col);
          cell.font = { name: 'Arial', size: 8, bold: true };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        });
      } else {
        row.getCell(1).font = { name: 'Arial', size: 8 };
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

        for (let c = 2; c <= 4; c++) {
          row.getCell(c).font = { name: 'Arial', size: 8 };
          row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Toate coloanele numerice (5..16) aliniate la linia din dreapta cu font Arial 8
        for (let c = 5; c <= 16; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Arial', size: 8 };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            cell.numFmt = '#,##0.00';
          }
        }
      }
    }
  });
  return true;
}

export function repairAllWorkbookFormatting(workbook) {
  const nirsCount = repairAllNirSheetsFormatting(workbook);
  repairGestiuneFormatting(workbook);
  return nirsCount;
}

function copySheetStructure(srcSheet, destSheet) {
  srcSheet.columns.forEach((col, idx) => {
    if (col && col.width) {
      destSheet.getColumn(idx + 1).width = col.width;
    }
  });

  srcSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const destRow = destSheet.getRow(rowNumber);
    destRow.height = row.height;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const destCell = destRow.getCell(colNumber);
      destCell.value = cell.value;
      if (cell.style) {
        destCell.style = JSON.parse(JSON.stringify(cell.style));
      }
    });
    destRow.commit();
  });

  // Înălțimi standardizate conform modelului oficial
  destSheet.getRow(1).height = 20.4;
  destSheet.getRow(2).height = 18;
  destSheet.getRow(3).height = 18;
  destSheet.getRow(4).height = 18;
  destSheet.getRow(7).height = 20.4;
  destSheet.getRow(14).height = 15;
}

function setupDefaultNirSheet(sheet, workbook) {
  sheet.columns = [
    { width: 6.11 }, // A: nr.crt.
    { width: 29.0 }, // B: Denumire produs
    { width: 5.0 },  // C: U/M
    { width: 10.5 }, // D: Cantitate
    { width: 9.5 },  // E: Pret unitar
    { width: 10.5 }, // F: Valoare fara tva
    { width: 9.0 }   // G: Cod intrare
  ];

  sheet.getRow(1).height = 20.4;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 18;
  sheet.getRow(7).height = 20.4;
  sheet.getRow(8).height = 22.8;
  sheet.getRow(9).height = 18;
  sheet.getRow(11).height = 18;
  sheet.getRow(13).height = 15;
  sheet.getRow(14).height = 15;

  sheet.getCell('A1').value = 'S.C. BOCAS PROJECT SRL';
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  sheet.getCell('A2').value = 'Nr.R.C./Aut: J40/15128/2006, C.U.I.: RO 19039850  ,Sediu : B-dul 1Decembrie 1918, Nr.8,  ';
  sheet.getCell('A2').font = { name: 'Arial', size: 8 };

  sheet.getCell('A3').value = 'Cont IBAN    RO 07 RNCB 0079 0614 9233 0001 Banca             B.C.R. TITAN';
  sheet.getCell('A3').font = { name: 'Arial', size: 8 };

  sheet.getCell('A4').value = 'Tel.Fax.   0213456135 ; mobil 0721456653    Maill :  bocas.project@gmail.com';
  sheet.getCell('A4').font = { name: 'Arial', size: 8 };

  if (workbook) {
    addNirHeaderLogo(workbook, sheet);
  }

  sheet.getCell('B7').value = 'NOTE DE INTRARE RECEPTIE';
  sheet.getCell('B7').font = { name: 'Arial', size: 14, bold: true };
  sheet.getCell('B7').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.getCell('E7').value = 'Nr.';
  sheet.getCell('E7').font = { name: 'Arial', size: 14, bold: true };
  sheet.getCell('E7').alignment = { horizontal: 'right', vertical: 'middle' };

  sheet.getCell('B9').value = 'Se receptioneaza marfurile furnizate de';
  sheet.getCell('B9').font = { name: 'Arial', size: 8 };
  sheet.getCell('B9').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.getCell('B11').value = 'Conform facturii ';
  sheet.getCell('B11').font = { name: 'Arial', size: 8 };
  sheet.getCell('B11').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.getCell('E11').value = 'din';
  sheet.getCell('E11').font = { name: 'Arial', size: 8 };
  sheet.getCell('E11').alignment = { horizontal: 'right', vertical: 'middle' };
  
  const headers = [
    { col: 'A', text: 'nr.crt.', align: 'center' },
    { col: 'B', text: 'Denumire produs', align: 'left' },
    { col: 'C', text: 'U/M', align: 'left' },
    { col: 'D', text: 'Cantitate', align: 'left' },
    { col: 'E', text: 'Pret unitar', align: 'left' },
    { col: 'F', text: 'Valoare fara tva', align: 'left' },
    { col: 'G', text: 'Cod intrare', align: 'left' }
  ];
  headers.forEach(h => {
    const cell = sheet.getCell(`${h.col}14`);
    cell.value = h.text;
    cell.font = { name: 'Arial', size: 8, bold: true };
    cell.alignment = { horizontal: h.align, vertical: 'middle' };
    cell.border = NIR_THIN_BORDER;
  });

  for (let r = 15; r <= 36; r++) {
    sheet.getRow(r).height = 18;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
      const cell = sheet.getCell(`${col}${r}`);
      cell.border = NIR_THIN_BORDER;
      cell.font = { name: 'Arial', size: 8 };
      if (col === 'A') {
        cell.value = r - 14;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col === 'F') {
        cell.value = { formula: `D${r}*E${r}`, result: 0 };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    });
  }

  sheet.getRow(37).height = 20;
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
    sheet.getCell(`${col}37`).border = NIR_THIN_BORDER;
  });
  sheet.getCell('B37').value = 'TOTAL';
  sheet.getCell('B37').font = { name: 'Arial', size: 8, bold: true };
  sheet.getCell('B37').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.getCell('F37').value = { formula: 'SUM(F15:F36)' };
  sheet.getCell('F37').font = { name: 'Arial', size: 8, bold: true };
  sheet.getCell('F37').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getCell('F37').numFmt = '#,##0.00';

  sheet.getRow(38).height = 18;
  sheet.getCell('F38').font = { name: 'Arial', size: 8, bold: false };
  sheet.getCell('F38').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getCell('F38').numFmt = '#,##0.00';
}
