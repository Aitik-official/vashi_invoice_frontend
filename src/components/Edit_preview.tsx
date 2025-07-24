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
  const tableRows = Array.isArray(invoice.table) ? invoice.table : [];
  const totalShowVal = tableRows.reduce((sum, row) => sum + safeNumber(row.show), 0);
  const totalAudVal = tableRows.reduce((sum, row) => sum + safeNumber(row.aud), 0);
  const totalCollectionVal = tableRows.reduce((sum, row) => sum + safeNumber(row.collection), 0);
  const showTaxVal = safeNumber(invoice.showTax) || 0;
  const otherDeductionVal = safeNumber(invoice.otherDeduction) || 0;
  const totalDeduction = showTaxVal + otherDeductionVal;
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
    // Create a hidden div for InvoicePreview
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    document.body.appendChild(hiddenDiv);
    // Render InvoicePreview into hiddenDiv
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview
        data={{
          ...invoice,
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
    await new Promise(r => setTimeout(r, 200));
    // Use html2canvas on hiddenDiv
    const canvas = await html2canvas(hiddenDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = Math.min(800, pageWidth - 80);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    const x = (pageWidth - pdfWidth) / 2;
    const y = 40;
    pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
    pdf.save(`Invoice_${invoice.invoiceNo}.pdf`);
    // Clean up
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
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
        <div className="flex flex-row items-stretch" style={{ background: '#e46d04', borderBottom: '2px solid #000', minHeight: 130, height: 130 }}>
          <div style={{ width: 220, height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', background: 'transparent', padding: 0, margin: 0 }}>
            <img src="/inovice_formatting/logo_wbg.png" alt="Logo" style={{ height: '100%', width: '100%', objectFit: 'contain', margin: 0, padding: 0 }} />
          </div>
          <div className="flex-1 flex flex-col items-end justify-center pr-8" style={{ color: '#fff', textAlign: 'right', fontFamily: 'Arial, Helvetica, sans-serif', height: '100%', paddingTop: 8, paddingBottom: 8, justifyContent: 'center' }}>
            <div className="font-bold" style={{ fontSize: 20, letterSpacing: 1, lineHeight: 1.1 }}>FIRST FILM STUDIOS LLP</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>26-104, RIDDHI SIDHI, CHS, CSR COMPLEX, OLD MHADA,</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>KANDIVALI WEST, MUMBAI - 400067, MAHARASHTRA</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>info@firstfilmstudios.com</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>GST- {invoice.gst}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>PAN No:- {invoice.pan}</div>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}>LLP Reg. No.- {invoice.regNo}</div>
          </div>
        </div>

        {/* Main Invoice Box */}
        <div className="border border-black m-4" style={{ background: '#fff', padding: 0, border: '3px solid #000' }}>
          {/* Top Details - Two Columns */}
          <div className="flex flex-row w-full" style={{ borderBottom: '3px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, minHeight: 160 }}>
            {/* Left Column */}
            <div className="flex-1 p-4" style={{ borderRight: '3px solid #000', paddingTop: 18, paddingBottom: 18, paddingLeft: 8, paddingRight: 8 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                <span style={{ minWidth: 110 }}>Screening Date</span>
                <span style={{ marginLeft: 8, minWidth: 120 }}>From <span style={{ fontWeight: 700 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.screeningFrom} onChange={e => updateField('screeningFrom', e.target.value)} /></span></span>
                <span style={{ marginLeft: 8, minWidth: 120 }}>To <span style={{ fontWeight: 700 }}><input type="date" className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-32 ml-2" value={invoice.screeningTo} onChange={e => updateField('screeningTo', e.target.value)} /></span></span>
              </div>
            </div>
          </div>

          {/* Data Table Section - two side-by-side tables with thinner borders */}
          <div style={{ display: 'flex', flexDirection: 'row', margin: 0, padding: 0 }}>
            {/* Left Table: Data Table */}
            <table style={{ width: '50%', borderCollapse: 'collapse', border: '1.5px solid #000', borderLeft: '1.5px solid #fff', borderTop: 'none', borderBottom: 'none', borderRight: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
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
            <table style={{ width: '50%', borderCollapse: 'collapse', border: '1.5px solid #000', borderLeft: 'none', borderRight: '1.5px solid #fff', borderTop: 'none', borderBottom: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
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
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1.5px solid #000', borderTop: '1.5px solid #000', borderBottom: '2px solid #000', textAlign: 'center', fontWeight: 700, padding: 0 }}>Net Amount</td>
                  <td style={{ borderLeft: '1.5px solid #000', borderRight: '2px solid #000', borderTop: '1.5px solid #000', borderBottom: '2px solid #000', textAlign: 'center', fontWeight: 700, padding: 0 }}>{netAmountVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                </tr>
            </tbody>
          </table>
        </div>

          {/* HSN/SAC, Description, Tax Summary, Net Amount, Amount in Words Section - perfectly aligned with particulars table, merged with blank space above */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', borderTop: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, margin: 0 }}>
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
                <td style={{ border: '1.5px solid #000', textAlign: 'left' }}>Description</td>
                <td style={{ border: '1.5px solid #000', textAlign: 'left', borderRight: '1.5px solid #000' }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-64 ml-6" value={invoice.description} onChange={e => updateField('description', e.target.value)} /></td>
              </tr>
              {/* Amount in Words Row - merged, full width */}
              <tr>
                <td colSpan={3} style={{ border: '1.5px solid #000', borderTop: 'none', textAlign: 'left', fontWeight: 700, padding: '8px 12px', background: '#fff' }}>
                  Amount in Words: {amountInWords}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words, Remarks, Terms, Bank */}
          <div className="w-full border-t border-black" style={{ fontSize: 13 }}>
            <div className="p-2">
              {/* <div><b>Amount in Words:</b> {amountInWords}</div> */}
              <div className="mt-2"><b>Remark:</b> <textarea className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-full" value={invoice.remark} onChange={e => updateField('remark', e.target.value)} /></div>
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
            <div style={{ marginRight: 32 }}>
              <img src="/inovice_formatting/Stamp_mum.png" alt="Stamp" style={{ width: 120, height: 120, objectFit: 'contain' }} />
            </div>
            <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <div className="font-bold" style={{ fontSize: 15, marginBottom: 40 }}><input className="border-b border-dashed border-gray-400 focus:border-orange-500 outline-none w-64 ml-6" value={invoice.signatory} onChange={e => updateField('signatory', e.target.value)} /></div>
              <div className="italic" style={{ fontSize: 13 }}>(Authorised Signatory)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPreview; 