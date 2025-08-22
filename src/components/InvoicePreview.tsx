import React, { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from 'react-dom/client';

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
  const week = data?.week ?? "1";
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

  // Helper to wait for all images in a container to load
  function waitForImagesToLoad(container: HTMLElement) {
    const images = Array.from(container.querySelectorAll('img'));
    return Promise.all(images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => {
        img.onload = img.onerror = res;
      });
    }));
  }

  // PDF Export using html2canvas for pixel-perfect match
  const handleDownloadPDF = async () => {
    try {
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    hiddenDiv.style.color = '#000';
    hiddenDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
      
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        * {
        color: #000 !important;
        background-color: transparent !important;
        border-color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        }
    `;
    hiddenDiv.appendChild(styleTag);
    document.body.appendChild(hiddenDiv);

    // Render InvoicePreview into hiddenDiv with the exact same invoice number
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
        <InvoicePreview data={{ ...data, invoiceNo: displayInvoiceNo }} showDownloadButton={false} isPdfExport={true} />
    );

    await new Promise(r => setTimeout(r, 600));

    // Apply vertical alignment fix just for PDF rendering
    const tableCells = hiddenDiv.querySelectorAll('.pdf-cell-fix');
    tableCells.forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.style.position = 'relative';
      htmlCell.style.top = '-2.5px'; // Adjust this value to counteract the downward shift
    });

    await waitForImagesToLoad(hiddenDiv);
    
    const canvas = await html2canvas(hiddenDiv, { 
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    });
      
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ 
        orientation: "p", 
        unit: "pt", 
        format: "a4",
        compress: true
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;
    const calculatedHeight = pdfWidth / ratio;

    let finalPdfHeight = calculatedHeight;
    if (calculatedHeight > pdfHeight) {
        finalPdfHeight = pdfHeight;
    }
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, finalPdfHeight, undefined, 'FAST');
    const filename = displayInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${displayInvoiceNo}.pdf`;
    pdf.save(filename);

    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
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

  const amountInWords = "Elleven Thousand Nine Hundred Sixty Eight Rupees and Ninety Five Paise only";

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
        className="w-[800px] mx-auto bg-white shadow-lg p-6 text-black"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1130px', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1rem' }}>
          <div style={{ width: '120px' }}>
            <img src="/inovice_formatting/1stfflogo.jpg" alt="Logo" style={{ width: '100%', height: 'auto' }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', lineHeight: '1.4' }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>FIRST FILM STUDIOS LLP</div>
            <div>26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA,</div>
            <div>KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA</div>
            <div>{email}</div>
            <div>GST- {gst}</div>
            <div>PAN No:- {pan}</div>
            <div>LLP Reg. No.- {regNo}</div>
          </div>
        </div>

        {/* Main Content Box */}
        <div style={{ width: '100%' }}>
          {/* Top Details - Two Columns */}
          <div style={{ display: 'flex', width: '100%', fontSize: '12px', lineHeight: '1.6', marginBottom: '1rem' }}>
            {/* Left Column */}
            <div style={{ width: '62%', paddingRight: '2rem' }}>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '30px' }}>M/s</span>
                <div style={{ fontWeight: 'bold' }}>{clientName}</div>
              </div>
              <div style={{ marginLeft: '30px', whiteSpace: 'pre-line' }}>{clientAddress}</div>
              <div style={{ display: 'flex', marginTop: '1rem' }}>
                <span style={{ width: '120px' }}>PAN No.</span><span>{panNo}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '120px' }}>GSTIN No.</span><span>{gstinNo}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '120px' }}>Property</span><span>{property}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '120px' }}>Centre</span><span>{centre}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '120px' }}>Place of Service</span><span>{placeOfService}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '120px' }}>Business Territory</span><span>{businessTerritory}</span>
              </div>
            </div>
            {/* Right Column */}
            <div style={{ width: '38%', paddingLeft: '0' }}>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Invoice No.</span><span style={{ fontWeight: 'bold' }}>{displayInvoiceNo}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Invoice Date</span><span>{invoiceDate}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Movie Name</span><span style={{ fontWeight: 'bold' }}>{movieName}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <div><span style={{ width: '110px', display: 'inline-block' }}>Movie Version</span><span>{movieVersion}</span></div>
                    <div style={{ fontWeight: 'bold' }}>{language}</div>
                </div>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Screen Formate</span><span>{screenFormat}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Release Week</span><span>{week}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: '110px' }}>Cinema Week</span><span>{cinemaWeek}</span></div>
                <div style={{ display: 'flex' }}>
                    <span style={{ width: '110px' }}>Screening Date</span>
                    <span style={{ whiteSpace: 'nowrap' }}>From <span style={{ fontWeight: 'bold' }}>{formatDate(screeningDateFrom)}</span> To <span style={{ fontWeight: 'bold' }}>{formatDate(screeningDateTo)}</span></span>
                </div>
            </div>
          </div>

          {/* Wrapper for table and amount in words */}
          <div style={{ border: '2px solid black', fontSize: '11px' }}>
            {/* Main Table Flex Container */}
            <div style={{ display: 'flex', width: '100%' }}>
                {/* Left Section */}
                <div style={{ width: '62%', borderRight: '2px solid black', position: 'relative' }}>
                    {/* THIS IS THE NEW DIV FOR THE CONTINUOUS VERTICAL LINE */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '45%', // Position after Date (25) + Show (10) + Aud (10)
                        width: '1px',
                        backgroundColor: 'black',
                        transform: 'translateX(-0.5px)' // Center the line precisely
                    }}></div>
                    {/* Header */}
                    <div style={{ display: 'flex', fontWeight: 'bold', borderBottom: '1px solid black' }}>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '25%', borderRight: '1px solid black', borderBottom: '0' }}>Date</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderRight: '1px solid black', borderBottom: '0' }}>Show</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderBottom: '0' }}>Aud.</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '20%', borderRight: '1px solid black', borderBottom: '0' }}>Collection</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '35%', borderBottom: '0' }}>Deduction</div>
                    </div>
                    {/* Body */}
                    <div style={{borderBottom: '1px solid black'}}>
                      {tableRows.map((row, index) => (
                          <div key={index} style={{ display: 'flex' }}>
                              <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '25%', borderRight: '1px solid black', borderBottom: '0' }}>{formatDate(row.date)}</div>
                              <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderRight: '1px solid black', borderBottom: '0' }}>{row.show || ''}</div>
                              <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderBottom: '0' }}>{row.aud || ''}</div>
                              <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '20%', borderRight: '1px solid black', borderBottom: '0' }}>
                                  {(row.collection || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '35%', padding: '0 4px', borderBottom: '0' }}>
                                  {index === 0 && showTaxVal > 0 && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', lineHeight: `${rowHeight}px`}}>
                                          <span>Show Tax</span>
                                          <span style={{ textAlign: 'right', paddingRight: '4px' }}>{showTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                    </div>
                    {/* Total Row */}
                    <div style={{ display: 'flex', fontWeight: 'bold' }}>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '25%', borderRight: '1px solid black', borderBottom: '0' }}>Total</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderRight: '1px solid black', borderBottom: '0' }}>{totalShowVal}</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '10%', borderBottom: '0' }}>{totalAudVal}</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '20%', borderRight: '1px solid black', borderBottom: '0' }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                        <div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '35%', borderBottom: '0' }}>{totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                    {/* HSN/SAC Section */}
                    <div style={{ display: 'flex', borderTop: '2px solid black' }}>
                       {/* Left Column (Labels) */}
                        <div style={{ width: '45%' }}>
                            <div style={{ ...leftCellStyle, fontWeight: 'bold', borderBottom: '1px solid black' }}>
                                <span className="pdf-cell-fix">HSN/SAC Code</span>
                            </div>
                            <div style={{ ...leftCellStyle, fontWeight: 'bold' }}>
                                <span className="pdf-cell-fix">Description</span>
                            </div>
                        </div>
                        {/* Right Column (Values) */}
                        <div style={{ width: '55%' }}>
                            <div style={{ ...leftCellStyle, borderBottom: '1px solid black' }}>
                                <span className="pdf-cell-fix">{hsnSacCode}</span>
                            </div>
                            <div style={{ ...leftCellStyle }}>
                                <span className="pdf-cell-fix">{description}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Section */}
                <div style={{ width: '38%' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', fontWeight: 'bold', borderBottom: '1px solid black' }}>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Particulars</div>
                        <div className="pdf-cell-fix" style={{ ...centerCellStyle, width: '40%', borderBottom: '0' }}>Amount</div>
                    </div>
                    {/* Body */}
                    <div style={{ display: 'flex', borderTop: '1px solid black' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Total Collection</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                    <div style={{ display: 'flex' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Total Deduction</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}>{totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                    <div style={{ display: 'flex', borderBottom: '2px solid black' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Net Collection</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}>{netCollection.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                    <div style={{ display: 'flex' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, height: rowHeight, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}></div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}></div></div>
                    <div style={{ display: 'flex' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Dist. Consideration @{distPercent}%</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}>{distConsideration.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                    <div style={{ display: 'flex' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, height: rowHeight, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}></div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}></div></div>
                    <div style={{ display: 'flex', borderTop: '2px solid black' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', fontWeight:'bold', borderRight: '1px solid black', borderBottom: '0' }}>Taxable Amount</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', fontWeight:'bold', borderBottom: '0' }}>{taxableAmount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                    
                    {gstType === 'IGST' ? (
                        <div style={{ display: 'flex', borderTop: '1px solid black' }}>
                            <div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0', height: rowHeight * 2, lineHeight: `${rowHeight * 2}px` }}>IGST @ {igstRateNum}%</div>
                            <div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0', height: rowHeight * 2, lineHeight: `${rowHeight * 2}px` }}>{igstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', borderTop: '1px solid black' }}>
                                <div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0', height: rowHeight * 1.5, lineHeight: `${rowHeight * 1.5}px` }}>CGST @ {cgstRateNum}%</div>
                                <div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0', height: rowHeight * 1.5, lineHeight: `${rowHeight * 1.5}px` }}>{cgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid black' }}>
                                <div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0', height: rowHeight * 1.5, lineHeight: `${rowHeight * 1.5}px` }}>SGST @ {sgstRateNum}%</div>
                                <div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0', height: rowHeight * 1.5, lineHeight: `${rowHeight * 1.5}px` }}>{sgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', fontWeight: 'bold', borderTop: '2px solid black' }}><div className="pdf-cell-fix" style={{ ...leftCellStyle, width: '60%', borderRight: '1px solid black', borderBottom: '0' }}>Net Amount</div><div className="pdf-cell-fix" style={{ ...rightCellStyle, width: '40%', borderBottom: '0' }}>{netAmountVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div></div>
                </div>
            </div>

            {/* Amount in Words */}
            <div style={{ borderTop: '2px solid black', padding: '4px 8px', fontWeight: 'bold' }}>
                Amount in Words: {amountInWords}
            </div>
          </div>


           {/* Remarks, Terms, Bank */}
           <div style={{ marginTop: '1rem', fontSize: '11px', lineHeight: '1.5' }}>
                <div><b>Remark:</b> {remark}</div>
                <div style={{ marginTop: '0.5rem' }}><b>Terms & Conditions :-</b></div>
                <div style={{ paddingLeft: '1rem' }}>
                    1. Payment is due within 14 days from the date invoice.Interest @18% pa. will be charged for payment delayed beyond that period.<br/>
                    2. All cheques / drafts should be crossed and made payable to<br/>
                    <div style={{ paddingLeft: '1rem' }}>
                        <b>FIRST FILM STUDIOS LLP</b><br/>
                        Bank Detail: - HDFC BANK LIMITED A/C No.: <b>50200099601176</b> IFSC CODE: <b>HDFC0000543</b><br/>
                        BRANCH: AHURA CENTRE, ANDHERI WEST
                    </div>
                    3. Subject to Mumbai juridiction
                </div>
            </div>
            
            {/* Footer: Stamp and Signature */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: '2rem', minHeight: '120px' }}>
                 <div style={{ marginRight: '50px' }}>
                    <img src="/inovice_formatting/Stamp_mum.png" alt="Stamp" style={{ width: '110px', height: '100px' }} />
                 </div>
                 <div style={{ textAlign: 'center', fontSize: '12px' }}>
                     <b>For FIRST FILM STUDIOS LLP</b>
                     <div style={{ height: '60px', margin: '8px 0' }}>
                        <img src="/inovice_formatting/sign.png" alt="Signature" style={{ height: '100%', width: 'auto' }} />
                     </div>
                     <div>(Authorised Signatory)</div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;