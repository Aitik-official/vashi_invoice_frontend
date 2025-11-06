import React, { useRef } from "react";
import { generateStandardizedPDF } from "../utils/pdfGenerator";

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
  crates: 'डाग',
  perUnitPrice: 'दर',
  rate: 'Rate',
  
  // Table headers - Right table
  detailsOfExpenses: 'खर्चाचा तपशील',
  totalExpenses: 'एकुण खर्च',
  
  // Expense types
  commission: 'कमिशन',
  porterage: 'हमाली तोलाई लेव्ही',
  carRental: 'मोटर भाडे',
  bundleExpenses: 'बंडल खर्च',
  hundekariExpenses: 'हुंडेकरी खर्',
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
      return excelInvoiceNo;
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
        {/* Header - Single Image replacing logo and company details - Full width from top */}
        <div style={{ width: '100%', margin: 0, padding: 0 }}>
          <img 
            src="/inovice_formatting/invoice-header.png" 
            alt="Invoice Header" 
            style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0 }} 
          />
        </div>

        {/* Main Content Box - New Layout Matching Image */}
        <div style={{ width: '100%', padding: '1rem', fontSize: '12px' }}>
          {/* Top Header Section */}
          <div style={{ border: '2px solid #008000', padding: '8px', marginBottom: '1rem' }}>
            {/* Top Right - Date */}
            <div style={{ textAlign: 'right', marginBottom: '8px' }}>
              <span style={{ paddingRight: '40px', display: 'inline-block' }}>{DISPLAY_NAMES.date}: {invoiceDate || ''}</span>
            </div>
            
            {/* Recipient/Sender Details Section */}
            <div style={{ marginBottom: '8px', lineHeight: '1.6' }}>
              {/* First Line - Mr. Ra. Ra., Place, To all in single line with no extra spacing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span>{DISPLAY_NAMES.mrRaRa}</span>
                <span style={{ borderBottom: '1px solid #008000', width: '120px', minHeight: '16px', display: 'inline-block' }}></span>
                <span>{DISPLAY_NAMES.place}</span>
                <span style={{ borderBottom: '1px solid #008000', width: '100px', minHeight: '16px', display: 'inline-block' }}></span>
                <span>{DISPLAY_NAMES.to}</span>
                <span style={{ borderBottom: '1px solid #008000', width: '100px', minHeight: '16px', display: 'inline-block' }}></span>
              </div>
              
              {/* Second Line - All text in single continuous line with blank after Mo. No. and Cheque/Draft No. */}
              <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', marginBottom: '8px', lineHeight: '1.6', width: '100%' }}>
                <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.loveGreetings}</span>
                <span style={{ borderBottom: '1px solid #008000', flex: 1, minHeight: '16px', marginLeft: '8px', marginRight: '8px', display: 'inline-block' }}></span>
                <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.chequeDraftNo}</span>
                <span style={{ borderBottom: '1px solid #008000', width: '100px', minHeight: '16px', marginLeft: '8px', marginRight: '8px', display: 'inline-block' }}></span>
                <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.received}</span>
              </div>
              
              {/* Remaining lines */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', lineHeight: '1.6' }}>
                <div style={{ width: '60%' }}>
                  <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.salesDetails}</div>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>{DISPLAY_NAMES.deposit}:</span>
                    <span style={{ borderBottom: '1px solid #008000', flex: 1, minHeight: '16px' }}></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Section - Two Side-by-Side Tables using Grid */}
          <div className="w-full border-2 border-green-700 mb-4" style={{ borderColor: '#008000' }}>
            <div className="grid grid-cols-12">
              {/* Left Table - Item Details (increased width) */}
              <div className="col-span-8 border-r-2" style={{ borderColor: '#008000' }}>
                {/* Header Row - 7 columns with Per unit price */}
                <div className="grid grid-cols-7 border-b font-semibold text-center text-xs whitespace-nowrap" style={{ borderColor: '#008000' }}>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.rs}</div>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.paise}</div>
                  <div className="col-span-2 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.detailsOfGoods}</div>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.item}</div>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.piece}</div>
                  <div className="col-span-1 p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.perUnitPrice}</div>
                </div>
                {/* Content Rows - Increased rows to utilize blank white space */}
                {Array(13).fill(0).map((_, i) => (
                  <div key={i} className="grid grid-cols-7 border-b text-center" style={{ borderColor: '#008000' }}>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-2 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                  </div>
                ))}
                
                {/* Left Table - Totals Section: Rs. value, Paise value, Parameter names (vertical borders extending to bottom edge) */}
                <div className="grid grid-cols-7 border-t-2 border-b text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}></div>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}></div>
                  <div className="col-span-5 p-2 text-left font-semibold" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.totalSales}</div>
                </div>
                <div className="grid grid-cols-7 border-b text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}></div>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}></div>
                  <div className="col-span-5 p-2 text-left font-semibold" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.expenses}</div>
                </div>
                <div className="grid grid-cols-7 text-xs font-bold" style={{ borderColor: '#008000', backgroundColor: '#f0f9ff' }}>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000', borderBottom: 'none' }}></div>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000', borderBottom: 'none' }}></div>
                  <div className="col-span-5 p-2 text-left font-bold" style={{ borderColor: '#008000', borderBottom: 'none' }}>{DISPLAY_NAMES.netBalance}</div>
                </div>
              </div>

              {/* Right Table - Expenses (reduced width) */}
              <div className="col-span-4">
                {/* Header Row - 3 columns without Per unit price */}
                <div className="grid grid-cols-3 border-b font-semibold text-center text-xs whitespace-nowrap" style={{ borderColor: '#008000' }}>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.detailsOfExpenses}</div>
                  <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.rs}</div>
                  <div className="col-span-1 p-1" style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.paise}</div>
                </div>
                {/* Expense Rows - Matching height with left table (10 rows total) */}
                {[DISPLAY_NAMES.commission, DISPLAY_NAMES.porterage, DISPLAY_NAMES.carRental, DISPLAY_NAMES.bundleExpenses, DISPLAY_NAMES.hundekariExpenses, DISPLAY_NAMES.spaceRent, DISPLAY_NAMES.warai, DISPLAY_NAMES.otherExpenses].map((expense, idx) => (
                  <div key={idx} className="grid grid-cols-3 border-b text-xs" style={{ borderColor: '#008000' }}>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>{expense}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 p-1" style={{ minHeight: '22px' }}></div>
                  </div>
                ))}
                {/* Additional empty rows to match left table (10 rows total) */}
                {Array(2).fill(0).map((_, i) => (
                  <div key={`empty-${i}`} className="grid grid-cols-3 border-b text-xs" style={{ borderColor: '#008000' }}>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}></div>
                    <div className="col-span-1 p-1" style={{ minHeight: '22px' }}></div>
                  </div>
                ))}
                
                {/* Right Table - Professional Totals Section */}
                <div className="grid grid-cols-3 border-t-2 text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                  <div className="col-span-1 border-r p-2 text-left" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.totalSales}</div>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000' }}></div>
                  <div className="col-span-1 p-2 text-right" style={{ borderColor: '#008000' }}></div>
                </div>
                <div className="grid grid-cols-3 border-b text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                  <div className="col-span-1 border-r p-2 text-left" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.expenses}</div>
                  <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000' }}></div>
                  <div className="col-span-1 p-2 text-right" style={{ borderColor: '#008000' }}></div>
                </div>
                <div className="grid grid-cols-3 border-b text-xs font-bold" style={{ borderColor: '#008000', backgroundColor: '#f0f9ff' }}>
                  <div className="col-span-1 border-r p-2 text-left" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.netBalance}</div>
                  <div className="col-span-1 border-r p-2 text-center" style={{ borderColor: '#008000' }}>
                    <span className="bg-red-600 text-white px-1.5 py-0.5 text-xs font-bold">Rs.</span>
                  </div>
                  <div className="col-span-1 p-2 text-right font-bold" style={{ borderColor: '#008000' }}></div>
                </div>
              </div>
            </div>
          </div>


          {/* Combined Bottom Table - Terms, Grand Total, Errors/Signature */}
          <div className="border-2 mb-4" style={{ borderColor: '#008000' }}>
            <div className="grid grid-cols-12" style={{ minHeight: '150px' }}>
              {/* Left Side - Terms and Conditions */}
              <div className="col-span-5 p-3" style={{ fontSize: '11px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.salesSlipSent}</div>
                <div style={{ marginBottom: '4px' }}>
                  {DISPLAY_NAMES.amountOfSlip}
                  <span style={{ borderBottom: '1px solid #008000', padding: '0 60px', display: 'inline-block', minWidth: '150px' }}></span>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  {DISPLAY_NAMES.toBeCollected}
                  <span style={{ borderBottom: '1px solid #008000', padding: '0 40px', display: 'inline-block', minWidth: '100px', marginLeft: '8px' }}></span>
                  .
                </div>
                <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.ifNotReceived}</div>
                <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.noComplaints}</div>
                <div style={{ marginTop: '8px', fontWeight: 'bold' }}>{DISPLAY_NAMES.thanks}</div>
              </div>

              {/* Center - Grand Total (increased width, left-oriented text) */}
              <div className="col-span-2 p-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: '12px', paddingLeft: '0', paddingRight: '0' }}>
                <div className="border-2 p-2" style={{ borderColor: '#008000', width: '200%', minWidth: '350px', height: '45px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', backgroundColor: '#f0f9ff', marginRight: '-220px', padding: '8px 12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.grandTotal}</span>
                  <span className="bg-red-600 text-white px-2 py-0.5 text-xs font-bold" style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.rs}</span>
                  <div style={{ minWidth: '120px', minHeight: '18px', flex: 1 }}></div>
                </div>
                <div className="text-xs italic mt-2 mb-4 whitespace-nowrap" style={{ textAlign: 'center', width: '200%', minWidth: '350px', marginRight: '-220px', marginTop: '8px' }}>{DISPLAY_NAMES.errorsOmissions}</div>
              </div>

              {/* Right Side - Signature */}
              <div className="col-span-5 p-3 flex flex-col justify-end items-end" style={{ fontSize: '11px' }}>
                <div className="flex flex-col justify-end items-center" style={{ textAlign: 'center' }}>
                  <div className="text-xs mb-2">{DISPLAY_NAMES.yoursSincerely}</div>
                  <div className="text-xs">{DISPLAY_NAMES.signatureName}</div>
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