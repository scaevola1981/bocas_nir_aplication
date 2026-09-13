import { XMLParser } from 'fast-xml-parser';

// Standard UBL unit code mappings to Romanian accounting units
export const UNIT_CODE_MAP = {
  'H87': 'BUC.',
  'PCE': 'BUC.',
  'C62': 'BUC.',
  'KGM': 'KG.',
  'MTR': 'ML.',
  'LTR': 'L.',
  'MTK': 'MP.',
  'MTQ': 'MC.',
  'SET': 'SET',
  'PR': 'PER'
};

export function mapUnitCode(code) {
  if (!code) return 'BUC.';
  const upper = String(code).trim().toUpperCase();
  return UNIT_CODE_MAP[upper] || upper;
}

export function parseInvoiceXml(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true
  });

  const parsed = parser.parse(xmlContent);
  const invoice = parsed.Invoice || parsed['urn:oasis:names:specification:ubl:schema:xsd:Invoice-2:Invoice'] || parsed;

  if (!invoice) {
    throw new Error('Fișierul XML nu este o factură electronică UBL validă.');
  }

  // 1. Furnizor
  let supplierName = '';
  try {
    const supplierParty = invoice['cac:AccountingSupplierParty']?.['cac:Party'] || invoice.AccountingSupplierParty?.Party;
    supplierName = supplierParty?.['cac:PartyLegalEntity']?.['cbc:RegistrationName'] ||
                   supplierParty?.['cac:PartyName']?.['cbc:Name'] ||
                   supplierParty?.PartyLegalEntity?.RegistrationName ||
                   supplierParty?.PartyName?.Name || '';
  } catch (e) {
    console.warn('Nu s-a putut extrage numele furnizorului din XML:', e);
  }

  // 2. Număr factură & Dată
  const invoiceNumber = invoice['cbc:ID'] || invoice.ID || '';
  const issueDateRaw = invoice['cbc:IssueDate'] || invoice.IssueDate || '';
  
  // Format date to DD,MM,YYYY or DD/MM/YYYY
  let formattedDate = issueDateRaw;
  if (issueDateRaw && issueDateRaw.includes('-')) {
    const parts = issueDateRaw.split('-');
    if (parts.length === 3) {
      formattedDate = `${parts[2]},${parts[1]},${parts[0]}`;
    }
  }

  // 3. Linii factură
  let rawLines = invoice['cac:InvoiceLine'] || invoice.InvoiceLine || [];
  if (!Array.isArray(rawLines)) {
    rawLines = [rawLines];
  }

  const items = rawLines.map((line, idx) => {
    const name = line['cac:Item']?.['cbc:Name'] || line.Item?.Name || `Articol ${idx + 1}`;
    
    const qtyNode = line['cbc:InvoicedQuantity'] || line.InvoicedQuantity || 1;
    const quantity = typeof qtyNode === 'object' ? parseFloat(qtyNode['#text'] || 1) : parseFloat(qtyNode || 1);
    const unitCode = typeof qtyNode === 'object' ? qtyNode['@_unitCode'] : 'H87';
    
    const priceNode = line['cac:Price']?.['cbc:PriceAmount'] || line.Price?.PriceAmount || 0;
    const unitPrice = typeof priceNode === 'object' ? parseFloat(priceNode['#text'] || 0) : parseFloat(priceNode || 0);

    const valNode = line['cbc:LineExtensionAmount'] || line.LineExtensionAmount || (quantity * unitPrice);
    const totalWithoutVat = typeof valNode === 'object' ? parseFloat(valNode['#text'] || 0) : parseFloat(valNode || 0);

    return {
      id: idx + 1,
      name: String(name).trim(),
      um: mapUnitCode(unitCode),
      quantity: Number(quantity.toFixed(4)),
      unitPrice: Number(unitPrice.toFixed(4)),
      totalWithoutVat: Number(totalWithoutVat.toFixed(4)),
      selected: true // By default, included in NIR
    };
  });

  return {
    supplierName: cleanSupplierName(supplierName),
    invoiceNumber: cleanInvoiceNumber(invoiceNumber),
    invoiceDate: formattedDate,
    items
  };
}

export function cleanSupplierName(raw) {
  if (!raw) return '';
  return raw.replace(/S\.R\.L\.|SRL|S\.C\.|SC/gi, '').trim();
}

export function cleanInvoiceNumber(raw) {
  if (!raw) return '';
  return raw.trim();
}
