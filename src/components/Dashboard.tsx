"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import InvoicePreview from './InvoicePreview';
import EditPreview from './Edit_preview';

const Dashboard = ({ onLogout }: { onLogout?: () => void }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Show All');
  const [showFilter, setShowFilter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any>(null);

  // Memoize invoice data for preview
  const memoizedInvoiceData = useMemo(() => {
    if (!selectedInvoice) return {};
    const data = selectedInvoice.data || {};
    return {
      ...data,
      invoiceId: selectedInvoice.invoiceId,
      invoiceNo: selectedInvoice.invoiceNo || selectedInvoice.invoiceId
    };
  }, [selectedInvoice]);


  // Fetch invoices from backend
  useEffect(() => {
    console.log('Fetching invoices from backend...');
    fetch('https://backend-invoice-gen.onrender.com/api/invoices')
      .then(res => {
        console.log('Response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Fetched invoices:', data);
        setInvoices(data);
        

      })
      .catch((error) => {
        console.error('Error fetching invoices:', error);
        setInvoices([]);
      });
  }, []);

  // Helper function to parse date safely
  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    
    // Handle different date formats
    let date: Date | null = null;
    
    // Try parsing as ISO string (backend format)
    if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    }
    // Try parsing DD/MM/YYYY format
    else if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    // Try parsing DD-MM-YYYY format
    else if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Check if it's YYYY-MM-DD format
        if (parts[0].length === 4) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // DD-MM-YYYY format
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
    }
    
    return date && !isNaN(date.getTime()) ? date : null;
  };

  // Helper function to check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Helper function to check if date is in current week
  const isThisWeek = (date: Date) => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return date >= weekStart && date <= weekEnd;
  };

  // Helper function to check if date is in current month
  const isThisMonth = (date: Date) => {
    const today = new Date();
    return (
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };



  // Filtered data based on search and filter
  const filteredInvoices = invoices.filter(inv => {
    const clientName = inv.data?.clientName || inv.clientName || '';
            const invoiceNo = (inv.data as any)?.["Invoice No"] || '';
    const centre = inv.data?.centre || '';
    const placeOfService = inv.data?.placeOfService || '';
    const businessTerritory = inv.data?.businessTerritory || '';
    const invoiceDate = inv.data?.invoiceDate || inv.invoiceDate || '';
    const createdAt = inv.createdAt || '';
    
    // Search filter - now includes all table parameters
    const matchesSearch = (
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      centre.toLowerCase().includes(search.toLowerCase()) ||
      placeOfService.toLowerCase().includes(search.toLowerCase()) ||
      businessTerritory.toLowerCase().includes(search.toLowerCase())
    );
    
    if (!matchesSearch) return false;
    
    // Date filter
    if (filter === 'Show All') {
      return true; // Show all invoices
    }
    
    // Parse the invoice date
    const invoiceDateObj = parseDate(invoiceDate) || parseDate(createdAt);
    
    if (!invoiceDateObj) {
      // If no valid date found, show in "Show All" only
      return filter === 'Show All';
    }
    
    let matchesFilter = false;
    switch (filter) {
      case 'Daily':
        matchesFilter = isToday(invoiceDateObj);
        break;
      case 'Weekly':
        matchesFilter = isThisWeek(invoiceDateObj);
        break;
      case 'Monthly':
        matchesFilter = isThisMonth(invoiceDateObj);
        break;
      default:
        matchesFilter = true;
    }
    
    return matchesFilter;
  });

  // Get invoice data for InvoicePreview
  const getInvoiceData = (inv: any) => {
    if (!inv) return {};
    // Memoize the result to avoid unnecessary re-computations
    const data = inv.data || {};
    return {
      ...data,
      invoiceId: inv.invoiceId,
      invoiceNo: inv.invoiceNo || inv.invoiceId
    };
  };

  // Save handler for EditPreview (update invoice in DB)
  const handleSaveEdit = async (updated: any) => {
    if (!editInvoice?._id) return;
    try {
      const res = await fetch(`https://backend-invoice-gen.onrender.com/api/invoices/${editInvoice._id}`, {
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
      const res = await fetch(`https://backend-invoice-gen.onrender.com/api/invoices/${inv._id}`, { method: 'DELETE' });
      if (res.ok) setInvoices(prev => prev.filter(i => i._id !== inv._id));
    } catch {}
  };

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setShowFilter(false);
      }
      // Close preview modal when clicking outside
      if (!target.closest('.preview-modal')) {
        setShowPreview(false);
        setSelectedInvoice(null);
      }
    };

    if (showFilter || showPreview) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilter, selectedInvoice]);



  // Add a download handler for PDF
  const handleDownloadPDF = async (inv: any) => {
    // Get the exact invoice data that will be used in preview
    const invoiceData = getInvoiceData(inv);
            const exactInvoiceNo = (invoiceData as any)?.["Invoice No"] || '-';
    
    // Dynamically import ReactDOM for SSR safety
    const { createRoot } = await import('react-dom/client');
    let hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = '800px';
    hiddenDiv.style.background = '#fff';
    // Add CSS overrides for PDF optimization
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      /* Override all colors to safe hex values */
      * {
        color: #000 !important;
        background-color: #fff !important;
        border-color: #000 !important;
      }
      
      /* Specific Tailwind overrides */
      .bg-orange-600 { background-color: #fff !important; }
      .bg-blue-600 { background-color: #fff !important; }
      .text-white { color: #000 !important; }
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
        position: static !important;
      }
      
      li[style*="marginBottom: '8px'"] {
        margin-bottom: 8px !important;
        line-height: 1.4 !important;
        position: static !important;
        top: auto !important;
        transform: none !important;
      }
    `;
    hiddenDiv.appendChild(styleTag);
    document.body.appendChild(hiddenDiv);
    
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(
      <InvoicePreview data={{ ...invoiceData, invoiceNo: exactInvoiceNo }} showDownloadButton={false} isPdfExport={true} />
    );
    
    // Wait for render and images to load
    await new Promise(r => setTimeout(r, 600));
    const images = Array.from(hiddenDiv.querySelectorAll('img'));
    await Promise.all(images.map((img: HTMLImageElement) => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => { img.onload = img.onerror = res; });
    }));
    
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
      }
    });
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const canvas = await html2canvas(hiddenDiv, { 
      scale: 1.2, // Reduced scale to make content smaller and fit better
      backgroundColor: '#fff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      removeContainer: true,
      imageTimeout: 5000,
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
    const imgData = canvas.toDataURL("image/jpeg", 0.8); // Use JPEG with 80% quality instead of PNG
    const pdf = new jsPDF({ 
      orientation: 'p', 
      unit: 'pt', 
      format: 'a4',
      compress: true // Enable PDF compression
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Calculate dimensions to fit content properly with margins
    const pdfWidth = Math.min(650, pageWidth - 80); // Smaller width with more margin
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
    
    pdf.addImage(imgData, "JPEG", x, y, finalPdfWidth, finalPdfHeight, undefined, 'FAST'); // Use FAST compression
    const filename = exactInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${exactInvoiceNo}.pdf`;
    pdf.save(filename);
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-1 tracking-tight">Hello User</h1>
            <p className="text-gray-500 text-lg">View and manage your invoices below.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/create-invoice">
              <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-7 py-3 rounded-lg transition shadow-lg border border-orange-200 text-lg">
                Create Invoice
              </button>
            </Link>
            <Link href="/reports">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-lg transition shadow-lg border border-blue-200 text-lg">
                Reports
              </button>
            </Link>
          </div>
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
          <div className="relative filter-dropdown">
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
                {['Show All', 'Daily', 'Weekly', 'Monthly'].map(option => (
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



        {/* Filter Status */}
        {(search || filter !== 'Show All') && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            <span>Showing {filteredInvoices.length}</span>
            {search && <span>• Search: "{search}"</span>}
            {filter !== 'Show All' && <span>• Filter: {filter}</span>}
            <button
              onClick={() => { setSearch(''); setFilter('Show All'); }}
              className="text-orange-600 hover:text-orange-700 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Table with only vertical scroll, full width, sticky header */}
        <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 flex-1 w-full">
          <table className="w-full text-left text-lg whitespace-nowrap table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-orange-200 bg-gradient-to-r from-orange-50 to-white">
                <th className="px-2 py-4 font-bold text-gray-800">Sr No</th>
                <th className="px-2 py-4 font-bold text-gray-800">Invoice No</th>
                <th className="px-2 py-4 font-bold text-gray-800">Client Name</th>
                <th className="px-2 py-4 font-bold text-gray-800">Centre Name</th>
                <th className="px-2 py-4 font-bold text-gray-800">Location</th>
                <th className="px-2 py-4 font-bold text-gray-800">Circuit</th>
                <th className="px-2 py-4 font-bold text-gray-800">Invoice Date</th>
                <th className="px-2 py-4 font-bold text-gray-800">Actions</th>
              </tr>
            </thead>
          </table>
          <div className="w-full" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="w-full text-left text-lg whitespace-nowrap table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <tbody>
                {filteredInvoices.map((inv, idx) => {
                  if (!inv) return null; // Skip null invoices
                  return (
                    <tr key={inv._id} className="border-b border-orange-100 hover:bg-orange-50 transition group">
                      <td className="px-2 py-4 text-gray-700 font-semibold">{idx + 1}</td>
                      <td className="px-2 py-4 text-gray-700 font-semibold">{(inv.data as any)?.["Invoice No"] || '-'}</td>
                      <td
                        className="px-2 py-4 text-gray-700 font-semibold truncate"
                        title={inv.data?.clientName || inv.clientName}
                      >
                        {inv.data?.clientName || inv.clientName}
                      </td>
                      <td
                        className="px-2 py-4 text-gray-700 font-semibold truncate"
                        title={inv.data?.centre || ''}
                      >
                        {inv.data?.centre || '-'}
                      </td>
                      <td
                        className="px-2 py-4 text-gray-700 font-semibold truncate"
                        title={inv.data?.placeOfService || ''}
                      >
                        {inv.data?.placeOfService || '-'}
                      </td>
                      <td
                        className="px-2 py-4 text-gray-700 font-semibold truncate"
                        title={inv.data?.businessTerritory || ''}
                      >
                        {inv.data?.businessTerritory || '-'}
                      </td>
                      <td className="px-2 py-4 text-gray-600 font-semibold">{inv.data?.invoiceDate || inv.invoiceDate}</td>
                    <td className="px-2 py-4">
                      <div className="relative actions-dropdown">
                        <button
                          className="text-gray-700 hover:text-orange-600 transition p-1"
                          onClick={() => setSelectedInvoice(inv)}
                          title="Actions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                          </svg>
                        </button>
                        {selectedInvoice?._id === inv._id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-orange-200 rounded-lg shadow-lg z-20">
                            <button
                              className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                              onClick={() => { 
                                setSelectedInvoice(inv); 
                                setShowPreview(true); 
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                              onClick={() => { setEditInvoice(inv); setShowEdit(true); }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                              onClick={() => handleDownloadPDF(inv)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick={() => handleDelete(inv)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showPreview && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 preview-modal">
          <div className="bg-white rounded-xl shadow-2xl min-w-[1300px] w-[90vw] max-h-[90vh] flex flex-col relative overflow-hidden">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-orange-600 text-2xl font-bold z-10"
              onClick={() => {
                setShowPreview(false);
                setSelectedInvoice(null);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="overflow-y-auto p-6 flex justify-center" style={{ maxHeight: '80vh', overflowX: 'hidden' }}>
              <InvoicePreview data={memoizedInvoiceData} showDownloadButton={false} />
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