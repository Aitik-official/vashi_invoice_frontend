import * as XLSX from 'xlsx';

export interface InvoiceTableRow {
  date: string;
  show: number;
  aud: number;
  collection: number;
  deduction: string;
  deductionAmt: number;
}

export interface InvoiceData {
  clientName: string;
  clientAddress: string;
  panNo: string;
  gstinNo: string;
  property: string;
  centre: string;
  placeOfService: string;
  table: InvoiceTableRow[];
  totalShow: number;
  totalAud: number;
  totalCollection: number;
  showTax: number;
  otherDeduction: number;
}

function normalizeHeader(header: string) {
  return (header || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Helper: extract date from column header, e.g. "23-05 SHOW" => "23-05"
function extractDateFromHeader(header: string): string | null {
  const match = header.match(/^([0-9]{2}-[0-9]{2})/);
  return match ? match[1] : null;
}

export function parseInvoiceExcel(file: File): Promise<InvoiceData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Find header row (the one with "BILL TO", "ADDRESS", etc.)
      const headerRowIdx = json.findIndex(row => row.some((cell: string) => normalizeHeader(cell) === 'bill to'));
      const headerRow = json[headerRowIdx];
      const headerRowNorm = headerRow.map(normalizeHeader);
      const dataRows = json.slice(headerRowIdx + 1);

      // Find indices for client/cinema details
      const billToIdx = headerRowNorm.findIndex(h => h === 'bill to');
      const addressIdx = headerRowNorm.findIndex(h => h === 'address');
      const panNoIdx = headerRowNorm.findIndex(h => h === 'pan no.');
      const gstNoIdx = headerRowNorm.findIndex(h => h === 'gst number');
      const cinemaNameIdx = headerRowNorm.findIndex(h => h === 'cinema name');
      const centreIdx = headerRowNorm.findIndex(h => h === 'centre');
      const placeOfServiceIdx = headerRowNorm.findIndex(h => h === 'place of service');

      // Find indices for totals and deductions
      const totalShowIdx = headerRowNorm.findIndex(h => h.includes('total show'));
      const totalAudIdx = headerRowNorm.findIndex(h => h.includes('total audie'));
      const totalCollectionIdx = headerRowNorm.findIndex(h => h.includes('total collec'));
      const showTaxIdx = headerRowNorm.findIndex(h => h.includes('show tax'));
      const otherDeductionIdx = headerRowNorm.findIndex(h => h.includes('others'));

      // Find all day columns (grouped by date)
      const dayGroups: { date: string; showIdx: number; audIdx: number; collIdx: number }[] = [];
      for (let i = 0; i < headerRowNorm.length; i++) {
        const dateMatch = headerRowNorm[i].match(/^([0-9]{2}-[0-9]{2})/);
        if (dateMatch) {
          const date = dateMatch[1];
          const showIdx = i;
          const audIdx = i + 1;
          const collIdx = i + 2;
          dayGroups.push({ date, showIdx, audIdx, collIdx });
          i += 2;
        }
      }

      // Map each cinema row
      const mapped: InvoiceData[] = dataRows
        .filter(row => row[billToIdx]) // skip empty rows
        .map(row => ({
          clientName: row[billToIdx] || '',
          clientAddress: row[addressIdx] || '',
          panNo: row[panNoIdx] || '',
          gstinNo: row[gstNoIdx] || '',
          property: row[cinemaNameIdx] || '',
          centre: row[centreIdx] || '',
          placeOfService: row[placeOfServiceIdx] || '',
          table: dayGroups.map(day => ({
            date: day.date,
            show: Number(row[day.showIdx]) || 0,
            aud: Number(row[day.audIdx]) || 0,
            collection: Number(row[day.collIdx]) || 0,
            deduction: '',
            deductionAmt: 0
          })),
          totalShow: Number(row[totalShowIdx]) || 0,
          totalAud: Number(row[totalAudIdx]) || 0,
          totalCollection: Number(row[totalCollectionIdx]) || 0,
          showTax: Number(row[showTaxIdx]) || 0,
          otherDeduction: Number(row[otherDeductionIdx]) || 0
        }));

      resolve(mapped);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
} 