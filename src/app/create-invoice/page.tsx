"use client";
import React, { useState } from "react";
import InvoiceForm from "../../components/InvoiceForm";
import InvoicePreview from "../../components/InvoicePreview";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';

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
    try {
      // Get the exact invoice number that will be used in preview
      const exactInvoiceNo = (inv as any)["Invoice No"] || '-';
      
      // Use the optimized PDF generation function with individual settings
      const { filename, data } = await generatePDFForZip({ ...inv, share, gstType, gstRate, invoiceNo: exactInvoiceNo }, idx);
      
      // Convert Uint8Array to Blob and download
      const blob = new Blob([data], { type: 'application/pdf' });
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

  // Download all selected invoices
  // Function to generate PDF for ZIP (optimized for size)
  const generatePDFForZip = async (invoice: any, index: number): Promise<{ filename: string, data: Uint8Array }> => {
    try {
      // Create a hidden div for InvoicePreview
      let hiddenDiv = document.createElement('div');
      hiddenDiv.style.position = 'fixed';
      hiddenDiv.style.left = '-9999px';
      hiddenDiv.style.top = '0';
      hiddenDiv.style.width = '800px';
      hiddenDiv.style.background = '#fff';
      hiddenDiv.style.color = '#000';
      hiddenDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
      
      // Add optimized style tag for minimum file size
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
        
        /* Prevent any layout shifts in terms section */
        ol[style*="margin: 0"] {
          margin: 0 !important;
          padding: 0 !important;
          position: relative !important;
        }
        
        li[style*="marginBottom: '8px'"] {
          margin-bottom: 8px !important;
          line-height: 1.4 !important;
          position: relative !important;
        }
      `;
      hiddenDiv.appendChild(styleTag);
      document.body.appendChild(hiddenDiv);

      // Render InvoicePreview into hiddenDiv
      const reactRoot = createRoot(hiddenDiv);
      reactRoot.render(
        <InvoicePreview data={invoice} showDownloadButton={false} isPdfExport={true} />
      );

      // Wait for render and images to load
      await new Promise(r => setTimeout(r, 500)); // Reduced wait time
      
      // Remove problematic CSS classes
      const allElements = hiddenDiv.querySelectorAll('*');
      allElements.forEach(element => {
        if (element instanceof HTMLElement) {
          const classesToRemove = Array.from(element.classList).filter(cls => 
            cls.includes('bg-') || cls.includes('text-') || cls.includes('border-')
          );
          classesToRemove.forEach(cls => element.classList.remove(cls));
        }
      });
      
      // Ensure stamp maintains exact size
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
          
          const parentContainer = container?.parentElement;
          if (parentContainer) {
            parentContainer.style.flexShrink = '0';
            parentContainer.style.minWidth = 'fit-content';
          }
        }
      });
      
      // Use html2canvas with optimized settings for minimum file size
      const canvas = await html2canvas(hiddenDiv, { 
        scale: 1.2, // Further reduced for ZIP files
        backgroundColor: '#fff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        removeContainer: true,
        imageTimeout: 3000, // Reduced timeout
        onclone: (clonedDoc) => {
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
          const style = window.getComputedStyle(element);
          return style.color.includes('oklch') || 
                 style.backgroundColor.includes('oklch') ||
                 style.borderColor.includes('oklch');
        }
      });
      
      // Optimize image data for minimum size
      const imgData = canvas.toDataURL("image/jpeg", 0.7); // Lower quality for ZIP
      const pdf = new jsPDF({ 
        orientation: "p", 
        unit: "pt", 
        format: "a4",
        compress: true
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate dimensions to fit content properly with margins
      const pdfWidth = Math.min(600, pageWidth - 80); // Smaller width with more margin for ZIP
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      
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
      
      pdf.addImage(imgData, "JPEG", x, y, finalPdfWidth, finalPdfHeight, undefined, 'FAST');
      
      const pdfData = pdf.output('arraybuffer');
      const invoiceNo = invoice.invoiceNo || invoice.invoiceId || (invoice as any)?.["Invoice No"] || '-';
      const filename = invoiceNo === '-' ? `Invoice_${Date.now()}_${index}.pdf` : `Invoice_${invoiceNo}.pdf`;

      // Clean up
      reactRoot.unmount();
      document.body.removeChild(hiddenDiv);
      
      return { filename, data: new Uint8Array(pdfData) };
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  };

  const handleDownloadAll = async () => {
    try {
      const currentInvoices = previewSource === 'backend' ? backendInvoices : invoices;
      const selectedInvoicesData = selectedInvoices.map(idx => currentInvoices[idx]);
      
      if (selectedInvoicesData.length === 0) {
        alert('Please select at least one invoice to download.');
        return;
      }

      // Show loading message
      const loadingMsg = document.createElement('div');
      loadingMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 16px;
      `;
      loadingMsg.textContent = `Generating ${selectedInvoicesData.length} PDFs for ZIP...`;
      document.body.appendChild(loadingMsg);

      // Create ZIP file
      const zip = new JSZip();
      
      // Generate PDFs and add to ZIP
      for (let i = 0; i < selectedInvoicesData.length; i++) {
        const invoice = selectedInvoicesData[i];
        try {
          const { filename, data } = await generatePDFForZip(invoice, i);
          zip.file(filename, data);
          
          // Update loading message
          loadingMsg.textContent = `Generated ${i + 1}/${selectedInvoicesData.length} PDFs...`;
        } catch (error) {
          console.error(`Error generating PDF for invoice ${i + 1}:`, error);
        }
      }

      // Generate and download ZIP
      loadingMsg.textContent = 'Creating ZIP file...';
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 } // Balanced compression
      });
      
      // Download ZIP file
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoices_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Remove loading message
      document.body.removeChild(loadingMsg);
      
      alert(`Successfully downloaded ${selectedInvoicesData.length} invoices as ZIP file!`);
    } catch (error) {
      console.error('ZIP generation error:', error);
      alert('Error generating ZIP file. Please try again.');
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
            {(previewSource === 'backend' && backendInvoices.length > 0 ? backendInvoices : invoices).length === 0 && (
              <div className="p-4 text-xs text-gray-400">No invoices loaded.</div>
            )}
            {(previewSource === 'backend' && backendInvoices.length > 0 ? backendInvoices : invoices).map((inv, idx) => (
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
                  <span>{inv["Invoice No"] || '-'}</span>
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