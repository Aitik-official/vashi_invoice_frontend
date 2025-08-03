"use client";
import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import InvoicePreview from './InvoicePreview';
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
  invoiceId?: string; // Added for invoiceId
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
}

// Example structure for invoice data (expand as needed)
const defaultInvoice = {
  clientName: "MIRAJ ENTERTAINMENT LIMITED",
  clientAddress: "3RD, 2 ACME PLAZA, KURLA ROAD, OPP SANGAM BLDG CINEMA\nANDHERI EAST, MUMBAI, MAHARASHTRA, 400059",
  panNo: "AAFCM5147R",
  gstinNo: "27AAFCM5147R1ZP",
  property: "Miraj Cinemas Dattani",
  centre: "MUMBAI",
  placeOfService: "MAHARASHTRA",
  businessTerritory: "MUMBAI",
  invoiceNo: "NV060",
  invoiceId: "NV060",
  invoiceDate: "2025-06-23",
  movieName: "NARIVETTA",
  movieVersion: "2D",
  language: "MALAYALAM",
  screenFormat: "1",
  week: "1",
  cinemaWeek: "1",
  screeningFrom: "2025-05-23",
  screeningTo: "2025-05-29",
  hsnSacCode: "997332",
  description: "Theatrical Exhibition Rights",
  distributionPercent: 45,
  table: [
    { date: "2025-05-23", show: 1, aud: 10, collection: 1542.39, deduction: "", deductionAmt: 0 },
    { date: "2025-05-24", show: 1, aud: 2, collection: 389.82, deduction: "", deductionAmt: 0 },
  ],
  showTax: 1200,
  otherDeduction: 120,
  totalShow: 7,
  totalAud: 20,
  totalCollection: 4175.11,
  cgstRate: 9,
  sgstRate: 9,
  taxType: "GST",
  gstRate: 18,
  remark: "",
  terms: [],
  signatory: "For FIRST FILM STUDIOS LLP",
  regNo: "ACH-2259",
  firmName: "FIRST FILM STUDIOS LLP",
  address: "26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA, KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA",
  gst: "27AAJFF7915J1Z1",
  pan: "AAJFF7915J",
  email: "info@firstfilmstudios.com",
};

const EditPreview = ({ data = defaultInvoice, onChange, showDownloadButton = true }: { data?: typeof defaultInvoice, onChange?: (invoice: any) => void, showDownloadButton?: boolean }) => {
  const [invoice, setInvoice] = useState({ ...defaultInvoice, ...data });
  const previewRef = useRef<HTMLDivElement>(null);
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

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
      const newTable = prev.table.map((row, i) =>
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

  // Generate 7 days of dates from screening start to end date
  const generateDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      dates.push(`${day}-${month}-${year}`);
    }
    
    return dates;
  };

  // Generate table rows with proper date format
  const generateTableRows = (originalRows: Array<{date: string; show: number; aud: number; collection: number; deduction: string; deductionAmt: number}>): Array<{date: string; show: number; aud: number; collection: number; deduction: string; deductionAmt: number}> => {
    const dateRange = generateDateRange(invoice.screeningFrom, invoice.screeningTo);
    
    if (dateRange.length === 0) {
      return originalRows;
    }
    
    // Create a map of existing data by date for quick lookup
    const existingDataMap = new Map();
    originalRows.forEach(row => {
      if (row.date) {
        // Normalize date format for comparison - handle multiple formats
        let normalizedDate = row.date;
        
        // Handle DD/MM/YYYY format
        if (normalizedDate.includes('/')) {
          const parts = normalizedDate.split('/');
          if (parts.length === 3) {
            normalizedDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
          }
        }
        
        // Handle DD-MM-YYYY format (already correct)
        if (normalizedDate.includes('-') && normalizedDate.split('-').length === 3) {
          // Keep as is
        }
        
        // Handle YYYY-MM-DD format
        if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const parts = normalizedDate.split('-');
          normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
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
      // Get the exact invoice number that is displayed in the preview
      const exactInvoiceNo = (invoice as any)["Invoice No"] || '-';
      
      // Create a hidden div for InvoicePreview
      let hiddenDiv = document.createElement('div');
      hiddenDiv.style.position = 'fixed';
      hiddenDiv.style.left = '-9999px';
      hiddenDiv.style.top = '0';
      hiddenDiv.style.width = '800px';
      hiddenDiv.style.background = '#fff';
      // Remove any problematic CSS that might cause oklch errors
      hiddenDiv.style.color = '#000';
      hiddenDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
      
              // Add a style tag to override any oklch colors and preserve stamp size
        const styleTag = document.createElement('style');
        styleTag.textContent = `
          * {
            color: #000 !important;
            background-color: #fff !important;
            border-color: #000 !important;
          }
          .bg-orange-600 { background-color: #ea580c !important; }
          .bg-blue-600 { background-color: #2563eb !important; }
          .text-white { color: #fff !important; }
          .text-black { color: #000 !important; }
          .border-black { border-color: #000 !important; }
          
          /* Preserve stamp size in PDF - prevent any distortion */
          img[src*="Stamp_mum.png"] {
            width: 144px !important; /* 120px + 20% = 144px */
            height: 120px !important;
            object-fit: contain !important;
            min-width: 144px !important;
            max-width: 144px !important;
            min-height: 120px !important;
            max-height: 120px !important;
            aspect-ratio: 1.2/1 !important; /* 20% wider */
            transform: none !important;
            scale: 1 !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            box-sizing: border-box !important;
            display: block !important;
            position: static !important;
          }
          
          /* Prevent any flex container from compressing the stamp */
          div:has(img[src*="Stamp_mum.png"]) {
            width: 144px !important; /* 120px + 20% = 144px */
            height: 120px !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 144px !important;
            max-width: 144px !important;
            min-height: 120px !important;
            max-height: 120px !important;
          }
          
          /* Prevent parent containers from affecting stamp */
          div:has(div:has(img[src*="Stamp_mum.png"])) {
            flex-shrink: 0 !important;
            min-width: fit-content !important;
          }
          
          /* Container for stamp to prevent stretching */
          div:has(img[src*="Stamp_mum.png"]) {
            width: 120px !important;
            height: 120px !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          /* Fix terms and conditions positioning */
          .w-full[style*="fontSize: 13"] {
            position: relative !important;
            margin-top: 16px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            position: static !important;
            transform: none !important;
          }
          
          /* Ensure terms content stays in position */
          .p-2[style*="position: relative"] {
            position: relative !important;
            margin: 0 !important;
            padding: 8px 16px !important;
            position: static !important;
            transform: none !important;
          }
          

        `;
      hiddenDiv.appendChild(styleTag);
      document.body.appendChild(hiddenDiv);
      
      // Render InvoicePreview into hiddenDiv with exact invoice number
      const reactRoot = createRoot(hiddenDiv);
      reactRoot.render(
        <InvoicePreview
          data={{
            ...invoice,
            invoiceNo: exactInvoiceNo, // Ensure exact invoice number is used
            distributionPercent: String(invoice.distributionPercent ?? ''),
            cgstRate: String(invoice.cgstRate ?? ''),
            sgstRate: String(invoice.sgstRate ?? ''),
            gstRate: String(invoice.gstRate ?? ''),
            taxType: invoice.taxType === 'GST' || invoice.taxType === 'IGST' ? invoice.taxType : undefined,
          }}
          showDownloadButton={false}
        />
      );
      
      // Wait for render
      await new Promise(r => setTimeout(r, 600));
      
      // Remove any problematic CSS classes that might contain oklch
      const allElements = hiddenDiv.querySelectorAll('*');
      allElements.forEach(element => {
        if (element instanceof HTMLElement) {
          // Remove any classes that might contain problematic CSS
          const classesToRemove = Array.from(element.classList).filter(cls => 
            cls.includes('bg-') || cls.includes('text-') || cls.includes('border-')
          );
          classesToRemove.forEach(cls => element.classList.remove(cls));
        }
      });
      
      // Ensure stamp maintains exact size and aspect ratio
      const stampElements = hiddenDiv.querySelectorAll('img[src*="Stamp_mum.png"]');
      stampElements.forEach((stamp: Element) => {
        if (stamp instanceof HTMLElement) {
          stamp.style.width = '144px'; /* 120px + 20% = 144px */
          stamp.style.height = '120px';
          stamp.style.objectFit = 'contain';
          stamp.style.minWidth = '144px';
          stamp.style.maxWidth = '144px';
          stamp.style.minHeight = '120px';
          stamp.style.maxHeight = '120px';
          stamp.style.aspectRatio = '1.2/1'; /* 20% wider */
          stamp.style.transform = 'none';
          stamp.style.scale = '1';
          stamp.style.flexShrink = '0';
          stamp.style.flexGrow = '0';
          stamp.style.boxSizing = 'border-box';
          
          // Also set the container properties
          const container = stamp.parentElement;
          if (container) {
            container.style.width = '144px'; /* 120px + 20% = 144px */
            container.style.height = '120px';
            container.style.flexShrink = '0';
            container.style.flexGrow = '0';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.minWidth = '144px';
            container.style.maxWidth = '144px';
            container.style.minHeight = '120px';
            container.style.maxHeight = '120px';
          }
          
          // Also set parent container properties to prevent compression
          const parentContainer = container?.parentElement;
          if (parentContainer) {
            parentContainer.style.flexShrink = '0';
            parentContainer.style.minWidth = 'fit-content';
          }
        }
      });
      
      // Use html2canvas with optimized settings for minimum file size
      const canvas = await html2canvas(hiddenDiv, { 
        scale: 1.2, // Reduced scale to make content smaller and fit better
        backgroundColor: '#fff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        removeContainer: true,
        imageTimeout: 5000, // Reduced timeout
        onclone: (clonedDoc) => {
          // Ensure stamp maintains exact dimensions in cloned document
          const clonedStamp = clonedDoc.querySelector('img[src*="Stamp_mum.png"]');
          if (clonedStamp instanceof HTMLElement) {
            clonedStamp.style.width = '144px'; /* 120px + 20% = 144px */
            clonedStamp.style.height = '120px';
            clonedStamp.style.objectFit = 'contain';
            clonedStamp.style.aspectRatio = '1.2/1'; /* 20% wider */
            clonedStamp.style.transform = 'none';
            clonedStamp.style.scale = '1';
            clonedStamp.style.flexShrink = '0';
            clonedStamp.style.flexGrow = '0';
          }
        },
        ignoreElements: (element) => {
          // Ignore elements with problematic CSS
          const style = window.getComputedStyle(element);
          return style.color.includes('oklch') || 
                 style.backgroundColor.includes('oklch') ||
                 style.borderColor.includes('oklch');
        }
      });
      
      // Optimize image data for minimum size
      const imgData = canvas.toDataURL("image/jpeg", 0.8); // Use JPEG with 80% quality instead of PNG
      const pdf = new jsPDF({ 
        orientation: "p", 
        unit: "pt", 
        format: "a4",
        compress: true // Enable PDF compression
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      
      // Calculate dimensions to fit content properly with margins
      const pdfWidth = Math.min(650, pageWidth - 80); // Smaller width with more margin
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Check if content fits on one page, if not, scale it down
      let finalPdfWidth = pdfWidth;
      let finalPdfHeight = pdfHeight;
      let x = (pageWidth - finalPdfWidth) / 2;
      let y = 50; // Increased top margin
      
      if (pdfHeight > pageHeight - 100) {
        // Content is too tall, scale it down to fit
        const scale = (pageHeight - 100) / pdfHeight;
        finalPdfHeight = pageHeight - 100;
        finalPdfWidth = pdfWidth * scale;
        x = (pageWidth - finalPdfWidth) / 2;
        y = 50; // Keep top margin
      }
      
      pdf.addImage(imgData, "JPEG", x, y, finalPdfWidth, finalPdfHeight, undefined, 'FAST'); // Use FAST compression
      const filename = exactInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${exactInvoiceNo}.pdf`;
      pdf.save(filename);
      
      // Clean up
      reactRoot.unmount();
      document.body.removeChild(hiddenDiv);
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
        className="w-[800px] mx-auto bg-white shadow-2xl rounded-md p-0 text-black font-sans border border-black"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1100px', boxSizing: 'border-box', position: 'relative', overflowY: 'auto', overflowX: 'hidden', marginTop: 32, marginBottom: 32 }}
      >
        {/* Header */}
        <div className="flex flex-row items-stretch" style={{ background: '#fff', minHeight: 130, height: 130 }}>
          <div style={{ width: 220, height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', background: 'transparent', padding: 0, margin: 0 }}>
            <img src="/inovice_formatting/1stfflogo.jpg" alt="Logo" style={{ height: '100%', width: '100%', objectFit: 'contain', margin: 0, padding: 0 }} />
          </div>
          <div className="flex-1 flex flex-col items-end justify-center pr-8" style={{ color: '#000', textAlign: 'right', fontFamily: 'Arial, Helvetica, sans-serif', height: '100%', paddingTop: 8, paddingBottom: 8, justifyContent: 'center' }}>
            <div className="font-bold" style={{ fontSize: 20, letterSpacing: 1, lineHeight: 1.1, marginBottom: 8 }}>FIRST FILM STUDIOS LLP</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA,</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>info@firstfilmstudios.com</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>GST- {invoice.gst}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>PAN No:- {invoice.pan}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>LLP Reg. No.- {invoice.regNo}</div>
          </div>
        </div>

        {/* Main Invoice Box */}
        <div className="m-4" style={{ background: '#fff', padding: 0 }}>
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