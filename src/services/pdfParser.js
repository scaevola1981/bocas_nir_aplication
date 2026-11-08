import * as pdfjsModule from 'pdfjs-dist';
import { cleanSupplierName, mapUnitCode } from './xmlParser.js';

// Compatibilitate atât pentru Vite Dev (ESM/UMD) cât și pentru Build Producție / Desktop
const pdfjsLib = pdfjsModule?.GlobalWorkerOptions
  ? pdfjsModule
  : (pdfjsModule?.default || globalThis.pdfjsLib || window.pdfjsLib);

// Worker 100% local (fără cereri externe către CDN, compatibil cu GitHub Pages și rute sub-director)
if (pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`;
}

export async function parseInvoicePdf(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Group text items by Y coordinate (rounded to 3px tolerance)
    const rowMap = {};
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      rowMap[y] = rowMap[y] || [];
      rowMap[y].push({ x: item.transform[4], str: item.str.trim() });
    }
    
    // Sort lines top to bottom (Y descending in PDF)
    const sortedY = Object.keys(rowMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedY) {
      const lineItems = rowMap[y].sort((a, b) => a.x - b.x).map(i => i.str);
      fullLines.push(lineItems);
    }
  }

  // Parse extracted lines
  return parseStructuredLines(fullLines);
}

function parseStructuredLines(lines) {
  let supplierName = '';
  let invoiceNumber = '';
  let invoiceDate = '';
  const items = [];

  const flattenedLines = lines.map(line => line.join(' '));

  // 1. Extract Invoice Number & Date
  for (let i = 0; i < flattenedLines.length; i++) {
    const text = flattenedLines[i];
    
    // Pattern 1: Serie ... Numar ... (e.g. "Serie BI F Numar 35648")
    const serieNumMatch = text.match(/Serie\s*[:\s]*([A-Za-z0-9_\-\s]+?)\s+Numar\s*[:\s]*([0-9]+)/i);
    if (serieNumMatch && !invoiceNumber) {
      invoiceNumber = serieNumMatch[2].trim();
    }

    // Pattern 2: Match "Nr. doc. BJR89180 din 28/08/2026" or similar
    const docMatch = text.match(/Nr\.?\s*doc\.?\s*[:\s]*([A-Za-z0-9_\-\s]+?)\s+din\s+([0-9]{1,2}[\/\.,\-][0-9]{1,2}[\/\.,\-][0-9]{4})/i);
    if (docMatch && !invoiceNumber) {
      invoiceNumber = docMatch[1].trim();
      invoiceDate = docMatch[2].trim().replace(/[\/\-]/g, ',');
    }

    // Pattern 3: Match "Factura seria ... nr ... "
    if (!invoiceNumber) {
      const factMatch = text.match(/Factura\s*(?:seria\s+([A-Za-z0-9]+))?\s*(?:nr\.?|numar)?\s*[:\s]*([A-Za-z0-9_\-]+)/i);
      if (factMatch && !/RON|EUR|TVA|CLIENT|FURNIZOR/i.test(factMatch[2])) {
        invoiceNumber = factMatch[2].trim();
      }
    }

    // Date extraction fallback
    if (!invoiceDate) {
      const dateMatch = text.match(/\bData(?:\s*facturii|\s*emiterii)?\s*[:\s]*([0-9]{1,2}[\/\.,\-][0-9]{1,2}[\/\.,\-][0-9]{4})/i);
      if (dateMatch) {
        invoiceDate = dateMatch[1].trim().replace(/[\/\-]/g, ',');
      }
    }

    // Match Furnizor
    if (!supplierName && /FURNIZOR/i.test(text)) {
      // Often supplier name is in next 1-3 lines
      for (let j = 1; j <= 3; j++) {
        const nextLine = flattenedLines[i + j];
        if (nextLine && !/CIF:|RO[0-9]{6,}|RC\s*J/i.test(nextLine)) {
          // Split if CLIENT or BOCAS PROJECT appears on the same line
          let name = nextLine.split(/CLIENT|ELASYM|BOCAS/i)[0].trim();
          if (name && name.length > 2) {
            supplierName = name;
            break;
          }
        }
      }
    }
  }

  // 2. Extract Items from Table
  // Standard columns: #, Denumire, U.M., Cant., Pret fara TVA, Valoare, Valoare TVA
  let inProductsSection = false;
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStr = line.join(' ');

    if (/PRODUSE\/SERVICII|Denumire.*U\.?M\.?.*Cant/i.test(lineStr)) {
      inProductsSection = true;
      continue;
    }

    if (inProductsSection && (/Total.*factura/i.test(lineStr) || /Total\s+[0-9]/i.test(lineStr) || /Index\s+incarcare/i.test(lineStr))) {
      // Reached table footer
      if (currentItem) {
        items.push(currentItem);
        currentItem = null;
      }
      break;
    }

    if (!inProductsSection) continue;

    // Check if line starts with an index number (1, 2, 3...)
    const firstToken = line[0];
    const isIndex = /^[0-9]{1,3}$/.test(firstToken);

    // Look for numbers at the end of the line: [Quantity, UnitPrice, Value, VatValue]
    const extractedNumbers = extractTrailingNumbers(line);

    if (isIndex && extractedNumbers) {
      if (currentItem) items.push(currentItem);

      // Remaining middle tokens contain [Denumire, U.M.]
      const middleTokens = line.slice(1, line.length - extractedNumbers.tokenCount);
      let um = 'BUC.';
      let nameTokens = [...middleTokens];

      // Check if last middle token is a UM code (BUC, ML, KG, KGM, H87, MTR, LTR, etc.)
      if (nameTokens.length > 0) {
        const candidateUm = nameTokens[nameTokens.length - 1];
        if (/^(BUC\.?|ML\.?|KG\.?|KGM|H87|MTR|LTR|SET|PCE|BUC|MTQ|MTK|MC\.?|MP\.?|L\.?|C62|PR)$/i.test(candidateUm)) {
          um = mapUnitCode(candidateUm);
          nameTokens.pop();
        }
      }

      currentItem = {
        id: items.length + 1,
        name: nameTokens.join(' ').trim(),
        um,
        quantity: extractedNumbers.quantity,
        unitPrice: extractedNumbers.unitPrice,
        totalWithoutVat: extractedNumbers.total,
        selected: true
      };
    } else if (currentItem) {
      // Additional line of description
      const extraText = line.filter(t => !/^[0-9\s,\.]+$/.test(t)).join(' ');
      if (extraText) {
        currentItem.name = `${currentItem.name} ${extraText}`.trim();
      }
    }
  }

  if (currentItem) {
    items.push(currentItem);
  }

  return {
    supplierName: cleanSupplierName(supplierName),
    invoiceNumber,
    invoiceDate,
    items
  };
}

// Helper to parse numbers formatted like "1 226.30" or "122.63"
function parseRoNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/\s+/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function extractTrailingNumbers(line) {
  // Join all items and inspect from right to left
  const tokens = [...line];
  const numbersFound = [];

  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/^[0-9]{1,3}(?:\s[0-9]{3})*(?:[,\.][0-9]{2,4})?$/.test(t) || /^[0-9]+(?:[,\.][0-9]+)?$/.test(t)) {
      numbersFound.unshift({ val: parseRoNumber(t), raw: t, idx: i });
      if (numbersFound.length >= 4) break; // [Qty, Price, Value, Vat]
    } else {
      if (numbersFound.length >= 3) break;
    }
  }

  if (numbersFound.length >= 3) {
    // Last 3 are usually Price, Value, Vat or Qty, Price, Value
    // If 4 numbers: [Qty, Price, Value, Vat]
    // If 3 numbers: [Qty, Price, Value]
    let qty = 1;
    let price = 0;
    let total = 0;

    if (numbersFound.length >= 4) {
      qty = numbersFound[numbersFound.length - 4].val;
      price = numbersFound[numbersFound.length - 3].val;
      total = numbersFound[numbersFound.length - 2].val;
    } else {
      qty = numbersFound[0].val;
      price = numbersFound[1].val;
      total = numbersFound[2].val;
    }

    return {
      quantity: Number(qty.toFixed(4)),
      unitPrice: Number(price.toFixed(4)),
      total: Number(total.toFixed(4)),
      tokenCount: numbersFound.length
    };
  }

  return null;
}
