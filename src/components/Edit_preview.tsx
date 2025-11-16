"use client";
import React, { useState, useEffect, useRef } from "react";
import InvoicePreview from './InvoicePreview';
import { generateStandardizedPDF } from '../utils/pdfGenerator';

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
//       collection: number,
//       deduction: string, // 'Show Tax', 'Others', etc.
//       deductionAmt: number
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
  // Filtered data
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
  return result.trim() + "Rupees only";
}

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

// Example structure for invoice data (expand as needed)
const defaultInvoice: InvoiceData = {
  clientName: '',
  clientAddress: '',
  panNo: '',
  gstinNo: '',
  property: '',
  placeOfService: '',
  businessTerritory: '',
  invoiceNo: '', // This will be filled from Excel "In_no"
  "Invoice No": '', // Excel column name
  "In_no": '', // Excel "In_no" column name - THIS IS THE ONLY FIELD WE USE
  invoiceDate: '',
  movieName: '',
  movieVersion: '',
  language: '',
  screenFormat: '',
  reels: '',
  week: '',
  cinemaWeek: '',
  screeningFrom: '',
  screeningTo: '',
  screeningDateFrom: '',
  screeningDateTo: '',
  hsnSacCode: '',
  description: '',
  distributionPercent: '',
  table: [],
  showTax: '',
  totalTaxableAmount: '',
  cgst: '',
  sgst: '',
  netAmount: '',
  amountWords: '',
  remark: '',
  terms: [],
  signatory: '',
  regNo: '',
  firmName: '',
  address: '',
  gst: '',
  pan: '',
  email: '',
  particulars: [],
  centre: '',
  cgstRate: '',
  sgstRate: '',
  taxType: 'GST',
  gstRate: '',
  totalShow: '',
  totalAud: '',
  totalCollection: '',
  otherDeduction: '',
  gstType: 'CGST/SGST',
  share: ''
};

const EditPreview = ({ data = defaultInvoice, onChange, showDownloadButton = true }: { data?: typeof defaultInvoice, onChange?: (invoice: any) => void, showDownloadButton?: boolean }) => {
  // Use ONLY Excel invoice number
  const mergedData = { ...defaultInvoice, ...data };
  
  if (data?.invoiceNo) {
    mergedData.invoiceNo = data.invoiceNo;
  }
  
  // Only use Excel invoice number, no backend fields
  const [invoice, setInvoice] = useState(mergedData);
  const previewRef = useRef<HTMLDivElement>(null);
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

  // Update invoice state when data prop changes (for when editing existing invoice)
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      const newMergedData = { ...defaultInvoice, ...data };
      if (data?.invoiceNo) {
        newMergedData.invoiceNo = data.invoiceNo;
      }
      setInvoice(newMergedData);
    }
    // eslint-disable-next-line
  }, [data]);

  // Call onChange whenever invoice changes
  useEffect(() => {
    if (onChange) onChange(invoice);
    // eslint-disable-next-line
  }, [invoice]);

  // Helper to update any field
  const updateField = (field: string, value: any) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to update table row
  const updateTableRow = (idx: number, key: string, value: any) => {
    setInvoice((prev) => {
      const newTable = (prev.table || []).map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      );
      return { ...prev, table: newTable };
    });
  };

  // Calculation helpers
  const safeNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
    return 0;
  };

  // Generate dates from screening start to end date in DD/MM/YYYY format
  const generateDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return [];
    
    // Parse dates in DD/MM/YYYY format
    const parseDate = (dateStr: string) => {
      if (dateStr.includes('/')) {
        // Already in DD/MM/YYYY format
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (dateStr.includes('-')) {
        // Convert from YYYY-MM-DD or DD-MM-YYYY to DD/MM/YYYY
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD format
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // DD-MM-YYYY format
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      return new Date(dateStr);
    };
    
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      dates.push(`${day}/${month}/${year}`);
    }
    
    return dates;
  };

  // Generate table rows with proper date format
  const generateTableRows = (originalRows: Array<{date: string; show: number; aud: number; collection: number; deduction: string; deductionAmt: number}>): Array<{date: string; show: number; aud: number; collection: number; deduction: string; deductionAmt: number}> => {
    const dateRange = generateDateRange(invoice.screeningFrom || '', invoice.screeningTo || '');
    
    if (dateRange.length === 0) {
      return originalRows;
    }
    
    // Create a map of existing data by date for quick lookup
    const existingDataMap = new Map();
    originalRows.forEach(row => {
      if (row && row.date) {
        // Normalize date format for comparison - convert to DD/MM/YYYY
        let normalizedDate = row.date;
        
        // Handle different date formats and convert to DD/MM/YYYY
        if (normalizedDate.includes('-')) {
          const parts = normalizedDate.split('-');
          if (parts[0].length === 4) {
            // YYYY-MM-DD format
            normalizedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            // DD-MM-YYYY format
            normalizedDate = `${parts[0]}/${parts[1]}/${parts[2]}`;
          }
        }
        
        existingDataMap.set(normalizedDate, row);
      }
    });
    
    // Create new table rows with ALL dates between screening dates
    return dateRange.map((date) => {
      // Check if we have existing data for this date
      const existingRow = existingDataMap.get(date);
      
      return {
        date: date,
        show: existingRow?.show || 0,
        aud: existingRow?.aud || 0,
        collection: existingRow?.collection || 0,
        deduction: existingRow?.deduction || '',
        deductionAmt: existingRow?.deductionAmt || 0
      };
    });
  };

  const originalTableRows = Array.isArray(invoice.table) ? invoice.table : [];
  const tableRows = generateTableRows(originalTableRows);
  
  // Calculate totals from table rows - ALWAYS calculate from actual data
  const calculatedTotalShow = tableRows.reduce((sum, row) => sum + safeNumber(row.show), 0);
  const calculatedTotalAud = tableRows.reduce((sum, row) => sum + safeNumber(row.aud), 0);
  const calculatedTotalCollection = tableRows.reduce((sum, row) => sum + safeNumber(row.collection), 0);
  
  // Use calculated totals (more accurate) or fallback to provided totals
  const totalShowVal = calculatedTotalShow || safeNumber(invoice.totalShow) || 0;
  const totalAudVal = calculatedTotalAud || safeNumber(invoice.totalAud) || 0;
  const totalCollectionVal = calculatedTotalCollection || safeNumber(invoice.totalCollection) || 0;
  
  // Calculate deductions
  const showTaxVal = safeNumber(invoice.showTax) || 0;
  const otherDeductionVal = safeNumber(invoice.otherDeduction) || 0;
  const totalDeduction = showTaxVal + otherDeductionVal;
  
  // Calculate net collection accurately
  const netCollection = totalCollectionVal - totalDeduction;
  const distPercent = safeNumber(invoice.distributionPercent) || 45;
  const distConsideration = netCollection * (distPercent / 100);
  const taxableAmount = distConsideration;
  let cgstRateNum = 0, sgstRateNum = 0, igstRateNum = 0;
  let cgstVal = 0, sgstVal = 0, igstVal = 0, netAmountVal = 0;
  if (invoice.taxType === 'IGST') {
    igstRateNum = safeNumber(invoice.gstRate);
    igstVal = +(taxableAmount * (igstRateNum / 100)).toFixed(2);
    netAmountVal = +(taxableAmount + igstVal).toFixed(2);
  } else {
    cgstRateNum = safeNumber(invoice.gstRate) / 2;
    sgstRateNum = safeNumber(invoice.gstRate) / 2;
    cgstVal = +(taxableAmount * (cgstRateNum / 100)).toFixed(2);
    sgstVal = +(taxableAmount * (sgstRateNum / 100)).toFixed(2);
    netAmountVal = +(taxableAmount + cgstVal + sgstVal).toFixed(2);
  }
  const amountInWords = numberToWords(Math.round(netAmountVal));

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

  // PDF Export
  const handleDownloadPDF = async () => {
    try {
      const exactInvoiceNo = (invoice as any)["Invoice No"] || '-';
      const filename = exactInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${exactInvoiceNo}.pdf`;
      
      const { data } = await generateStandardizedPDF(
        <InvoicePreview
          data={{
            ...invoice,
            invoiceNo: exactInvoiceNo,
            distributionPercent: String(invoice.distributionPercent ?? ''),
            cgstRate: String(invoice.cgstRate ?? ''),
            sgstRate: String(invoice.sgstRate ?? ''),
            gstRate: String(invoice.gstRate ?? ''),
            taxType: invoice.taxType === 'GST' || invoice.taxType === 'IGST' ? invoice.taxType : undefined,
          }}
          showDownloadButton={false}
          isPdfExport={true}
        />,
        filename
      );
      
      // Create blob and download
      const blob = new Blob([data.slice()], { type: 'application/pdf' });
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
        className="w-[800px] mx-auto bg-white shadow-2xl rounded-md text-black font-sans border border-black"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1100px', boxSizing: 'border-box', position: 'relative', overflowY: 'auto', overflowX: 'hidden', marginTop: 32, marginBottom: 32, padding: 0 }}
      >
        {/* Header - Single Image replacing logo and company details - aligned with inner content width */}
        <div style={{ width: '100%', margin: 0, padding: '1rem 1rem 0 1rem', boxSizing: 'border-box' }}>
          <img 
            src="/inovice_formatting/baban.jpg" 
            alt="Invoice Header" 
            style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0 }} 
          />
        </div>

        {/* Main Invoice Box */}
        <div style={{ background: '#fff', padding: '1rem' }}>
          {/* Top Details - Two Columns */}
          <div className="flex flex-row w-full" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, minHeight: 160 }}>
            {/* Left Column */}
            <div className="flex-1 p-4" style={{ paddingTop: 18, paddingBottom: 18, paddingLeft: 8, paddingRight: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 0 }}>
                <span style={{ marginRight: 6 }}>M/s</span>
                <input className="font-bold border-b border-dashed border-gray-400 focus:border-orange-500 outline-none" value={invoice.clientName} onChange={e => updateField('clientName', e.target.value)} />
              </div>
              <textarea className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" style={{ marginLeft: 0 }} value={invoice.clientAddress} onChange={e => updateField('clientAddress', e.target.value)} />
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>PAN No.</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.panNo} onChange={e => updateField('panNo', e.target.value)} /></strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>GSTIN No.</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-48 ml-2" value={invoice.gstinNo} onChange={e => updateField('gstinNo', e.target.value)} /></strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Property</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-48 ml-2" value={invoice.property} onChange={e => updateField('property', e.target.value)} /></strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Centre</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.centre} onChange={e => updateField('centre', e.target.value)} /></strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Place of Service</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.placeOfService} onChange={e => updateField('placeOfService', e.target.value)} /></strong></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ minWidth: 120 }}>Business Territory</span><strong style={{ marginLeft: 12 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.businessTerritory} onChange={e => updateField('businessTerritory', e.target.value)} /></strong></div>
            </div>
            {/* Right Column */}
            <div className="flex-1 p-4" style={{ fontSize: 15, paddingTop: 18, paddingBottom: 18, paddingLeft: 8, paddingRight: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Invoice No.</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.invoiceNo} onChange={e => updateField('invoiceNo', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Invoice Date</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-40 ml-2" value={invoice.invoiceDate} onChange={e => updateField('invoiceDate', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ minWidth: 110 }}>Movie Name</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-48 ml-2" value={invoice.movieName} onChange={e => updateField('movieName', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Movie Version</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-24 ml-2" value={invoice.movieVersion} onChange={e => updateField('movieVersion', e.target.value)} /></span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-24 ml-2" value={invoice.language} onChange={e => updateField('language', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Screen Formate</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-24 ml-2" value={invoice.screenFormat} onChange={e => updateField('screenFormat', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Release Week</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-16 ml-2" value={invoice.week} onChange={e => updateField('week', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                <span style={{ minWidth: 110 }}>Cinema Week</span>
                <span style={{ fontWeight: 700, marginLeft: 8 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-16 ml-2" value={invoice.cinemaWeek} onChange={e => updateField('cinemaWeek', e.target.value)} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ minWidth: 110 }}>Screening Date</span>
                <span style={{ marginLeft: 8 }}>From <span style={{ fontWeight: 700 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.screeningFrom} onChange={e => updateField('screeningFrom', e.target.value)} /></span></span>
                <span style={{ marginLeft: 8 }}>To <span style={{ fontWeight: 700 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.screeningTo} onChange={e => updateField('screeningTo', e.target.value)} /></span></span>
              </div>
            </div>
          </div>

          {/* Data Table Section - two side-by-side tables with thinner borders */}
          <div style={{ display: 'flex', flexDirection: 'row', margin: 0, padding: 0 }}>
            {/* Left Table: Data Table */}
            <table style={{ width: '55%', borderCollapse: 'collapse', borderTop: '3px solid #000', borderBottom: '3px solid #000', borderLeft: '3px solid #000', borderRight: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '21%' }} />
              </colgroup>
            <thead>
                <tr>
                  <th style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Date</th>
                  <th style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Show</th>
                  <th style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Aud.</th>
                  <th style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Collection</th>
                  <th colSpan={2} style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Deduction</th>
              </tr>
            </thead>
            <tbody>
                {tableRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={row.date} onChange={e => updateTableRow(idx, 'date', e.target.value)} /></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}><input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={row.show} onChange={e => updateTableRow(idx, 'show', e.target.value)} /></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}><input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={row.aud} onChange={e => updateTableRow(idx, 'aud', e.target.value)} /></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}><input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={row.collection} onChange={e => updateTableRow(idx, 'collection', e.target.value)} /></td>
                    <td colSpan={2} style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}>
                      <input type="text" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-1/2" value={row.deduction} onChange={e => updateTableRow(idx, 'deduction', e.target.value)} />
                      <input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-1/2 ml-2" value={row.deductionAmt} onChange={e => updateTableRow(idx, 'deductionAmt', e.target.value)} />
                    </td>
                  </tr>
                ))}
                {/* Show Tax and Others as Deduction rows (label in Deduction column, value in DeductionAmt column) */}
                {Number(showTaxVal) > 0 && (
                  <tr>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td colSpan={2} style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', fontWeight: 700, textAlign: 'center', padding: 0 }}>Show Tax - <input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-1/2 ml-2" value={invoice.showTax} onChange={e => updateField('showTax', e.target.value)} /></td>
                  </tr>
                )}
                {Number(otherDeductionVal) > 0 && (
                  <tr>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center', padding: 0 }}></td>
                    <td colSpan={2} style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', fontWeight: 700, textAlign: 'center', padding: 0 }}>Others - <input type="number" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-1/2 ml-2" value={invoice.otherDeduction} onChange={e => updateField('otherDeduction', e.target.value)} /></td>
                  </tr>
                )}
                {/* Total Row */}
                <tr>
                  <td style={{ border: '1.5px solid #000', fontWeight: 700, textAlign: 'left', padding: 0 }}>Total</td>
                  <td style={{ border: '1.5px solid #000', fontWeight: 700, textAlign: 'center', padding: 0 }}>{totalShowVal}</td>
                  <td style={{ border: '1.5px solid #000', fontWeight: 700, textAlign: 'center', padding: 0 }}>{totalAudVal}</td>
                  <td style={{ border: '1.5px solid #000', fontWeight: 700, textAlign: 'center', padding: 0 }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td colSpan={2} style={{ border: '1.5px solid #000', fontWeight: 700, textAlign: 'center', padding: 0 }}>{totalDeduction ? totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</td>
                </tr>
              </tbody>
            </table>
            {/* Right Table: Particulars/Amount */}
            <table style={{ width: '45%', borderCollapse: 'collapse', border: '3px solid #000', borderLeft: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
              <colgroup>
                <col style={{ width: '60%' }} />
                <col style={{ width: '40%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', fontWeight: 700, padding: 0 }}>Particulars</th>
                  <th style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', fontWeight: 700, padding: 0 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center' }}>Total Collection</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center' }}>{totalCollectionVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center' }}>Total Deduction</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '1.5px solid #fff', textAlign: 'center' }}>{totalDeduction ? totalDeduction.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center' }}>Net Collection</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center' }}>{netCollection.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>Dist. Consideration @{distPercent}%</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #fff', textAlign: 'center', fontWeight: 700, padding: 0 }}>{distConsideration.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center' }}>Taxable Amount</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center' }}>{taxableAmount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
                {invoice.taxType === 'IGST' ? (
                  <tr>
                    <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>IGST @ {igstRateNum}%</td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>{igstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>CSGT @ {cgstRateNum}%</td>
                      <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>{cgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>SGST @ {sgstRateNum}%</td>
                      <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #fff', borderBottom: '2px solid #000', textAlign: 'center', padding: 0 }}>{sgstVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #000', borderBottom: 'none', textAlign: 'center', fontWeight: 700, padding: 0 }}>Net Amount</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #000', borderBottom: 'none', textAlign: 'center', fontWeight: 700, padding: 0 }}>{netAmountVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
            </tbody>
          </table>
        </div>

          {/* HSN/SAC, Description, Tax Summary, Net Amount, Amount in Words Section - perfectly aligned with particulars table, merged with blank space above */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #000', borderTop: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
            <colgroup>
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td style={{ border: '1.5px solid #000', textAlign: 'left' }}>HSN/SAC Code</td>
                <td style={{ border: '1.5px solid #000', textAlign: 'left', borderRight: '1.5px solid #000' }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-6" value={invoice.hsnSacCode} onChange={e => updateField('hsnSacCode', e.target.value)} /></td>
                <td style={{ border: '1.5px solid #000', borderLeft: 'none', borderRight: 'none', padding: 0 }} rowSpan={2}></td>
              </tr>
              <tr>
                <td style={{ border: '1.5px solid #000', borderBottom: '1.5px solid #000', textAlign: 'left' }}>Description</td>
                <td style={{ border: '1.5px solid #000', borderBottom: '1.5px solid #000', textAlign: 'left', borderRight: '1.5px solid #000' }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-64 ml-6" value={invoice.description} onChange={e => updateField('description', e.target.value)} /></td>
              </tr>
              {/* Amount in Words Row - merged, full width */}
              <tr>
                <td colSpan={3} style={{ border: '3px solid #000', borderTop: 'none', textAlign: 'left', fontWeight: 700, padding: '8px 12px', background: '#fff', marginTop: '1.5px' }}>
                  Amount in Words: {amountInWords}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words, Remarks, Terms, Bank */}
          <div className="w-full" style={{ fontSize: 13, position: 'relative', marginTop: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div className="p-2" style={{ position: 'relative', margin: 0, padding: '8px 16px' }}>
              {/* <div><b>Amount in Words:</b> {amountInWords}</div> */}
              <div className="mt-2"><b>Remark:</b> <textarea className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={invoice.remark} onChange={e => updateField('remark', e.target.value)} /></div>
              <div className="mt-2 font-bold">Terms & Conditions :-</div>
              <div style={{ margin: 0, padding: 0, lineHeight: '1.4' }}>
                1. Payment is due within 14 days from the date invoice. Interest @18% pa. will be charged for payment delayed beyond that period.<br /><br />
                2. All cheques / drafts should be crossed and made payable to<br />
                <span style={{ fontWeight: 'bold', marginLeft: '20px' }}>FIRST FILM STUDIOS LLP</span><br />
                <span style={{ marginLeft: '20px' }}>Bank Detail: - HDFC BANK LIMITED A/c No.: <b>50200099601176</b> IFSC CODE: <b>HDFC0000543</b></span><br />
                <span style={{ marginLeft: '20px' }}>BRANCH: AHURA CENTRE, ANDHERI WEST</span><br /><br />
                3. Subject to Mumbai jurisdiction
              </div>
        </div>
          </div>

          {/* Footer: Stamp and Signature */}
          <div className="flex flex-row items-end justify-end w-full p-4" style={{ minHeight: 100, position: 'relative', zIndex: 1 }}>
            <div style={{ marginRight: 32, position: 'relative' }}>
              <img src="/inovice_formatting/Stamp_mum.png" alt="Stamp" style={{ width: 120, height: 120, objectFit: 'contain' }} />
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
  );
};

export default EditPreview; 