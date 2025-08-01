"use client";
import React, { useState } from "react";
import InvoiceForm from "../../components/InvoiceForm";
import InvoicePreview from "../../components/InvoicePreview";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from 'react-dom/client';

export default function CreateInvoicePage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [backendInvoices, setBackendInvoices] = useState<any[]>([]); // NEW
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [share, setShare] = useState(45); // Default share %
  const [gstType, setGstType] = useState('CGST/SGST');
  const [gstRate, setGstRate] = useState(18);
  const [showPreview, setShowPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<'frontend' | 'backend'>('frontend'); // NEW
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [duplicateInvoices, setDuplicateInvoices] = useState<any[]>([]);

  // Handler to receive invoices and share/gst from InvoiceForm
  const handleFormChange = (data: any[], isNewUpload: boolean = false) => {
    setInvoices(data || []);
    setSelectedIdx(0);
    
    // Only reset preview and upload state if this is a new file upload
    if (isNewUpload) {
      setShowPreview(false);
      setHasUploaded(false);
      setBackendInvoices([]);
      setDuplicateInvoices([]);
      setSelectedInvoices([]);
      setSelectAll(false);
    }
    
    if (data && data.length) {
      setShare(data[0].share ?? 45);
      setGstType(data[0].gstType ?? 'CGST/SGST');
      setGstRate(data[0].gstRate ?? 18);
    }
  };

  // New: Upload Excel and invoice data to backend
  // Check for duplicate invoices in backend
  const checkForDuplicates = async (invoicesToCheck: any[]) => {
    try {
      const fetchRes = await fetch('https://backend-invoice-gen.onrender.com/api/invoices');
      if (fetchRes.ok) {
        const backendInvoices = await fetchRes.json();
        
        const duplicates = [];
        
        for (const newInvoice of invoicesToCheck) {
          for (const existingInvoice of backendInvoices) {
            // Compare EVERY SINGLE FIELD - only warn if ALL fields are exactly identical
            const isDuplicate = 
              // Basic invoice info
              newInvoice.clientName === existingInvoice.data?.clientName &&
              newInvoice.invoiceDate === existingInvoice.data?.invoiceDate &&
              newInvoice.dueDate === existingInvoice.data?.dueDate &&
              newInvoice.invoiceNo === existingInvoice.data?.invoiceNo &&
              
              // Financial details
              newInvoice.totalAmount === existingInvoice.data?.totalAmount &&
              newInvoice.subTotal === existingInvoice.data?.subTotal &&
              newInvoice.gstAmount === existingInvoice.data?.gstAmount &&
              newInvoice.finalAmount === existingInvoice.data?.finalAmount &&
              
              // Share and GST
              newInvoice.share === existingInvoice.data?.share &&
              newInvoice.gstType === existingInvoice.data?.gstType &&
              newInvoice.gstRate === existingInvoice.data?.gstRate &&
              
              // Client details
              newInvoice.clientEmail === existingInvoice.data?.clientEmail &&
              newInvoice.clientPhone === existingInvoice.data?.clientPhone &&
              newInvoice.clientAddress === existingInvoice.data?.clientAddress &&
              
              // Other details
              newInvoice.paymentTerms === existingInvoice.data?.paymentTerms &&
              newInvoice.notes === existingInvoice.data?.notes &&
              
              // Table data - exact match including all table fields
              newInvoice.table?.length === existingInvoice.data?.table?.length &&
              JSON.stringify(newInvoice.table) === JSON.stringify(existingInvoice.data?.table) &&
              
              // Calculated totals - these must also match exactly
              newInvoice.totalShow === existingInvoice.data?.totalShow &&
              newInvoice.totalAud === existingInvoice.data?.totalAud &&
              newInvoice.totalCollection === existingInvoice.data?.totalCollection &&
              newInvoice.showTax === existingInvoice.data?.showTax &&
              newInvoice.otherDeduction === existingInvoice.data?.otherDeduction;
            
            if (isDuplicate) {
              duplicates.push({
                new: newInvoice,
                existing: existingInvoice
              });
            }
          }
        }
        
        return duplicates;
      }
    } catch (err) {
      console.error('Error checking for duplicates:', err);
    }
    return [];
  };

  const uploadToBackend = async () => {
    if (!invoices.length) return;
    try {
      console.log('Uploading to backend...');
      // Find the file input
      const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('excel', file);
      formData.append('invoiceData', JSON.stringify(invoices)); // send all invoices as array
      const res = await fetch('https://backend-invoice-gen.onrender.com/api/invoice-upload', {
        method: 'POST',
        body: formData,
      });
      console.log('Upload response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Upload error:', errorText);
        throw new Error('Failed to upload invoice');
      }
      // After upload, fetch the latest invoices from backend
      const fetchRes = await fetch('https://backend-invoice-gen.onrender.com/api/invoices');
      console.log('Fetch response status:', fetchRes.status);
      if (fetchRes.ok) {
        const backendAll = await fetchRes.json();
        const { invoiceIds } = await res.json();
        console.log('Uploaded invoice IDs:', invoiceIds);
        const newBackendInvoices = backendAll.filter((inv: { invoiceId: string }) => invoiceIds.includes(inv.invoiceId));
        setBackendInvoices(newBackendInvoices.map((inv: { data: any, invoiceId: string, invoiceNo?: string }) => ({ 
          ...inv.data, 
          invoiceId: inv.invoiceId,
          invoiceNo: inv.invoiceNo || inv.invoiceId // Use invoiceNo from backend or fallback to invoiceId
        })));
        setSelectedIdx(0);
        setShowPreview(true);
        setHasUploaded(true); // Mark as uploaded
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const handlePreviewClick = async () => {
    // Check if data has already been uploaded
    if (hasUploaded) {
      setShowWarningDialog(true);
      return;
    }
    
    // Check for duplicate invoices in backend
    const duplicates = await checkForDuplicates(invoices);
    if (duplicates.length > 0) {
      setDuplicateInvoices(duplicates);
      setShowWarningDialog(true);
      return;
    }
    
    // Show preview immediately with frontend data
    setShowPreview(true);
    setPreviewSource('frontend');
    
    // Then upload to backend and update
    await uploadToBackend();
    setPreviewSource('backend');
  };

  // Handle warning dialog confirmation
  const handleWarningConfirm = async () => {
    setShowWarningDialog(false);
    
    // Show preview immediately with frontend data
    setShowPreview(true);
    setPreviewSource('frontend');
    
    // Then upload to backend and update
    await uploadToBackend();
    setPreviewSource('backend');
  };

  // Handle warning dialog cancel
  const handleWarningCancel = () => {
    setShowWarningDialog(false);
    setDuplicateInvoices([]);
  };

  // Download a single invoice as PDF
  const handleDownloadInvoice = async (inv: any, idx: number) => {
    // Get the exact invoice number that will be used in preview
    const exactInvoiceNo = inv.invoiceId || inv.invoiceNo || inv["Invoice No"] || `INV${idx + 1}`;
    
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    document.body.appendChild(hiddenDiv);
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview data={{ ...inv, share, gstType, gstRate, invoiceNo: exactInvoiceNo }} showDownloadButton={false} isPdfExport={true} />
    );
    await new Promise(r => setTimeout(r, 400));
    const images = Array.from(hiddenDiv.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => { img.onload = img.onerror = res; });
    }));
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
    pdf.save(`Invoice_${exactInvoiceNo}.pdf`);
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
  };

  // Download all selected invoices
  const handleDownloadAll = async () => {
    const currentInvoices = previewSource === 'backend' ? backendInvoices : invoices;
    for (const idx of selectedInvoices) {
      await handleDownloadInvoice(currentInvoices[idx], idx);
    }
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedInvoices(invoices.map((_, idx) => idx));
    } else {
      setSelectedInvoices([]);
    }
  };

  // Handle select one
  const handleSelectOne = (idx: number, checked: boolean) => {
    if (checked) {
      setSelectedInvoices(prev => [...prev, idx]);
    } else {
      setSelectedInvoices(prev => prev.filter(i => i !== idx));
      setSelectAll(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Bar */}
      <div className="flex items-center justify-center px-8 py-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 shadow-md border-b" style={{ height: 72 }}>
        <h1 className="text-xl font-bold text-white text-center w-full">Invoice Creation</h1>
      </div>
      <main className="flex flex-1 overflow-hidden">
        {/* Left: Invoice List */}
        <aside className="w-64 bg-gradient-to-b from-white via-orange-50 to-orange-100 border-r border-gray-200 flex flex-col rounded-tr-xl rounded-br-xl shadow-md">
          <div className="p-4 border-b font-bold text-lg text-orange-700 tracking-wide bg-white/80 rounded-tr-xl flex items-center gap-2">
            <input type="checkbox" checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} />
            <span>Invoice List</span>
          </div>
          <div className="flex flex-row items-center justify-between px-4 py-2">
            <button
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-1 rounded transition text-xs shadow"
              onClick={handleDownloadAll}
              disabled={selectedInvoices.length === 0}
            >
              Download All
            </button>
            <span className="text-xs text-gray-500">{selectedInvoices.length} selected</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(previewSource === 'backend' ? backendInvoices : invoices).length === 0 && (
              <div className="p-4 text-xs text-gray-400">No invoices loaded.</div>
            )}
            {(previewSource === 'backend' ? backendInvoices : invoices).map((inv, idx) => (
              <div
                key={idx}
                className={`cursor-pointer px-4 py-3 border-b text-sm transition-all duration-150 rounded-md my-2 mx-2 font-medium shadow-sm ${selectedIdx === idx ? "bg-orange-200 font-bold text-orange-900 ring-2 ring-orange-400" : "hover:bg-orange-50 hover:shadow-md text-gray-800"}`}
                onClick={() => setSelectedIdx(idx)}
                style={{ boxShadow: selectedIdx === idx ? '0 2px 8px rgba(255,140,0,0.10)' : undefined }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.includes(idx)}
                    onChange={e => { e.stopPropagation(); handleSelectOne(idx, e.target.checked); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <span>{inv["Invoice No"] || inv["invoiceNo"] || inv["invoiceId"] || inv["clientName"] || `Invoice #${idx + 1}`}</span>
                </div>
                <button
                  className="ml-2 bg-orange-500 hover:bg-orange-700 text-white font-bold px-2 py-1 rounded text-xs shadow"
                  onClick={e => { e.stopPropagation(); handleDownloadInvoice(inv, idx); }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </aside>
        {/* Center: Invoice Preview */}
        <section className="flex-1 p-6 overflow-y-auto bg-gray-50 flex justify-center items-start">
          {showPreview && (
            previewSource === 'backend' && backendInvoices.length > 0 ? (
              <InvoicePreview data={{
                ...backendInvoices[selectedIdx],
                invoiceId: backendInvoices[selectedIdx]?.invoiceId,
                invoiceNo: backendInvoices[selectedIdx]?.invoiceNo || backendInvoices[selectedIdx]?.invoiceId // Use invoiceNo or fallback
              }} />
            ) : invoices.length > 0 ? (
              <InvoicePreview data={invoices[selectedIdx]} />
            ) : (
              <div className="text-gray-400 text-center w-full mt-24">Upload an Excel file to preview invoices.</div>
            )
          )}
          {!showPreview && (
            <div className="text-gray-400 text-center w-full mt-24">Upload an Excel file to preview invoices.</div>
          )}
        </section>
        {/* Right: InvoiceForm Sidebar */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col items-center p-6">
          <InvoiceForm onChange={handleFormChange} onPreview={handlePreviewClick} />
        </aside>
      </main>
      <footer className="bg-white shadow p-4 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Invoice Management. All rights reserved.
      </footer>
      
      {/* Warning Dialog for Duplicate Upload */}
      {showWarningDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">Duplicate Invoice Warning</h3>
              </div>
            </div>
            <div className="mt-2">
              {hasUploaded ? (
                <>
                  <p className="text-sm text-gray-600">
                    This data has already been uploaded to the database. Creating duplicate invoices will:
                  </p>
                  <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                    <li>Generate new invoice numbers</li>
                    <li>Create duplicate entries in the database</li>
                    <li>Increase the invoice counter</li>
                  </ul>
                </>
              ) : duplicateInvoices.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600">
                    Found {duplicateInvoices.length} invoice(s) with <strong>EVERY SINGLE FIELD IDENTICAL</strong> in the database:
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {duplicateInvoices.map((dup, idx) => (
                      <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-1">
                        <strong>Client:</strong> {dup.new.clientName} | 
                        <strong>Date:</strong> {dup.new.invoiceDate} | 
                        <strong>Amount:</strong> ₹{dup.new.totalAmount} | 
                        <strong>Share:</strong> {dup.new.share}% | 
                        <strong>GST:</strong> {dup.new.gstType} @ {dup.new.gstRate}% | 
                        <strong>Items:</strong> {dup.new.items?.length || 0}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    These invoices have <strong>EVERY SINGLE FIELD IDENTICAL</strong> to existing invoices. Creating them will generate new invoice numbers and create exact duplicate entries.
                  </p>
                </>
              ) : null}
              <p className="mt-3 text-sm font-medium text-gray-900">
                Do you want to proceed with uploading this data?
              </p>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={handleWarningCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWarningConfirm}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                Proceed & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 