import ExcelJS from 'exceljs';

export async function analyzeExcelWorkbook(arrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const gestiuneSheet = workbook.getWorksheet('Gestiune');
  if (!gestiuneSheet) {
    throw new Error('Nu s-a găsit foaia "Gestiune" în fișierul Excel încărcat.');
  }

  // 1. Determine highest NIR number and collect existing invoices for duplicate safety
  let maxNirNum = 0;
  let lastNirSheetName = null;
  const sheetsList = [];
  const existingInvoices = [];

  workbook.eachSheet((sheet) => {
    sheetsList.push(sheet.name);
    const match = sheet.name.match(/^Nir\s*([0-9]+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNirNum) {
        maxNirNum = num;
        lastNirSheetName = sheet.name;
      }

      // Read invoice number from D11, supplier from E9, date from F11, total from F37
      const invNum = sheet.getCell('D11').value;
      const supp = sheet.getCell('E9').value;
      const invDate = sheet.getCell('F11').value;
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
        invoiceNumber: String(invNum || '').trim(),
        supplierName: String(supp || '').trim(),
        invoiceDate: String(invDate || '').trim(),
        totalNir,
        items: sheetItems
      });
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

// Check if an incoming invoice is already recorded in the existing NIR sheets (by number OR by items)
export function checkInvoiceDuplicate(existingInvoices, newInvoiceNumber, newSupplierName, newItems = [], newTotal = 0) {
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

    // 1. Check Invoice Number match
    let isMatch = false;
    if (targetClean.length >= 3 && existingClean.length >= 3) {
      if (targetClean === existingClean) isMatch = true;
      if (!isMatch && targetDigits.length >= 4 && existingDigits.length >= 4 && targetDigits === existingDigits) isMatch = true;
      if (!isMatch && targetNormDigits.length >= 4 && existingNormDigits.length >= 4 && targetNormDigits === existingNormDigits) isMatch = true;
      if (!isMatch) {
        if (targetClean.length >= 4 && existingClean.length >= 4) {
          if (targetClean.includes(existingClean) || existingClean.includes(targetClean)) isMatch = true;
        }
        if (!isMatch && targetNormDigits.length >= 4 && existingNormDigits.length >= 4) {
          if (targetNormDigits.endsWith(existingNormDigits) || existingNormDigits.endsWith(targetNormDigits)) isMatch = true;
        }
      }
    }

    // 2. Content fallback match (if same products & quantities or total)
    if (!isMatch && inv.items && inv.items.length > 0 && newItems && newItems.length > 0) {
      const matchCount = newItems.filter(ni => {
        const niName = cleanStr(ni.name);
        return inv.items.some(ei => {
          const eiClean = cleanStr(ei.name);
          return (eiClean.includes(niName) || niName.includes(eiClean)) && Math.abs(Number(ei.quantity) - Number(ni.quantity)) < 0.01;
        });
      }).length;

      const minThreshold = Math.min(2, newItems.length);
      if (matchCount >= minThreshold && (newItems.length === inv.items.length || Math.abs(matchCount - newItems.length) <= 1)) {
        isMatch = true;
      }
    }

    if (isMatch) {
      return {
        isDuplicate: true,
        existingSheet: inv.sheetName,
        existingNumber: inv.invoiceNumber || 'Fără număr',
        existingSupplier: inv.supplierName,
        existingDate: inv.invoiceDate
      };
    }
  }

  return { isDuplicate: false };
}

export function getNirSheetContent(workbook, sheetName) {
  const ws = workbook.getWorksheet(sheetName);
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
    sheetName,
    nirNum: ws.getCell('F7').value,
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
  const dupCheck = checkInvoiceDuplicate(analysis.existingInvoices, invoiceNumber, supplierName, validItems);
  if (dupCheck.isDuplicate && !invoiceData.forceDuplicate) {
    throw new Error(`SIGURANȚĂ ACTIVATĂ: Factura "${invoiceNumber || 'fără număr'}" figurează deja înregistrată în Excel (foaia ${dupCheck.existingSheet}, furnizor: ${dupCheck.existingSupplier || 'Nespecificat'}). Pentru a preveni dublarea accidentală a stocurilor în gestiune, generarea NIR a fost oprită.`);
  }

  const nirSheetName = `Nir ${nextNirNum}`;
  const nirGestiuneCode = calculateNirGestiuneCode(yearStr, monthStr, nextNirNum);

  // 1. Clone or Create NIR Sheet
  const templateSheet = lastNirSheetName ? workbook.getWorksheet(lastNirSheetName) : null;
  const newSheet = workbook.addWorksheet(nirSheetName);

  if (templateSheet) {
    copySheetStructure(templateSheet, newSheet);
  } else {
    setupDefaultNirSheet(newSheet);
  }

  // 2. Populate NIR Header
  newSheet.getCell('F7').value = nextNirNum;
  newSheet.getCell('E9').value = supplierName;
  newSheet.getCell('D11').value = invoiceNumber;
  newSheet.getCell('F11').value = invoiceDate;

  // 3. Populate NIR Items (rows 15 to 36)
  let currentCod = nextCod;
  validItems.forEach((item, idx) => {
    const r = 15 + idx;
    item.assignedCod = currentCod;

    const effectiveUnitPrice = (item.totalWithoutVat && item.quantity)
      ? (Math.abs(item.quantity * item.unitPrice - item.totalWithoutVat) > 0.005
          ? Number((item.totalWithoutVat / item.quantity).toFixed(4))
          : Number(item.unitPrice))
      : Number(item.unitPrice);

    newSheet.getCell(`A${r}`).value = idx + 1;
    newSheet.getCell(`B${r}`).value = item.name;
    newSheet.getCell(`C${r}`).value = item.um || 'BUC.';
    newSheet.getCell(`D${r}`).value = Number(item.quantity);
    newSheet.getCell(`E${r}`).value = effectiveUnitPrice;
    newSheet.getCell(`F${r}`).value = { formula: `D${r}*E${r}`, result: Number(item.totalWithoutVat) };
    newSheet.getCell(`G${r}`).value = String(currentCod);

    currentCod++;
  });

  // Clear any remaining item rows up to 36 if cloned from a sheet with more rows
  for (let r = 15 + validItems.length; r <= 36; r++) {
    newSheet.getCell(`A${r}`).value = r - 14;
    newSheet.getCell(`B${r}`).value = '';
    newSheet.getCell(`C${r}`).value = '';
    newSheet.getCell(`D${r}`).value = null;
    newSheet.getCell(`E${r}`).value = null;
    newSheet.getCell(`F${r}`).value = 0;
    newSheet.getCell(`G${r}`).value = '';
  }

  // NIR Total Formulas
  newSheet.getCell('B37').value = 'TOTAL';
  newSheet.getCell('F37').value = { formula: 'SUM(F15:F36)' };
  
  if (lastNirSheetName) {
    newSheet.getCell('F38').value = { formula: `F37+'${lastNirSheetName}'!F38` };
  } else {
    newSheet.getCell('F38').value = { formula: 'F37' };
  }

  // 4. Update Gestiune Sheet (Insert BEFORE Total Row)
  const gestiuneSheet = workbook.getWorksheet('Gestiune');
  let currentRowIndex = lastPopulatedProductRow + 1;

  for (const item of validItems) {
    // If we've reached or passed the Total row, we need to insert a new row above Total
    if (totalRowNumber && currentRowIndex >= totalRowNumber) {
      gestiuneSheet.spliceRows(currentRowIndex, 0, []);
    }

    const row = gestiuneSheet.getRow(currentRowIndex);
    const r = currentRowIndex;

    row.getCell(1).value = item.name; // A: Denumire
    row.getCell(2).value = String(item.assignedCod); // B: Cod
    row.getCell(3).value = String(nirGestiuneCode); // C: NIR
    row.getCell(4).value = item.um || 'BUC.'; // D: U/M
    
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

    // Copy style from previous product row
    const prevRow = gestiuneSheet.getRow(r - 1);
    for (let c = 1; c <= 16; c++) {
      if (prevRow.getCell(c).style) {
        row.getCell(c).style = { ...prevRow.getCell(c).style };
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
    totalRow.getCell(7).value = { formula: `SUM(G5:G${endProductRow})` };
    totalRow.getCell(10).value = { formula: `SUM(J5:J${endProductRow})` };
    totalRow.getCell(13).value = { formula: `SUM(M5:M${endProductRow})` };
    totalRow.getCell(16).value = { formula: `SUM(P5:P${endProductRow})` };
    totalRow.commit();
  }

  return {
    nextNirNum,
    nirSheetName,
    nirGestiuneCode,
    itemsAdded: validItems.length,
    firstCod: nextCod,
    lastCod: currentCod - 1
  };
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
}

function setupDefaultNirSheet(sheet) {
  sheet.getCell('A1').value = 'S.C. BOCAS PROJECT SRL';
  sheet.getCell('B7').value = 'NOTE DE INTRARE RECEPTIE';
  sheet.getCell('E7').value = 'Nr.';
  sheet.getCell('B9').value = 'Se receptioneaza marfurile furnizate de';
  sheet.getCell('B11').value = 'Conform facturii ';
  sheet.getCell('E11').value = 'din';
  
  sheet.getCell('A14').value = 'nr.crt.';
  sheet.getCell('B14').value = 'Denumire produs';
  sheet.getCell('C14').value = 'U/M';
  sheet.getCell('D14').value = 'Cantitate';
  sheet.getCell('E14').value = 'Pret unitar';
  sheet.getCell('F14').value = 'Valoare fara tva';
  sheet.getCell('G14').value = 'Cod intrare';
}
