import * as XLSX from 'xlsx';

// Helper: extract date from column header, e.g. "23-05 SHOW" => "23-05"
function extractDateFromHeader(header) {
  const match = header.match(/^([0-9]{2}-[0-9]{2})/);
  return match ? match[1] : null;
}

export function parseInvoiceExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Find header row (the one with "BILL TO", "ADDRESS", etc.)
      const headerRowIdx = json.findIndex(row => row.includes('BILL TO'));
      const headerRow = json[headerRowIdx];
      const dataRows = json.slice(headerRowIdx + 1);

      // Find indices for client/cinema details
      const billToIdx = headerRow.findIndex(h => h === 'BILL TO');
      const addressIdx = headerRow.findIndex(h => h === 'ADDRESS');
      const panNoIdx = headerRow.findIndex(h => h === 'PAN NO.');
      const gstNoIdx = headerRow.findIndex(h => h === 'GST NUMBER');
      const cinemaNameIdx = headerRow.findIndex(h => h === 'CINEMA NAME');
      const centreIdx = headerRow.findIndex(h => h === 'CENTRE');
      const placeOfServiceIdx = headerRow.findIndex(h => h === 'PLACE OF SERVICE');

      // Find indices for totals and deductions
      const totalShowIdx = headerRow.findIndex(h => h && h.toString().toUpperCase().includes('TOTAL SHOW'));
      const totalAudIdx = headerRow.findIndex(h => h && h.toString().toUpperCase().includes('TOTAL AUDIE'));
      const totalCollectionIdx = headerRow.findIndex(h => h && h.toString().toUpperCase().includes('TOTAL COLLEC'));
      const showTaxIdx = headerRow.findIndex(h => h && h.toString().toUpperCase().includes('SHOW TAX'));
      const otherDeductionIdx = headerRow.findIndex(h => h && h.toString().toUpperCase().includes('OTHERS'));

      // Find all day columns (grouped by date)
      const dayGroups = [];
      for (let i = 0; i < headerRow.length; i++) {
        const date = extractDateFromHeader(headerRow[i] || '');
        if (date) {
          // Find the three columns for this date
          const showIdx = i;
          const audIdx = i + 1;
          const collIdx = i + 2;
          dayGroups.push({
            date,
            showIdx,
            audIdx,
            collIdx
          });
          i += 2; // skip next two columns
        }
      }

      // Map each cinema row
      const mapped = dataRows
        .filter(row => row[billToIdx]) // skip empty rows
        .map(row => ({
          clientName: row[billToIdx],
          clientAddress: row[addressIdx],
          panNo: row[panNoIdx],
          gstinNo: row[gstNoIdx],
          property: row[cinemaNameIdx],
          centre: row[centreIdx],
          placeOfService: row[placeOfServiceIdx],
          table: dayGroups.map(day => ({
            date: day.date,
            show: Number(row[day.showIdx]) || 0,
            aud: Number(row[day.audIdx]) || 0,
            collection: Number(row[day.collIdx]) || 0,
            deduction: '', // You can add logic here if you want to show a deduction for a specific day
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