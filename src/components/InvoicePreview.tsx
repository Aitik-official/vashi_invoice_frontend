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
  invoiceId?: string; // Added for invoiceId
}

const InvoicePreview = ({ data = {} as InvoiceData, showDownloadButton = true, isPdfExport = false }) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Fallbacks for static values (use blank/null for new fields)
    // Filtered data
  const clientName = data.clientName ?? "MIRAJ ENTERTAINMENT LIMITED";
  const clientAddress = data.clientAddress ?? "3RD, 2 ACME PLAZA, KURLA ROAD, OPP SANGAM BLDG CINEMA\nANDHERI EAST, MUMBAI, MAHARASHTRA, 400059";
  const panNo = data.panNo ?? "AAFCM5147R";
  const gstinNo = data.gstinNo ?? "27AAFCM5147R1ZP";
  const property = data.property ?? "Miraj Cinemas Dattani";
  const centre = data.centre ?? "MUMBAI";
  const placeOfService = data.placeOfService ?? "MAHARASHTRA";
  const businessTerritory = data.businessTerritory ?? "MUMBAI";
  // Use invoiceId or invoiceNo for Invoice No, with fallback
  const invoiceNo = data.invoiceId || data.invoiceNo || data["Invoice No"] || "INV001";
  const invoiceDate = data.invoiceDate ?? "23/06/2025";
  const movieName = data.movieName ?? "NARIVETTA";
  const movieVersion = data.movieVersion ?? "2D";
  const language = data.language ?? "MALAYALAM";
  const screenFormat = data.screenFormat ?? "1";
  const week = data.week ?? "1";
  const releaseWeek = data.releaseWeek ?? week;
  const cinemaWeek = data.cinemaWeek ?? "1";
  const screeningFrom = data.screeningFrom ?? "2025-05-23";
  const screeningTo = data.screeningTo ?? "2025-05-29";
  const screeningDateFrom = data.screeningDateFrom ?? screeningFrom;
  const screeningDateTo = data.screeningDateTo ?? screeningTo;
  const hsnSacCode = data.hsnSacCode ?? "997332";
  const description = data.description ?? "Theatrical Exhibition Rights";
  const distributionPercent = safeNumber(data.share ?? data.distributionPercent ?? 45);
  const gstType = data.gstType ?? 'CGST/SGST';
  const gstRate = safeNumber(data.gstRate ?? 18);
  const table = data.table ?? [];
  const showTax = data.showTax ?? 0;
  const otherDeduction = data.otherDeduction ?? 0;
  const totalShow = data.totalShow ?? 0;
  const totalAud = data.totalAud ?? 0;
  const totalCollection = data.totalCollection ?? 0;
  const cgstRate = data.cgstRate ?? "9";
  const sgstRate = data.sgstRate ?? "9";
  const taxType = data.taxType ?? "GST";
  const remark = data.remark ?? "";
  const terms = data.terms ?? [];
  const signatory = data.signatory ?? "For FIRST FILM STUDIOS LLP";
  const regNo = data.regNo ?? "ACH-2259";
  const firmName = data.firmName ?? "FIRST FILM STUDIOS LLP";
  const address = data.address ?? "26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA, KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA";
  const gst = data.gst ?? "27AAJFF7915J1Z1";
  const pan = data.pan ?? "AAJFF7915J";
  const email = data.email ?? "info@firstfilmstudios.com";

  // Format screening dates
  const formatDate = (d: string) => {
    if (!d) return "";
    // If already in DD/MM/YYYY or DD-MM-YYYY, return as is
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(d)) return d;
    // If in YYYY-MM-DD, convert to DD-MM-YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split("-");
      return `${day}-${m}-${y}`;
    }
    return d;
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
    // Create a hidden div for InvoicePreview
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    document.body.appendChild(hiddenDiv);

    // Render InvoicePreview into hiddenDiv with the exact same invoice number
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview data={{ ...data, invoiceNo: invoiceNo }} showDownloadButton={false} isPdfExport={true} />
    );

    // Wait for render and images to load
    await new Promise(r => setTimeout(r, 400));
    await waitForImagesToLoad(hiddenDiv);

    // Use html2canvas to capture the DOM as a high-res PNG
    const canvas = await html2canvas(hiddenDiv, { scale: 2, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = Math.min(800, pageWidth - 80);
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    const x = (pageWidth - pdfWidth) / 2;
    const y = 40;
    pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
    pdf.save(`Invoice_${invoiceNo}.pdf`);

    // Clean up
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
  };

  // Use table from Excel data
  const tableRows = Array.isArray(table) ? table : [];

  // Calculate totals from table rows - ALWAYS calculate from actual data
  const calculatedTotalShow = tableRows.reduce((sum, row) => sum + safeNumber(row.show), 0);
  const calculatedTotalAud = tableRows.reduce((sum, row) => sum + safeNumber(row.aud), 0);
  const calculatedTotalCollection = tableRows.reduce((sum, row) => sum + safeNumber(row.collection), 0);
  
  // Use calculated totals (more accurate) or fallback to provided totals
  const totalShowVal = calculatedTotalShow || safeNumber(totalShow) || 0;
  const totalAudVal = calculatedTotalAud || safeNumber(totalAud) || 0;
  const totalCollectionVal = calculatedTotalCollection || safeNumber(totalCollection) || 0;
  
  // Calculate deductions
  const showTaxVal = safeNumber(showTax) || 0;
  const otherDeductionVal = safeNumber(otherDeduction) || 0;
  const totalDeduction = showTaxVal + otherDeductionVal;
  
  // Calculate net collection accurately
  const netCollection = totalCollectionVal - totalDeduction;

  // Distribution percent (from user input, default 45)
  const distPercent = safeNumber(distributionPercent) || 45;
  const distConsideration = netCollection * (distPercent / 100);
  const taxableAmount = distConsideration;

  // GST/IGST calculation logic
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

  // Amount in words
  const amountInWords = amountToWordsWithPaise(netAmountVal);

  // Prepare data for unified table body
  const deductionLines: { text: string; isBold: boolean }[] = [];
  if (Number(showTaxVal) > 0) {
      deductionLines.push({ text: `Show Tax - ${Number(showTaxVal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`, isBold: true });
  }
  if (Number(otherDeductionVal) > 0) {
      deductionLines.push({ text: `Others - ${Number(otherDeductionVal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`, isBold: true });
  }

  const numDataRows = tableRows.length;
  const totalBodyRows = Math.max(numDataRows, deductionLines.length);
  const rowIndices = Array.from({ length: totalBodyRows }, (_, i) => i);
  
  // Define row height and consistent cell style for PDF rendering
  const rowHeight = isPdfExport ? 32 : 28;
  const baseCellStyle = { height: rowHeight, display: 'flex', alignItems: 'center' };
  const centerCellStyle = { ...baseCellStyle, justifyContent: 'center', padding: '0 4px' };
  const leftCellStyle = { ...baseCellStyle, justifyContent: 'flex-start', padding: '0 4px' };
  const deductionCellStyle = { ...baseCellStyle, padding: '0 8px' };
  const particularsCellStyle = { lineHeight: `${rowHeight}px`, padding: '0 8px', verticalAlign: 'middle' };

  // TypeScript-safe textAlign values
  const centerTextAlign = 'center' as const;
  const leftTextAlign = 'left' as const;
  const rightTextAlign = 'right' as const;

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
        className="w-[800px] mx-auto bg-white shadow-2xl rounded-md p-0 text-black font-sans border border-black"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1100px', boxSizing: 'border-box', position: 'relative', overflowY: 'auto', overflowX: 'hidden', marginTop: 32, marginBottom: 32 }}
      >
        {/* Header */}
        <div className="flex flex-row items-stretch" style={{ background: '#e46d04', borderBottom: '2px solid #000', minHeight: 130, height: 130 }}>
          <div style={{ width: 220, height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', background: 'transparent', padding: 0, margin: 0 }}>
            <img src="/inovice_formatting/logo_wbg.png" alt="Logo" style={{ height: '100%', width: '100%', objectFit: 'contain', margin: 0, padding: 0 }} />
          </div>
          <div className="flex-1 flex flex-col items-end justify-center pr-8" style={{ color: '#fff', textAlign: 'right', fontFamily: 'Arial, Helvetica, sans-serif', height: '100%', paddingTop: 8, paddingBottom: 8, justifyContent: 'center' }}>
            <div className="font-bold" style={{ fontSize: 20, letterSpacing: 1, lineHeight: 1.1 }}>FIRST FILM STUDIOS LLP</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA,</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>info@firstfilmstudios.com</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>GST- {gst}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>PAN No:- {pan}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>LLP Reg. No.- {regNo}</div>
          </div>
        </div>

        {/* Main Invoice Box */}
        <div className="border border-black m-4" style={{ background: '#fff', padding: 0, border: '3px solid #000' }}>
          {/* Top Details - Two Columns */}
          <div className="flex flex-row w-full" style={{ borderBottom: '3px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, minHeight: 160 }}>
            {/* Left Column */}
            <div className="flex-1 p-4" style={{ borderRight: '3px solid #000', paddingTop: 18, paddingBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 0 }}>
                <span style={{ marginRight: 6 }}>M/s</span>
                <strong>{clientName}</strong>
              </div>
              <div style={{ marginLeft: 32, marginBottom: 0, whiteSpace: 'pre-line' }}>{clientAddress}</div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>PAN No.</span><strong style={{ marginLeft: 24 }}>{panNo}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>GSTIN No.</span><strong style={{ marginLeft: 24 }}>{gstinNo}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Property</span><strong style={{ marginLeft: 24 }}>{property}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Centre</span><strong style={{ marginLeft: 24 }}>{centre}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Place of Service</span><strong style={{ marginLeft: 24 }}>{placeOfService}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Business Territory</span><strong style={{ marginLeft: 24 }}>{businessTerritory}</strong></div>
            </div>
            {/* Right Column */}
            <div className="flex-1 p-4" style={{ fontSize: 15, paddingTop: 18, paddingBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Invoice No.</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{invoiceNo || '-'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Invoice Date</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{invoiceDate || '-'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ minWidth: 110 }}>Movie Name</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{movieName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Movie Version</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{movieVersion}</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>{language}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Screen Formate</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{screenFormat}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Release Week</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{releaseWeek || week}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Cinema Week</span>
                <span style={{ fontWeight: 700, marginLeft: 16 }}>{cinemaWeek}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Screening Date</span>
                <span style={{ marginLeft: 16 }}>From <span style={{ fontWeight: 700 }}>{formatDate(screeningDateFrom || screeningFrom) || '-'}</span></span>
                <span style={{ marginLeft: 16 }}>To <span style={{ fontWeight: 700 }}>{formatDate(screeningDateTo || screeningTo) || '-'}</span></span>
              </div>
            </div>
          </div>

          {/* Data and Particulars: Flexbox Table-Like Layout */}
          <div style={{ display: 'flex', flexDirection: 'row', width: '100%', borderBottom: '1.5px solid #000', margin: 0, padding: 0, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13 }}>
            {/* Left: Data Column */}
            <div style={{ flex: 1, borderRight: '3px solid #000', display: 'flex', flexDirection: 'column' }}>
                {/* Wrapper for the part that has vertical lines */}
                <div style={{ position: 'relative' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', borderBottom: '1.5px solid #000', fontWeight: 700, background: '#fff' }}>
                        <div style={{ flex: 1, ...centerCellStyle }}><span>Date</span></div>
                        <div style={{ flex: 0.7, ...centerCellStyle }}><span>Show</span></div>
                        <div style={{ flex: 0.7, ...centerCellStyle }}><span>Aud.</span></div>
                        <div style={{ flex: 1.5, ...centerCellStyle }}><span>Collection</span></div>
                        <div style={{ flex: 2, ...centerCellStyle }}><span>Deduction</span></div>
                    </div>

                    {/* Unified Table Body */}
                    {rowIndices.map(index => {
                        const dataRow = tableRows[index];
                        const deductionLine = deductionLines[index];
                        const collectionValue = dataRow?.collection;
                        const displayCollection = typeof collectionValue === 'number'
                          ? (collectionValue === 0 ? '0' : collectionValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                          : '';

                        return (
                            <div key={index} style={{ display: 'flex', background: '#fff', height: rowHeight }}>
                                <div style={{ flex: 1, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{dataRow?.date ?? ''}</span></div>
                                <div style={{ flex: 0.7, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{dataRow?.show ?? ''}</span></div>
                                <div style={{ flex: 0.7, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{dataRow?.aud ?? ''}</span></div>
                                <div style={{ flex: 1.5, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{displayCollection}</span></div>
                                <div style={{ flex: 2, fontWeight: deductionLine?.isBold ? 700 : 400, ...deductionCellStyle }}>
                                  {deductionLine?.text && (
                                    <div style={{ display: 'flex', width: '100%', alignItems: 'center', height: '100%' }}>
                                      {(() => {
                                        const [label, ...rest] = deductionLine.text.split('-');
                                        const value = rest.join('-').trim();
                                        return <>
                                          <span style={{ flex: 1, textAlign: leftTextAlign, whiteSpace: 'nowrap' }}>{label.trim()}</span>
                                          <span style={{ flex: 1, textAlign: rightTextAlign, whiteSpace: 'nowrap', marginLeft: 8 }}>{value}</span>
                                        </>;
                                      })()}
                                    </div>
                                  )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Total Row */}
                    <div style={{ display: 'flex', fontWeight: 700, background: '#fff', borderTop: '1.5px solid #000', height: rowHeight }}>
                        <div style={{ flex: 1, ...leftCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>Total</span></div>
                        <div style={{ flex: 0.7, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{totalShowVal}</span></div>
                        <div style={{ flex: 0.7, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{totalAudVal}</span></div>
                        <div style={{ flex: 1.5, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                        <div style={{ flex: 2, ...centerCellStyle }}><span style={{ textAlign: centerTextAlign, width: '100%' }}>{totalDeduction ? totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</span></div>
                    </div>

                    {/* Vertical Lines Overlay */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(1 / 5.9 * 100%)', width: '1.5px', backgroundColor: '#000' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(1.7 / 5.9 * 100%)', width: '1.5px', backgroundColor: '#000' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(2.4 / 5.9 * 100%)', width: '1.5px', backgroundColor: '#000' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(3.9 / 5.9 * 100%)', width: '1.5px', backgroundColor: '#000' }} />
                </div>
                
                {/* HSN/SAC Section */}
                <div style={{ borderTop: '1.5px solid #000', position: 'relative' }}>
                    <div style={{ display: 'flex', height: rowHeight }}>
                        <div style={{ flex: 2.4, paddingLeft: 4, fontWeight: 700, ...leftCellStyle }}>HSN/SAC Code</div>
                        <div style={{ flex: 3.5, paddingLeft: 8, ...leftCellStyle }}>{hsnSacCode || '997332'}</div>
                    </div>
                    <div style={{ display: 'flex', height: rowHeight }}>
                        <div style={{ flex: 2.4, paddingLeft: 4, fontWeight: 700, ...leftCellStyle }}>Description</div>
                        <div style={{ flex: 3.5, paddingLeft: 8, ...leftCellStyle }}>{description || 'Theatrical Exhibition Rights'}</div>
                    </div>
                     {/* Aligned Vertical Line Overlay */}
                     <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 'calc(2.4 / 5.9 * 100%)',
                        width: '1.5px',
                        backgroundColor: '#000'
                    }} />
                </div>
            </div>

            {/* Right: Particulars Table */}
            <div style={{ flex: 1, display: 'table', borderCollapse: 'collapse' }}>
                {/* Header */}
                <div style={{ display: 'table-row', fontWeight: 'bold', textAlign: 'center', height: rowHeight }}>
                    <div style={{ display: 'table-cell', border: '1.5px solid #000', borderTop: 0, borderRight: 0, ...particularsCellStyle }}>Particulars</div>
                    <div style={{ display: 'table-cell', borderBottom: '1.5px solid #000', ...particularsCellStyle }}>Amount</div>
                </div>
                {/* Body Rows */}
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', paddingLeft: '8px', ...particularsCellStyle }}>Total Collection</div>
                    <div style={{ display: 'table-cell', textAlign: 'right', paddingRight: '8px', ...particularsCellStyle }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', paddingLeft: '8px', ...particularsCellStyle }}>Total Deduction</div>
                    <div style={{ display: 'table-cell', textAlign: 'right', paddingRight: '8px', ...particularsCellStyle }}>{totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', borderBottom: '1.5px solid #000', paddingLeft: '8px', fontWeight: 'bold', ...particularsCellStyle }}>Net Collection</div>
                    <div style={{ display: 'table-cell', borderBottom: '1.5px solid #000', textAlign: 'right', paddingRight: '8px', fontWeight: 'bold', ...particularsCellStyle }}>{netCollection.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', borderBottom: '1.5px solid #000', paddingLeft: '8px', ...particularsCellStyle }}>Dist. Consideration @{distPercent}%</div>
                    <div style={{ display: 'table-cell', borderBottom: '1.5px solid #000', textAlign: 'right', paddingRight: '8px', ...particularsCellStyle }}>{distConsideration.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
                <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', borderBottom: '1.5px solid #000', paddingLeft: '8px', fontWeight: 'bold', ...particularsCellStyle }}>Taxable Amount</div>
                    <div style={{ display: 'table-cell', borderBottom: '1.5px solid #000', textAlign: 'right', paddingRight: '8px', fontWeight: 'bold', ...particularsCellStyle }}>{taxableAmount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
                {/* GST Rows */}
                {gstType === 'IGST' ? (
                  <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', paddingLeft: '8px', ...particularsCellStyle }}>IGST @ {igstRateNum}%</div>
                    <div style={{ display: 'table-cell', textAlign: 'right', paddingRight: '8px', ...particularsCellStyle }}>{igstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                  </div>
                ) : (
                  <div style={{ display: 'table-row' }}>
                    <div style={{ display: 'table-cell', borderRight: '1.5px solid #000', paddingLeft: '8px' }}>
                        <div style={{ height: rowHeight, ...particularsCellStyle }}>CSGT @ {cgstRateNum}%</div>
                        <div style={{ height: rowHeight, ...particularsCellStyle }}>SGST @ {sgstRateNum}%</div>
                    </div>
                    <div style={{ display: 'table-cell', textAlign: 'right', paddingRight: '8px' }}>
                        <div style={{ height: rowHeight, ...particularsCellStyle }}>{cgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                        <div style={{ height: rowHeight, ...particularsCellStyle }}>{sgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                  </div>
                )}
                {/* Net Amount Row */}
                <div style={{ display: 'table-row', fontWeight: 'bold' }}>
                    <div style={{ display: 'table-cell', border: '1.5px solid #000', borderBottom: 0, borderRight: 0, ...particularsCellStyle }}>Net Amount</div>
                    <div style={{ display: 'table-cell', borderTop: '1.5px solid #000', textAlign: 'right', paddingRight: '8px', ...particularsCellStyle }}>{netAmountVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
            </div>
        </div>

          {/* Amount in Words Section */}
          <div style={{ width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, borderBottom: '1.5px solid #000' }}>
            <div style={{ padding: '8px 16px', fontWeight: 700 }}>
              Amount in Words: {amountInWords.charAt(0).toUpperCase() + amountInWords.slice(1)}
            </div>
          </div>


          {/* Remarks, Terms, Bank */}
          <div className="w-full" style={{ fontSize: 13 }}>
            <div className="p-2">
              <div className="mt-2"><b>Remark:</b> {remark}</div>
              <div className="mt-2 font-bold">Terms & Conditions :-</div>
              <ol className="list-decimal pl-6">
                <li>Payment is due within 14 days from the date invoice. Interest @18% pa. will be charged for payment delayed beyond that period.</li>
                <li>All cheques / drafts should be crossed and made payable to <b>FIRST FILM STUDIOS LLP</b></li>
                <li>Bank Detail: - HDFC BANK LIMITED A/c No.: <b>50200099601176</b>  IFSC CODE: <b>HDFC0000543</b></li>
                <li>BRANCH: AHURA CENTRE, ANDHERI WEST</li>
                <li>Subject to Mumbai jurisdiction</li>
              </ol>
        </div>
          </div>

          {/* Footer: Stamp and Signature */}
          <div className="flex flex-row items-end justify-end w-full p-4" style={{ minHeight: 100 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%' }}>
              <div style={{ marginRight: 32 }}>
                <img src="/inovice_formatting/Stamp_mum.png" alt="Stamp" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
              </div>
              <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <div className="font-bold" style={{ fontSize: 15, marginBottom: 8 }}>For FIRST FILM STUDIOS LLP</div>
                <div style={{ marginBottom: 8 }}>
                  <img src="/inovice_formatting/sign.png" alt="Signature" style={{ width: '120px', height: '60px', objectFit: 'contain' }} />
                </div>
                <div className="italic" style={{ fontSize: 13 }}>(Authorised Signatory)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;