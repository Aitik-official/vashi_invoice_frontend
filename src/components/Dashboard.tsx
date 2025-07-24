"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import InvoicePreview from './InvoicePreview';
import EditPreview from './Edit_preview';

const Dashboard = ({ onLogout }: { onLogout?: () => void }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Monthly');
  const [showFilter, setShowFilter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any>(null);

  // Fetch invoices from backend
  useEffect(() => {
    fetch('http://localhost:5000/api/invoices')
      .then(res => res.json())
      .then(data => setInvoices(data))
      .catch(() => setInvoices([]));
  }, []);

  // Filtered data
  const filteredInvoices = invoices.filter(inv => {
    const clientName = inv.data?.clientName || inv.clientName || '';
    const invoiceNo = inv.data?.invoiceNo || inv.invoiceNo || '';
    return (
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      invoiceNo.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Get invoice data for InvoicePreview
  const getInvoiceData = (inv: any) => ({
    ...(inv.data || {}),
    invoiceId: inv.invoiceId // always include backend id for preview
  });

  // Save handler for EditPreview (update invoice in DB)
  const handleSaveEdit = async (updated: any) => {
    if (!editInvoice?._id) return;
    try {
      const res = await fetch(`http://localhost:5000/api/invoices/${editInvoice._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updated }),
      });
      if (res.ok) {
        setInvoices(prev => prev.map(inv => inv._id === editInvoice._id ? { ...inv, data: updated } : inv));
        setShowEdit(false);
        setEditInvoice(null);
      }
    } catch {}
  };

  // Delete handler (delete invoice in DB)
  const handleDelete = async (inv: any) => {
    if (!inv?._id) return;
    try {
      const res = await fetch(`http://localhost:5000/api/invoices/${inv._id}`, { method: 'DELETE' });
      if (res.ok) setInvoices(prev => prev.filter(i => i._id !== inv._id));
    } catch {}
  };

  // Add a download handler for PDF
  const handleDownloadPDF = async (inv: any) => {
    // Dynamically import ReactDOM for SSR safety
    const { createRoot } = await import('react-dom/client');
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    document.body.appendChild(hiddenDiv);
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview data={inv.data || inv} showDownloadButton={false} isPdfExport={true} />
    );
    await new Promise(r => setTimeout(r, 400));
    const images = Array.from(hiddenDiv.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => { img.onload = img.onerror = res; });
    }));
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const canvas = await html2canvas(hiddenDiv, { scale: 2, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = Math.min(800, pageWidth - 80);
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    const x = (pageWidth - pdfWidth) / 2;
    const y = 40;
    pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
    pdf.save(`Invoice_${inv.data?.invoiceNo || inv.invoiceNo}.pdf`);
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
  };

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-gray-50 to-orange-50 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 shadow-md border-b" style={{ height: 72 }}>
        <div className="flex items-center h-full">
          <img src="/inovice_formatting/logo_wbg.png" alt="Firm Logo" className="h-full w-auto mr-4 drop-shadow" style={{ maxHeight: 72 }} />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/create-invoice">
            <button className="bg-white hover:bg-orange-100 text-orange-600 font-bold px-7 py-2 rounded-lg transition shadow-lg border border-orange-200 text-lg">
              Create Invoice
            </button>
          </Link>
          {onLogout && (
            <button
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-7 py-2 rounded-lg transition shadow-lg border border-orange-200 text-lg"
              onClick={onLogout}
              type="button"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[1600px] mx-auto px-2 py-10 flex-1 flex flex-col">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-1 tracking-tight">Hello User</h1>
          <p className="text-gray-500 text-lg">View and manage your invoices below.</p>
        </div>

        {/* Search Bar + Filter Button */}
        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search invoices"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-5 py-3 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg bg-white shadow-sm placeholder-gray-400 text-gray-800 font-medium"
          />
          <div className="relative">
            <button
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl shadow transition text-base"
              onClick={() => setShowFilter(v => !v)}
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0013 13.414V19a1 1 0 01-1.447.894l-2-1A1 1 0 019 18v-4.586a1 1 0 00-.293-.707L2.293 6.707A1 1 0 012 6V4z" /></svg>
              {filter}
            </button>
            {showFilter && (
              <div className="absolute right-0 mt-2 w-36 bg-white border border-orange-200 rounded-lg shadow-lg z-20">
                {['Daily', 'Weekly', 'Monthly'].map(option => (
                  <button
                    key={option}
                    className={`block w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 ${filter === option ? 'font-bold text-orange-600' : ''}`}
                    onClick={() => { setFilter(option); setShowFilter(false); }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table with only vertical scroll, full width, sticky header */}
        <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 flex-1 w-full">
          <table className="w-full text-left text-lg whitespace-nowrap table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-orange-200 bg-gradient-to-r from-orange-50 to-white">
                <th className="px-2 py-4 font-bold text-gray-800">Sr No</th>
                <th className="px-2 py-4 font-bold text-gray-800">Invoice No</th>
                <th className="px-2 py-4 font-bold text-gray-800">Client Name</th>
                <th className="px-2 py-4 font-bold text-gray-800">Invoice Date</th>
                <th className="px-2 py-4 font-bold text-gray-800">View Details</th>
                <th className="px-2 py-4 font-bold text-gray-800">Actions</th>
              </tr>
            </thead>
          </table>
          <div className="w-full" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="w-full text-left text-lg whitespace-nowrap table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '8%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <tbody>
                {filteredInvoices.map((inv, idx) => (
                  <tr key={inv._id} className="border-b border-orange-100 hover:bg-orange-50 transition group">
                    <td className="px-2 py-4 text-gray-700 font-semibold">{idx + 1}</td>
                    <td className="px-2 py-4 text-gray-700 font-semibold">{inv.invoiceId}</td>
                    <td
                      className="px-2 py-4 text-gray-700 font-semibold truncate max-w-[220px]"
                      title={inv.data?.clientName || inv.clientName}
                    >
                      {inv.data?.clientName || inv.clientName}
                    </td>
                    <td className="px-2 py-4 text-gray-600 font-semibold">{inv.data?.invoiceDate || inv.invoiceDate}</td>
                    <td className="px-2 py-4">
                      <div className="flex gap-4">
                        {/* Eye Icon */}
                        <button title="View Invoice" className="text-gray-700 hover:text-orange-600 transition" onClick={() => { setSelectedInvoice(inv); setShowPreview(true); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 opacity-90">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
                          </svg>
                        </button>
                        {/* Pencil Icon */}
                        <button title="Edit Invoice" className="text-gray-700 hover:text-orange-600 transition" onClick={() => { setEditInvoice(inv); setShowEdit(true); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 opacity-90">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 1 1 3.182 3.182L7.5 19.213l-4.182.545.545-4.182 12.999-12.09z" />
                          </svg>
                        </button>
                        {/* Dustbin Icon */}
                        <button title="Delete Invoice" className="text-gray-700 hover:text-orange-600 transition" onClick={() => handleDelete(inv)}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 opacity-90">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5V6.75A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75V7.5M3.75 7.5h16.5M19.5 7.5v10.125A2.625 2.625 0 0116.875 20.25H7.125A2.625 2.625 0 014.5 17.625V7.5m3 0v9m4.5-9v9m4.5-9v9" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2 rounded-lg transition shadow-md text-base focus:outline-none focus:ring-2 focus:ring-orange-400" onClick={() => handleDownloadPDF(inv)}>Download Invoice</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl min-w-[1300px] w-[90vw] max-h-[90vh] flex flex-col relative overflow-hidden">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-orange-600 text-2xl font-bold z-10"
              onClick={() => setShowPreview(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="overflow-y-auto p-6 flex justify-center" style={{ maxHeight: '80vh', overflowX: 'hidden' }}>
              <InvoicePreview data={getInvoiceData(selectedInvoice)} showDownloadButton={false} />
            </div>
          </div>
        </div>
      )}

      {/* Invoice Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl min-w-[1300px] w-[90vw] max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <button
                className="text-gray-600 hover:text-orange-600 text-2xl font-bold z-10"
                onClick={() => { setShowEdit(false); setEditInvoice(null); }}
                aria-label="Close"
              >
                &times;
              </button>
              <button
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2 rounded-lg transition shadow-md text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                onClick={() => handleSaveEdit(editInvoice)}
              >
                Save
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex justify-center" style={{ maxHeight: '70vh', overflowX: 'hidden' }}>
              <EditPreview data={editInvoice} onChange={setEditInvoice} showDownloadButton={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;