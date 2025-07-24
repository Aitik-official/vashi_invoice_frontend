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

  // Handler to receive invoices and share/gst from InvoiceForm
  const handleFormChange = (data: any[]) => {
    setInvoices(data || []);
    setSelectedIdx(0);
    setShowPreview(false); // Reset preview on new upload
    if (data && data.length) {
      setShare(data[0].share ?? 45);
      setGstType(data[0].gstType ?? 'CGST/SGST');
      setGstRate(data[0].gstRate ?? 18);
    }
    setSelectedInvoices([]);
    setSelectAll(false);
  };

  // New: Upload Excel and invoice data to backend
  const uploadToBackend = async () => {
    if (!invoices.length) return;
    try {
      // Find the file input
      const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('excel', file);
      formData.append('invoiceData', JSON.stringify(invoices)); // send all invoices as array
      const res = await fetch('http://localhost:5000/api/invoice-upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload invoice');
      // After upload, fetch the latest invoices from backend
      const fetchRes = await fetch('http://localhost:5000/api/invoices');
      if (fetchRes.ok) {
        const backendAll = await fetchRes.json();
        const { invoiceIds } = await res.json();
        const newBackendInvoices = backendAll.filter((inv: { invoiceId: string }) => invoiceIds.includes(inv.invoiceId));
        setBackendInvoices(newBackendInvoices.map((inv: { data: any, invoiceId: string }) => ({ ...inv.data, invoiceId: inv.invoiceId })));
        setSelectedIdx(0);
        setShowPreview(true);
      }
    } catch (err) {
      // Optionally handle error
      // console.error(err);
    }
  };

  const handlePreviewClick = async () => {
    // Show preview immediately with frontend data
    setShowPreview(true);
    setPreviewSource('frontend');
    
    // Then upload to backend and update
    await uploadToBackend();
    setPreviewSource('backend');
  };

  // Download a single invoice as PDF
  const handleDownloadInvoice = async (inv: any, idx: number) => {
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    document.body.appendChild(hiddenDiv);
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview data={{ ...inv, share, gstType, gstRate }} showDownloadButton={false} isPdfExport={true} />
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
    pdf.save(`Invoice_${inv.invoiceNo || idx + 1}.pdf`);
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
  };

  // Download all selected invoices
  const handleDownloadAll = async () => {
    for (const idx of selectedInvoices) {
      await handleDownloadInvoice(invoices[idx], idx);
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
            {invoices.length === 0 && (
              <div className="p-4 text-xs text-gray-400">No invoices loaded.</div>
            )}
            {invoices.map((inv, idx) => (
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
                  <span>{inv["Invoice No"] || inv["clientName"] || `Invoice #${idx + 1}`}</span>
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
                invoiceId: backendInvoices[selectedIdx]?.invoiceId
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
    </div>
  );
} 