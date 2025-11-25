import React, { useRef, useState, useEffect } from "react";
import { generateStandardizedPDF } from "../utils/pdfGenerator";
import { parseMarathiNumber, englishToMarathi } from "../utils/marathiDigits";
import { convertToMarathi, convertNumbersToMarathi, convertToMarathiAsync } from "../utils/marathiTransliteration";

// Expected data structure for each cinema row (from Excel):
// {
//   clientName: string,
//   clientAddress: string,
//   panNo: string,
//   gstinNo: string,
//   property: string,
//   centre: string,
//   placeOfService: string,
//   ...
//   table: [
//     {
//       date: string, // e.g. '28-05-2025'
//       show: number,
//       aud: number,
//       collection: number
//     },
//     ...
//   ],
//   totalShow: number, // from TOTAL column
//   totalAud: number, // from TOTAL column
//   totalCollection: number, // from TOTAL column
//   showTax: number, // from DEDUCTIONS column
//   otherDeduction: number, // from DEDUCTIONS column
//   ...
// }
// The component will use these fields for all calculations and display.

// Helper to convert number to words (simple, for INR)
function numberToWords(num: number) {
  if (isNaN(num)) return "";
  if (num === 0) return "Zero";
  if (num > 999999999) return "Amount too large";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function inWords(n: number): string {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)];
      if (n % 10) str += " " + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }
  let crore = Math.floor(num / 10000000);
  let lakh = Math.floor((num / 100000) % 100);
  let thousand = Math.floor((num / 1000) % 100);
  let hundred = Math.floor((num / 100) % 10);
  let rest = Math.floor(num % 100);
  let result = "";
  if (crore) result += inWords(crore) + " Crore ";
  if (lakh) result += inWords(lakh) + " Lakh ";
  if (thousand) result += inWords(thousand) + " Thousand ";
  if (hundred) result += a[hundred] + " Hundred ";
  if (rest) {
    if (result !== "") result += "and ";
    result += inWords(rest) + " ";
  }
  return result.trim();
}
function amountToWordsWithPaise(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = numberToWords(rupees);
  if (words) words += ' Rupees';
  if (paise > 0) words += ' and ' + numberToWords(paise) + ' Paise';
  words += ' only';
  return words;
}

// Calculation helpers
const safeNumber = (val: any) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
  return 0;
};

interface InvoiceData {
  clientName?: string;
  clientAddress?: string;
  panNo?: string;
  gstinNo?: string;
  property?: string;
  placeOfService?: string;
  businessTerritory?: string;
  invoiceNo?: string;
  "Invoice No"?: string; // Add Excel column name
  "In_no"?: string; // Add Excel "In_no" column name
  invoiceDate?: string;
  movieName?: string;
  movieVersion?: string;
  language?: string;
  screenFormat?: string;
  reels?: string;
  week?: string;
  releaseWeek?: string;
  cinemaWeek?: string;
  screeningFrom?: string;
  screeningTo?: string;
  screeningDateFrom?: string;
  screeningDateTo?: string;
  hsnSacCode?: string;
  description?: string;
  distributionPercent?: string;
  table?: any[];
  showTax?: string | number;
  totalTaxableAmount?: string;
  cgst?: string;
  sgst?: string;
  netAmount?: string;
  amountWords?: string;
  remark?: string;
  terms?: string[];
  signatory?: string;
  regNo?: string;
  firmName?: string;
  address?: string;
  gst?: string;
  pan?: string;
  email?: string;
  particulars?: any[];
  centre?: string;
  cgstRate?: string; // Added for calculation
  sgstRate?: string; // Added for calculation
  taxType?: 'GST' | 'IGST'; // GST or IGST selector
  gstRate?: string; // User input for GST/IGST rate
  totalShow?: string | number;
  totalAud?: string | number;
  totalCollection?: string | number;
  otherDeduction?: string | number;
  gstType?: 'CGST/SGST' | 'IGST'; // Added for GST/IGST selector
  share?: string | number; // Added for distribution percent
  // Direct-entry Marathi invoice specific fields
  mrRaRa?: string;
  place?: string;
  to?: string;
  chequeDraftNo?: string;
  received?: string;
  deposit?: string;
  raRaNo?: string;
}

// Display Names Configuration - Maps variable names to display names
export const DISPLAY_NAMES = {
  // Header fields
  date: 'तारीख',
  invoiceDate: 'Date',
  invoiceNo: 'पावती क्र.',
  'In_no': 'पावती क्र. ',
  
  // Recipient/Sender fields
  mrRaRa: 'श्री. रा. रा.',
  place: 'मु.',
  to: 'यांसी',
  chequeDraftNo: 'चे डाग',
  received: 'आले ते मिळाले.',
  deposit: 'जमा',
  raRaNo: 'Ra. Ra. No./Mo. No.',
  
  // Table headers - Left table
  rs: 'रुपये',
  paise: 'पैसे',
  detailsOfGoods: 'मालाचा तपशील',
  item: 'Item',
  piece: 'नग',
  weight: 'वजन',
  crates: 'डाग',
  perUnitPrice: 'दर',
  rate: 'Rate',
  
  // Table headers - Right table
  detailsOfExpenses: 'खर्चाचा तपशील',
  totalExpenses: 'एकुण खर्च',
  amount: 'रक्कम',
  
  // Expense types
  commission: 'कमिशन',
  porterage: 'हमाली तोलाई लेव्ही',
  carRental: 'मोटर भाडे',
  bundleExpenses: 'बंडल खर्च',
  hundekariExpenses: 'हुंडेकरी खर्च',
  spaceRent: 'जागा भाडे',
  warai: 'वाराई',
  otherExpenses: 'इतर खर्च',
  
  // Totals
  totalSales: 'एकुण विक्री',
  expenses: 'खर्च वजा',
  netBalance: 'नक्की शिल्लक',
  grandTotal: 'नक्की शिल्लक',
  
  // Terms and conditions
  salesSlipSent: 'येणेप्रमाणे मालाची विक्री करून पट्टी पाठविली आहे, तपासून घेणे.',
  amountOfSlip: 'सदरहू पट्टीचे पैसे श्री.',
  toBeCollected: 'मुं.',
  ifNotReceived: 'यांजकडून घेणे . नं मिळाल्यास आठ दिवसांचे आत कळविणे.',
  noComplaints: 'नंतर तक्रार चालणार नाही.',
  thanks: 'सहकार्याबद्दल धन्यवाद!',
  
  // Errors and signature
  errorsOmissions: '(चुक भुलं देणे घेणे )',
  yoursSincerely: 'आपले नम्र ,',
  signatureName: 'श्री. मच्छिंद्र बबन भास्कर',
  
  // Other text
  salesDetails: 'त्याचे विक्री चे तपशील खालीलप्रमाणे आहे.',
  loveGreetings: 'सप्रेम नमस्कार विनंती विशेष आज रोजी आपले रे. र. नं. / मो.नं.',
};

const InvoicePreview = ({ data = {} as InvoiceData, showDownloadButton = true, isPdfExport = false }) => {

  const previewRef = useRef<HTMLDivElement>(null);

  // ONLY use Excel "In_no" field, nothing else
  const displayInvoiceNo = (() => {
    // ONLY use the Excel "In_no" field, nothing else
    if (data?.["In_no"] && typeof data["In_no"] === 'string' && data["In_no"].trim()) {
      const excelInvoiceNo = data["In_no"].trim();
      console.log('InvoicePreview: Found Excel "In_no":', excelInvoiceNo);
      return convertToMarathi(excelInvoiceNo);
    }
    
    // If "In_no" is not found, return placeholder
    console.warn('InvoicePreview: Excel "In_no" field not found');
    console.log('InvoicePreview: Available fields:', Object.keys(data || {}));
    return 'No "In_no" Found';
  })();
  
  // Double-check: if somehow a backend invoice number got through, don't display it
  if (displayInvoiceNo && displayInvoiceNo.toString().startsWith('INV')) {
    console.error('BACKEND INVOICE NUMBER DETECTED IN INVOICE PREVIEW:', displayInvoiceNo);
    // return 'INVALID - Backend Number Detected';
  }
  
  // Fallbacks for static values (use blank/null for new fields)
  const clientName = data?.clientName ?? "AMBUJA REALITY DEVELOPMENT LIMITED";
  const clientAddress = data?.clientAddress ?? "1ST FLOOR, AMBUJA CITY CENTER MALL, VIDHAN SABHA ROAD\nSADDU, RAIPUR, CHHATISGARH";
  const panNo = data?.panNo ?? "AAFCA4593G";
  const gstinNo = data?.gstinNo ?? "22AAFCA4593G1ZT";
  const property = data?.property ?? "City Center";
  const centre = data?.centre ?? "RAIPUR";
  const placeOfService = data?.placeOfService ?? "CHHATISGARH";
  const businessTerritory = data?.businessTerritory ?? "CI";
  
  const invoiceDate = data?.invoiceDate ?? "23/06/2025";
  const movieName = data?.movieName ?? "NARIVETTA";
  const movieVersion = data?.movieVersion ?? "2D";
  const language = data?.language ?? "HINDI";
  const screenFormat = data?.screenFormat ?? "";
  const week = data?.week ?? data?.releaseWeek ?? "1";
  const cinemaWeek = data?.cinemaWeek ?? "1";
  const screeningFrom = data?.screeningFrom ?? "01/08/2025";
  const screeningTo = data?.screeningTo ?? "07/08/2025";
  const screeningDateFrom = data?.screeningDateFrom ?? screeningFrom;
  const screeningDateTo = data?.screeningDateTo ?? screeningTo;
  const hsnSacCode = data?.hsnSacCode ?? "997332";
  const description = data?.description ?? "Theatrical Exhibition Rights";
  const distributionPercent = safeNumber(data?.share ?? data?.distributionPercent ?? 45);
  const gstType = data?.gstType ?? 'IGST';
  const gstRate = safeNumber(data?.gstRate ?? 0);
  const table = data?.table ?? [];
  const showTax = data?.showTax ?? 1200;
  const otherDeduction = data?.otherDeduction ?? 120;
  const totalShow = data?.totalShow ?? 0;
  const totalAud = data?.totalAud ?? 0;
  const totalCollection = data?.totalCollection ?? 0;
  const cgstRate = data?.cgstRate ?? "9";
  const sgstRate = data?.sgstRate ?? "9";
  const taxType = data?.taxType ?? "GST";
  const remark = data?.remark ?? "";
  const terms = data?.terms ?? [];
  const signatory = data?.signatory ?? "For FIRST FILM STUDIOS LLP";
  const regNo = data?.regNo ?? "ACH-2259";
  const firmName = data?.firmName ?? "FIRST FILM STUDIOS LLP";
  const address = data?.address ?? "26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA, KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA";
  const gst = data?.gst ?? "27AAJFF7915J1Z1";
  const pan = data?.pan ?? "AAJFF7915J";
  const email = data?.email ?? "info@firstfilmstudios.com";

  // Format screening dates
  const formatDate = (d: string) => {
    if (!d) return "";
    // If already in DD/MM/YYYY or DD-MM-YYYY, return as is
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(d)) return d.replace(/\//g, '-');
    // If in YYYY-MM-DD, convert to DD-MM-YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split("-");
      return `${day}-${m}-${y}`;
    }
    return d;
  };

  // Generate dates from screening start to end date in DD-MM-YYYY format
  const generateDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return [];
    
    // Parse dates in DD/MM/YYYY format
    const parseDate = (dateStr: string) => {
      const sanitized = dateStr.replace(/-/g, '/');
      const [day, month, year] = sanitized.split('/');
      if (year && month && day) {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return new Date(dateStr); // fallback
    };
    
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      dates.push(`${day}-${month}-${year}`); // Keep format consistent
    }
    
    return dates;
  };

  // Use table from Excel data
  const originalTableRows = Array.isArray(table) ? table : [];

  // Generate table rows with proper date format - show ALL days between screening dates
  const generateTableRows = (): Array<{date: string; show: number; aud: number; collection: number;}> => {
    const dateRange = generateDateRange(screeningDateFrom || screeningFrom, screeningDateTo || screeningTo);
    
    if (dateRange.length === 0 && originalTableRows.length > 0) {
      return originalTableRows.map(row => ({...row, date: formatDate(row.date)}));
    }
    
    // Create a map of existing data by date for quick lookup
    const existingDataMap = new Map();
    if (Array.isArray(originalTableRows)) {
      originalTableRows.forEach(row => {
        if (row && row.date) {
          existingDataMap.set(formatDate(row.date), row);
        }
      });
    }
    
    // Create new table rows with ALL dates between screening dates
    return dateRange.map((date) => {
      // Check if we have existing data for this date
      const existingRow = existingDataMap.get(date);
      
      return {
        date: date,
        show: existingRow?.show || 0,
        aud: existingRow?.aud || 0,
        collection: existingRow?.collection || 0,
      };
    });
  };

  // PDF Export using standardized PDF generator
  const handleDownloadPDF = async () => {
    try {
      const filename = displayInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${displayInvoiceNo}.pdf`;
      
      const { data: pdfData } = await generateStandardizedPDF(
        <InvoicePreview data={{ ...data, invoiceNo: displayInvoiceNo }} showDownloadButton={false} isPdfExport={true} />,
        filename
      );
      
      // Create blob and download
      const blob = new Blob([pdfData.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const tableRows = generateTableRows();

  const calculatedTotalShow = tableRows.reduce((sum, row) => sum + safeNumber(row.show), 0);
  const calculatedTotalAud = tableRows.reduce((sum, row) => sum + safeNumber(row.aud), 0);
  const calculatedTotalCollection = tableRows.reduce((sum, row) => sum + safeNumber(row.collection), 0);
  
  const totalShowVal = calculatedTotalShow || safeNumber(totalShow) || 7;
  const totalAudVal = calculatedTotalAud || safeNumber(totalAud) || 20;
  const totalCollectionVal = calculatedTotalCollection || safeNumber(totalCollection) || 4175.11;
  
  const showTaxVal = safeNumber(showTax);
  const otherDeductionVal = safeNumber(otherDeduction);
  const totalDeduction = showTaxVal + otherDeductionVal;
  
  const netCollection = totalCollectionVal - totalDeduction;

  const distPercent = safeNumber(distributionPercent) || 45;
  const distConsideration = netCollection * (distPercent / 100);
  const taxableAmount = distConsideration;

  let cgstRateNum = 0, sgstRateNum = 0, igstRateNum = 0;
  let cgstVal = 0, sgstVal = 0, igstVal = 0, netAmountVal = 0;
  if (gstType === 'IGST') {
    igstRateNum = gstRate;
    igstVal = +(taxableAmount * (igstRateNum / 100)).toFixed(2);
    netAmountVal = +(taxableAmount + igstVal).toFixed(2);
  } else {
    cgstRateNum = gstRate / 2;
    sgstRateNum = gstRate / 2;
    cgstVal = +(taxableAmount * (cgstRateNum / 100)).toFixed(2);
    sgstVal = +(taxableAmount * (sgstRateNum / 100)).toFixed(2);
    netAmountVal = +(taxableAmount + cgstVal + sgstVal).toFixed(2);
  }

  const amountInWords = amountToWordsWithPaise(netAmountVal);

  const goodsTable = Array.isArray((data as any)?.goodsTable) ? (data as any).goodsTable : [];
  const expensesFromData = Array.isArray((data as any)?.expenses) ? (data as any).expenses : [];

  const parseAmountToNumber = (row: any) => {
    if (!row) return 0;
    if (row.amount !== undefined && row.amount !== null && row.amount !== '') {
      // Handle Marathi digits in amount
      const amountNumber = parseMarathiNumber(String(row.amount));
      return amountNumber;
    }
    if (row.rs !== undefined || row.paise !== undefined) {
      const rs = parseMarathiNumber(String(row.rs || '0'));
      const paise = parseMarathiNumber(String(row.paise || '0'));
      return rs + paise / 100;
    }
    return 0;
  };

  const formatCurrencyValue = (value: number) => {
    if (!value && value !== 0) return '';
    const formatted = value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return englishToMarathi(formatted);
  };

  const formatRowAmount = (row: any) => {
    const amountNumber = parseAmountToNumber(row);
    if (!amountNumber && amountNumber !== 0) return '';
    const formatted = amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return englishToMarathi(formatted);
  };

  const goodsRowCount = 13;
  const goodsRows = Array.from({ length: goodsRowCount }, (_, index) => goodsTable[index] || {});

  // Calculate total expenses from expenses data
  const calculateTotalExpensesFromData = () => {
    let totalPaise = 0;
    // Check if expenses array exists
    if (Array.isArray((data as any)?.expenses)) {
      (data as any).expenses.forEach((exp: any) => {
        const rs = parseMarathiNumber(String(exp.rs || '0'));
        const paise = parseMarathiNumber(String(exp.paise || '0'));
        totalPaise += (rs * 100) + paise;
      });
    } else {
      // Fallback: calculate from individual expense fields
      for (let i = 0; i < 8; i++) {
        const rs = parseMarathiNumber(String((data as any)[`expense${i}_rs`] || '0'));
        const paise = parseMarathiNumber(String((data as any)[`expense${i}_paise`] || '0'));
        totalPaise += (rs * 100) + paise;
      }
    }
    return totalPaise / 100;
  };

  const goodsTotalAmount = goodsTable.reduce((sum: number, row: any) => sum + parseAmountToNumber(row), 0);
  const totalDeductionAmount = calculateTotalExpensesFromData();
  const goodsNetAmount = goodsTotalAmount - totalDeductionAmount;

  const rowHeight = 22;
  const baseCellStyle = {
    height: rowHeight,
    boxSizing: 'border-box' as const,
    lineHeight: `${rowHeight}px`,
    paddingTop: 0,
    paddingBottom: 0,
  };
  const centerCellStyle = { ...baseCellStyle, padding: '0 2px', textAlign: 'center' as const };
  const rightCellStyle = { ...baseCellStyle, padding: '0 4px', textAlign: 'right' as const };
  const leftCellStyle = { ...baseCellStyle, padding: '0 4px', textAlign: 'left' as const };


  return (
    <div>
      {showDownloadButton && (
        <button
          onClick={handleDownloadPDF}
          className="mb-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition font-semibold text-sm"
          type="button"
        >
          Download PDF
        </button>
      )}
      <div
        ref={previewRef}
        className="w-[800px] mx-auto bg-white shadow-lg text-black"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1130px', boxSizing: 'border-box', padding: 0 }}
      >
        {/* Header - Single Image replacing logo and company details - aligned with inner content width */}
        <div style={{ width: '100%', margin: 0, padding: '1rem 1rem 0 1rem', boxSizing: 'border-box' }}>
          <img 
            src="/inovice_formatting/baban.jpg" 
            alt="Invoice Header" 
            style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0 }} 
          />
        </div>

        {/* Main Content Box - New Layout Matching Image */}
        <div style={{ width: '100%', padding: '1rem', paddingTop: '0.5rem', fontSize: '16px' }}>
          {/* Top Header Section */}
          <div style={{ border: '2px solid #1f4fb9', padding: '8px', marginBottom: '0.25rem', backgroundColor: '#f2eed3' }}>
            {/* Top Right - Date */}
            <div style={{ textAlign: 'right', marginBottom: '8px' }}>
              <span style={{ paddingRight: '40px', display: 'inline-block', fontSize: '16px' }}><span style={{ color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.date}:</span> <span style={{ fontSize: '16px' }}>{convertToMarathi(invoiceDate || '')}</span></span>
            </div>
            
              {/* Recipient/Sender Details Section */}
              <div style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                {/* First Line - Mr. Ra. Ra., Place, To + values from data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#1670b5', fontSize: '16px', fontWeight: '500', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.mrRaRa}</span>
                  <span style={{ borderBottom: '1px solid #1f4fb9', width: '100px', minHeight: '20px', display: 'inline-block', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convertToMarathi(data?.mrRaRa || '')}
                  </span>
                  <span style={{ color: '#1670b5', fontSize: '16px', fontWeight: '500', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.place}</span>
                  <span style={{ borderBottom: '1px solid #1f4fb9', width: '80px', minHeight: '20px', display: 'inline-block', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convertToMarathi(data?.place || '')}
                  </span>
                  <span style={{ color: '#1670b5', fontSize: '16px', fontWeight: '500', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.to}</span>
                  <span style={{ borderBottom: '1px solid #1f4fb9', width: '80px', minHeight: '20px', display: 'inline-block', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convertToMarathi(data?.to || '')}
                  </span>
                </div>
                
                {/* Second Line - Mo. No., Cheque/Draft No., Received with values */}
                <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', marginBottom: '8px', lineHeight: '1.6', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.loveGreetings}</span>
                  <span style={{ borderBottom: '1px solid #1f4fb9', flex: 1, minHeight: '20px', marginLeft: '8px', marginRight: '8px', display: 'inline-block', fontSize: '16px' }}>
                    {convertToMarathi(data?.raRaNo || '')}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.chequeDraftNo}</span>
                  <span style={{ borderBottom: '1px solid #1f4fb9', width: '80px', minHeight: '20px', marginLeft: '8px', marginRight: '8px', display: 'inline-block', fontSize: '16px' }}>
                    {convertToMarathi(data?.chequeDraftNo || '')}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.received}</span>
                </div>
                
                {/* Remaining lines */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', lineHeight: '1.6' }}>
                  <div style={{ width: '60%' }}>
                    <div style={{ marginBottom: '4px', color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.salesDetails}</div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '8px', color: '#1670b5', fontSize: '16px', fontWeight: '500' }}>{DISPLAY_NAMES.deposit}:</span>
                      <span style={{ borderBottom: '1px solid #1f4fb9', flex: 1, minHeight: '20px', fontSize: '16px' }}>
                        {convertToMarathi(data?.deposit || '')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
          </div>

          {/* Middle Section - Two Side-by-Side Tables using Grid */}
          <div className="w-full border-2 border-green-700 mb-1" style={{ borderColor: '#1f4fb9' }}>
            <div className="grid grid-cols-12">
              {/* Left Table - Item Details (increased width) */}
              <div className="col-span-8 border-r-2" style={{ borderColor: '#1f4fb9' }}>
                {/* Header Row - 5 columns with integrated Rupees */}
                <div
                  className="grid border-b font-semibold text-center whitespace-nowrap"
                  style={{
                    borderColor: '#1f4fb9',
                    gridTemplateColumns: '3.3fr 0.9fr 0.9fr 1.75fr 2.05fr',
                    backgroundColor: '#035f87',
                    color: '#ffffff',
                    fontSize: '12px'
                  }}
                >
                  <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.detailsOfGoods}</div>
                  <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.crates}</div>
                  <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.weight}</div>
                  <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.perUnitPrice}</div>
                  <div className="p-1" style={{ whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.rs}</div>
                </div>
                {/* Content Rows */}
                {goodsRows.map((row, i) => (
                  <div
                    key={i}
                    className="grid border-b text-center"
                    style={{
                      borderColor: '#1f4fb9',
                      gridTemplateColumns: '3.3fr 0.9fr 0.9fr 1.75fr 2.05fr',
                      backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', textAlign: 'left', backgroundColor: '#f2eed3', fontSize: '16px' }}>{convertToMarathi(row?.details || row?.detailsOfGoods || '')}</div>
                    <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#d9d6e0', fontSize: '16px' }}>{convertToMarathi(row?.crates || '')}</div>
                    <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#f2eed3', fontSize: '16px' }}>{convertToMarathi(row?.piece || '')}</div>
                    <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#d9d6e0', fontSize: '16px' }}>{convertToMarathi(row?.price || '')}</div>
                    <div className="p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#f2eed3', fontSize: '16px' }}>{formatRowAmount(row)}</div>
                  </div>
                ))}
                
                {/* Left Table - Totals Section */}
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                  {/* Overlay for Column 1 - Matches Details of Goods column color */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '37.059%', // 3.3fr / (3.3 + 0.9 + 0.9 + 1.75 + 2.05)fr = 3.3/8.9 = 37.059%
                      bottom: 0,
                      backgroundColor: '#f2eed3',
                      zIndex: 10,
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px'
                    }}
                  >
                    {/* Grand Total Box - Reduced Width */}
                    <div data-pdf-shift="true" style={{ width: '90%', maxWidth: '250px', position: 'relative', zIndex: 11 }}>
                      {/* Net Balance Title - Red, Bold - Increased Size */}
                      <div data-pdf-shift="true" style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626', marginBottom: '6px', textAlign: 'center' }}>
                        {DISPLAY_NAMES.netBalance}
                      </div>
                      
                      {/* Grand Total Box with Red Circle and Amount */}
                      <div 
                        data-pdf-shift="true"
                        style={{ 
                          border: '1px solid #dc2626', 
                          borderRadius: '4px',
                          width: '100%',
                          height: '50px',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          padding: '6px 10px',
                          backgroundColor: '#fefefe',
                          position: 'relative',
                          gap: '10px'
                        }}
                      >
                        {/* Red Circle with Rupee Symbol */}
                        <div
                          data-pdf-shift="true"
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            position: 'relative',
                            zIndex: 2
                          }}
                        >
                          <img 
                            src="/inovice_formatting/rupee_sym.png" 
                            alt="₹" 
                            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                          />
                        </div>
                        
                        {/* Amount Display - Black text, centered, slightly overlapping circle */}
                        <div
                          data-pdf-shift="true"
                          style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#000000',
                            marginLeft: '-6px',
                            flex: 1,
                            minHeight: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {formatCurrencyValue(goodsNetAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Sales Row */}
                  <div
                    className="grid border-t-2 border-b font-semibold"
                    style={{ borderColor: '#1f4fb9', backgroundColor: '#c1e4ff', gridTemplateColumns: '3.3fr 0.9fr 0.9fr 1.75fr 2.05fr', position: 'relative', fontSize: '14px', minHeight: '50px' }}
                  >
                    <div className="border-r p-2" style={{ borderColor: '#1f4fb9', borderBottomColor: '#c1e4ff', gridColumn: '1', backgroundColor: '#f2eed3', minHeight: '50px', display: 'flex', alignItems: 'center' }}></div>
                    <div className="border-r p-2 text-left font-semibold" style={{ borderColor: '#1f4fb9', gridColumn: '2 / 4', minHeight: '50px', display: 'flex', alignItems: 'center' }}>{DISPLAY_NAMES.totalSales}</div>
                    <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', gridColumn: '4 / 6', fontSize: '16px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{formatCurrencyValue(goodsTotalAmount)}</div>
                  </div>
                  {/* Expenses Row */}
                  <div
                    className="grid border-b font-semibold"
                    style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3', gridTemplateColumns: '3.3fr 0.9fr 0.9fr 1.75fr 2.05fr', position: 'relative', fontSize: '14px', minHeight: '50px' }}
                  >
                    <div className="border-r p-2" style={{ borderColor: '#1f4fb9', borderBottomColor: '#f2eed3', gridColumn: '1', backgroundColor: '#f2eed3', minHeight: '50px', display: 'flex', alignItems: 'center' }}></div>
                    <div className="border-r p-2 text-left font-semibold" style={{ borderColor: '#1f4fb9', gridColumn: '2 / 4', minHeight: '50px', display: 'flex', alignItems: 'center' }}>{DISPLAY_NAMES.expenses}</div>
                    <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', gridColumn: '4 / 6', fontSize: '16px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{formatCurrencyValue(totalDeductionAmount)}</div>
                  </div>
                  {/* Net Balance Row */}
                  <div
                    className="grid border-b font-bold"
                    style={{ borderColor: '#1f4fb9', backgroundColor: '#d9d6e0', gridTemplateColumns: '3.3fr 0.9fr 0.9fr 1.75fr 2.05fr', position: 'relative', fontSize: '14px', minHeight: '50px' }}
                  >
                    <div className="border-r p-2" style={{ borderColor: '#1f4fb9', gridColumn: '1', backgroundColor: '#f2eed3', minHeight: '50px', display: 'flex', alignItems: 'center' }}></div>
                    <div className="border-r p-2 text-left font-bold" style={{ borderColor: '#1f4fb9', gridColumn: '2 / 4', minHeight: '50px', display: 'flex', alignItems: 'center' }}>{DISPLAY_NAMES.netBalance}</div>
                    <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', gridColumn: '4 / 6', fontSize: '16px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{formatCurrencyValue(goodsNetAmount)}</div>
                  </div>
                </div>
              </div>

              {/* Right Table - Expenses (reduced width) */}
              <div className="col-span-4" style={{ backgroundColor: '#f2eed3' }}>
                {/* Header Row - 2 columns: Details (50%) and Amount (50%) */}
                <div className="grid border-b font-semibold whitespace-nowrap" style={{ borderColor: '#1f4fb9', backgroundColor: '#035f87', color: '#ffffff', gridTemplateColumns: '10fr 10fr', fontSize: '12px' }}>
                  <div className="border-r p-1" style={{ borderLeft: '1px solid #ffffff', borderRight: '1px solid #1f4fb9', whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff', textAlign: 'left' }}>{DISPLAY_NAMES.detailsOfExpenses}</div>
                  <div className="p-1" style={{ whiteSpace: 'nowrap', backgroundColor: '#035f87', color: '#ffffff', textAlign: 'center' }}>{DISPLAY_NAMES.amount}</div>
                </div>
                {/* Expense Rows - Matching height with left table (10 rows total) */}
                {[DISPLAY_NAMES.commission, DISPLAY_NAMES.porterage, DISPLAY_NAMES.carRental, DISPLAY_NAMES.bundleExpenses, DISPLAY_NAMES.hundekariExpenses, DISPLAY_NAMES.spaceRent, DISPLAY_NAMES.warai, DISPLAY_NAMES.otherExpenses].map((expense, idx) => {
                  const expRow = expensesFromData[idx] || {};
                  // Combine Rs and Paise into decimal amount
                  const rs = parseMarathiNumber(String(expRow.rs || '0'));
                  const paise = parseMarathiNumber(String(expRow.paise || '0'));
                  const combinedAmount = rs + (paise / 100);
                  const amountText = combinedAmount > 0 ? formatCurrencyValue(combinedAmount) : '';
                  return (
                  <div key={idx} className="grid border-b" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3', gridTemplateColumns: '10fr 10fr', fontSize: '16px' }}>
                    <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#c1e4ff', textAlign: 'center' }}>{expense}</div>
                  <div className="p-1 text-right" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#f2eed3' }}>{amountText}</div>
                  </div>
                  );
                })}
                {/* Additional empty rows to match left table (10 rows total) */}
                {Array(2).fill(0).map((_, i) => {
                  return (
                    <div key={`empty-${i}`} className="grid border-b" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3', gridTemplateColumns: '10fr 10fr', fontSize: '16px' }}>
                      <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '24px', backgroundColor: '#c1e4ff', textAlign: 'center' }}></div>
                      <div className="p-1" style={{ minHeight: '24px', backgroundColor: '#f2eed3' }}></div>
                    </div>
                  );
                })}
                
                {/* Right Table - Professional Totals Section */}
                <div className="grid border-t-2 font-semibold" style={{ borderColor: '#1f4fb9', backgroundColor: '#f9fafb', gridTemplateColumns: '10fr 10fr', fontSize: '14px' }}>
                  <div className="border-r p-2 text-left" style={{ borderColor: '#1f4fb9' }}>{DISPLAY_NAMES.totalSales}</div>
                  <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', fontSize: '16px' }}>
                    {formatCurrencyValue(goodsTotalAmount)}
                  </div>
                </div>
                <div className="grid border-b font-semibold" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3', gridTemplateColumns: '10fr 10fr', fontSize: '14px' }}>
                  <div className="border-r p-2 text-left" style={{ borderColor: '#1f4fb9' }}>{DISPLAY_NAMES.expenses}</div>
                  <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', fontSize: '16px' }}>
                    {formatCurrencyValue(totalDeductionAmount)}
                  </div>
                </div>
                <div className="grid border-b font-bold" style={{ borderColor: '#1f4fb9', backgroundColor: '#f0f9ff', gridTemplateColumns: '10fr 10fr', fontSize: '14px' }}>
                  <div className="border-r p-2 text-left" style={{ borderColor: '#1f4fb9' }}>{DISPLAY_NAMES.netBalance}</div>
                  <div className="p-2 text-right font-bold" style={{ borderColor: '#1f4fb9', fontSize: '16px' }}>
                    {formatCurrencyValue(goodsNetAmount)}
                  </div>
                </div>
                {/* Horizontal line after Totals */}
                <div className="border-b-2" style={{ borderColor: '#1f4fb9', width: '100%', marginTop: '8px' }}></div>
                {/* Container for Errors and omissions and Thanks text */}
                <div style={{ backgroundColor: '#f2eed3', width: '100%', padding: '8px 0' }}>
                  {/* Errors and omissions text below Totals */}
                  <div className="italic" style={{ textAlign: 'center', padding: '4px 8px', color: '#4821c9', fontSize: '14px' }}>
                    {DISPLAY_NAMES.errorsOmissions}
                  </div>
                  {/* Thanks text below Errors and omissions */}
                  <div style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 'bold', fontSize: '18px', color: '#dc2626' }}>
                    {DISPLAY_NAMES.thanks}
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Combined Bottom Table - Terms, Grand Total, Errors/Signature */}
          <div className="border-2 mb-1" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
            <div className="grid grid-cols-12" style={{ minHeight: '150px' }}>
              {/* Left Side - Terms and Conditions */}
              <div className="col-span-5 p-3" style={{ fontSize: '16px', lineHeight: '1.6', backgroundColor: '#f2eed3' }}>
                <div style={{ marginBottom: '4px', color: '#4821c9', fontSize: '16px' }}>{DISPLAY_NAMES.salesSlipSent}</div>
                <div style={{ marginBottom: '4px', color: '#4821c9', fontSize: '16px' }}>
                  {DISPLAY_NAMES.amountOfSlip}
                  <span style={{ borderBottom: '1px solid #1f4fb9', padding: '0 50px', display: 'inline-block', minWidth: '130px', fontSize: '16px' }}></span>
                </div>
                <div style={{ marginBottom: '4px', color: '#4821c9', fontSize: '16px' }}>
                  {DISPLAY_NAMES.toBeCollected}
                  <span style={{ borderBottom: '1px solid #1f4fb9', padding: '0 35px', display: 'inline-block', minWidth: '90px', marginLeft: '8px', fontSize: '16px' }}></span>
                  .
                </div>
                <div style={{ marginBottom: '4px', color: '#4821c9', fontSize: '16px' }}>{DISPLAY_NAMES.ifNotReceived}</div>
                <div style={{ marginBottom: '4px', color: '#4821c9', fontSize: '16px' }}>{DISPLAY_NAMES.noComplaints}</div>
              </div>

              {/* Center - Empty (Grand Total moved to overlay) */}
              <div className="col-span-2 p-3" style={{ backgroundColor: '#f2eed3' }}></div>

              {/* Right Side - Signature */}
              <div className="col-span-5 p-3 flex flex-col justify-center items-end" style={{ backgroundColor: '#f2eed3', minHeight: '100%' }}>
                <div style={{ marginTop: '20px', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '22px', color: '#dc2626', marginBottom: '8px', textAlign: 'center', width: '100%' }}>{DISPLAY_NAMES.yoursSincerely}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '22px', color: '#dc2626', textAlign: 'right', width: '100%' }}>{DISPLAY_NAMES.signatureName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;