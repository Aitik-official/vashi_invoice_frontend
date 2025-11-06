"use client";
import React, { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Link from 'next/link';
import { DISPLAY_NAMES } from '../../components/InvoicePreview';
import { generateStandardizedPDF } from '../../utils/pdfGenerator';
import InvoicePreview from '../../components/InvoicePreview';

// EditableSpan component - completely uncontrolled, only updates state on blur
const EditableSpan = React.memo(({ 
  field, 
  initialValue, 
  onChange, 
  style = {}, 
  placeholder = "" 
}: { 
  field: string;
  initialValue: string;
  onChange: (field: string, value: string) => void;
  style?: any;
  placeholder?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  
  // Initialize value only once on mount
  useLayoutEffect(() => {
    if (inputRef.current && !isInitializedRef.current) {
      inputRef.current.value = initialValue || "";
      isInitializedRef.current = true;
    }
  }, []);
  
  // Only sync value when component is not focused and value changed externally
  // This prevents interference while user is typing
  useLayoutEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      const currentValue = inputRef.current.value;
      if (initialValue !== currentValue) {
        inputRef.current.value = initialValue || "";
      }
    }
  }, [initialValue]);
  
  // Don't update state during typing - only on blur
  const handleBlur = () => {
    if (inputRef.current) {
      const finalValue = inputRef.current.value;
      onChange(field, finalValue);
    }
  };
  
  return (
    <input
      ref={inputRef}
      key={field}
      type="text"
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        ...style,
        border: 'none',
        borderBottom: '1px solid #008000',
        background: 'transparent',
        outline: 'none',
        textAlign: 'center',
        fontSize: '12px',
        padding: '0',
        width: style.width || '100%',
        minHeight: '16px',
      }}
      className="editable-field"
    />
  );
}, (prevProps, nextProps) => {
  // Never re-render based on value changes - only field/style
  return prevProps.field === nextProps.field &&
         JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
});

EditableSpan.displayName = 'EditableSpan';

function CreateInvoiceDirectPage() {
  const [invoiceData, setInvoiceData] = useState<any>({
    "In_no": "",
    invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    mrRaRa: "",
    place: "",
    to: "",
    chequeDraftNo: "",
    received: "",
    deposit: "",
    raRaNo: "",
    table: [],
    totalSalesRs: "",
    totalSalesPaise: "",
    expensesRs: "",
    expensesPaise: "",
    netBalanceRs: "",
    netBalancePaise: "",
    grandTotalRs: "",
    grandTotalPaise: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleInputChange = useCallback((field: string, value: any) => {
    setInvoiceData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Calculate total expenses from right table
  const calculateTotalExpenses = () => {
    let totalPaise = 0;
    
    // Sum all expense rows (0-7)
    for (let i = 0; i < 8; i++) {
      const rs = parseFloat(invoiceData[`expense${i}_rs`] || '0') || 0;
      const paise = parseFloat(invoiceData[`expense${i}_paise`] || '0') || 0;
      totalPaise += (rs * 100) + paise;
    }
    
    // Sum all empty rows (0-4)
    for (let i = 0; i < 5; i++) {
      const rs = parseFloat(invoiceData[`empty${i}_rs`] || '0') || 0;
      const paise = parseFloat(invoiceData[`empty${i}_paise`] || '0') || 0;
      totalPaise += (rs * 100) + paise;
    }
    
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate row total (Piece or Crates × Per unit price)
  const calculateRowTotal = (rowIndex: number) => {
    const piece = parseFloat(invoiceData[`row${rowIndex}_item`] || '0') || 0; // Using _item field for Piece
    const crates = parseFloat(invoiceData[`row${rowIndex}_piece`] || '0') || 0; // Using _piece field for Crates
    const perUnitPrice = parseFloat(invoiceData[`row${rowIndex}_price`] || '0') || 0;
    
    // Use Piece if available, otherwise use Crates
    const quantity = piece > 0 ? piece : crates;
    
    if (quantity === 0 || perUnitPrice === 0) {
      return { rs: null, paise: null };
    }
    
    // Calculate total in paise (per unit price is in rupees and paise format)
    // Assuming per unit price is entered as a decimal number (e.g., 10.50 = 10 rupees 50 paise)
    const totalPaise = Math.round(quantity * perUnitPrice * 100);
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate total sales from all left table rows
  const calculateTotalSales = () => {
    let totalPaise = 0;
    
    for (let i = 0; i < 13; i++) {
      const rowTotal = calculateRowTotal(i);
      if (rowTotal.rs !== null && rowTotal.paise !== null) {
        totalPaise += (rowTotal.rs * 100) + rowTotal.paise;
      }
    }
    
    if (totalPaise === 0) {
      return { rs: null, paise: null };
    }
    
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate net balance (Total Sales - Total Expenses)
  const calculateNetBalance = () => {
    const totalSales = calculateTotalSales();
    const totalExpenses = calculateTotalExpenses();
    
    if (totalSales.rs === null || totalSales.paise === null) {
      return { rs: null, paise: null, isNegative: false };
    }
    
    const salesPaise = (totalSales.rs * 100) + totalSales.paise;
    const expensesPaise = (totalExpenses.rs * 100) + totalExpenses.paise;
    
    const netPaise = salesPaise - expensesPaise;
    const netRs = Math.floor(Math.abs(netPaise) / 100);
    const netRemainingPaise = Math.abs(netPaise) % 100;
    
    return { rs: netRs, paise: netRemainingPaise, isNegative: netPaise < 0 };
  };

  // Prepare data for InvoicePreview component (format data properly)
  const prepareInvoiceDataForPreview = () => {
    // Build table data from left table rows
    const tableData: any[] = [];
    for (let i = 0; i < 13; i++) {
      const rowTotal = calculateRowTotal(i);
      if (rowTotal.rs !== null && rowTotal.paise !== null) {
        tableData.push({
          rs: rowTotal.rs,
          paise: rowTotal.paise,
          details: invoiceData[`row${i}_details`] || '',
          piece: invoiceData[`row${i}_item`] || '',
          crates: invoiceData[`row${i}_piece`] || '',
          price: invoiceData[`row${i}_price`] || '',
        });
      }
    }

    // Build expenses data from right table
    const expensesData: any[] = [];
    for (let i = 0; i < 8; i++) {
      const rs = invoiceData[`expense${i}_rs`] || '';
      const paise = invoiceData[`expense${i}_paise`] || '';
      if (rs || paise) {
        expensesData.push({
          name: ['Commission', 'Porterage', 'Car rental', 'Bundle expenses', 'Hundekari expenses', 'Space rent', 'Warai', 'Other expenses'][i],
          rs: rs,
          paise: paise,
        });
      }
    }

    // Calculate totals
    const totalSales = calculateTotalSales();
    const totalExpenses = calculateTotalExpenses();
    const netBalance = calculateNetBalance();

    return {
      ...invoiceData,
      "In_no": invoiceData["In_no"] || '',
      invoiceDate: invoiceData.invoiceDate || '',
      table: tableData,
      totalSalesRs: totalSales.rs !== null ? totalSales.rs : '',
      totalSalesPaise: totalSales.paise !== null ? totalSales.paise : '',
      expensesRs: totalExpenses.rs > 0 ? totalExpenses.rs : '',
      expensesPaise: totalExpenses.paise > 0 ? totalExpenses.paise : '',
      netBalanceRs: netBalance.rs !== null ? netBalance.rs : '',
      netBalancePaise: netBalance.paise !== null ? netBalance.paise : '',
      grandTotalRs: netBalance.rs !== null ? netBalance.rs : '',
      grandTotalPaise: netBalance.paise !== null ? netBalance.paise : '',
    };
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current) {
      alert('Invoice preview not found. Please try again.');
      return;
    }

    try {
      const invoiceNo = invoiceData["In_no"] || invoiceData.invoiceNo || '';
      const filename = invoiceNo ? `Invoice_${invoiceNo}.pdf` : `Invoice_${Date.now()}.pdf`;
      
      // Import html2canvas and jsPDF dynamically
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Wait for images to load
      const images = Array.from(previewRef.current.querySelectorAll('img'));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve, reject) => {
              if (img.complete) {
                resolve();
                return;
              }
              const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10000);
              img.onload = () => {
                clearTimeout(timeout);
                resolve();
              };
              img.onerror = () => {
                clearTimeout(timeout);
                resolve(); // Continue even if image fails
              };
            })
        )
      );

      // Apply upward shift only to text labels (not tables/containers) and hide green underlines
      const textLabels = previewRef.current.querySelectorAll('span:not(td span, th span), p:not(td p, th p)');
      const inputElements = previewRef.current.querySelectorAll('input.editable-field');
      const tableCells = previewRef.current.querySelectorAll('td, th, .grid > div');
      const originalStyles: Array<{ element: HTMLElement; transform: string; position: string; borderBottom: string; overflow: string; whiteSpace: string; minHeight: string; display: string; visibility: string; zIndex: string }> = [];
      const inputReplacements: Array<{ input: HTMLInputElement; span: HTMLSpanElement }> = [];
      
      // Convert input fields to visible text spans so their values are captured in PDF
      inputElements.forEach((el) => {
        const htmlEl = el as HTMLInputElement;
        const inputValue = htmlEl.value || '';
        // Check if input is in a container with data-field attribute or nearby cheque/received text
        const parentContainer = htmlEl.closest('[data-field]') || htmlEl.parentElement;
        const fieldName = parentContainer?.getAttribute('data-field') || '';
        const nearbyText = parentContainer?.textContent || '';
        const isChequeField = fieldName.includes('chequeDraftNo') || fieldName.includes('received') || 
                             nearbyText.includes('Cheque/Draft No') || nearbyText.includes('Received');
        
        // Create a span element to replace the input
        const textSpan = document.createElement('span');
        textSpan.textContent = inputValue;
        textSpan.style.cssText = `
          display: inline-block;
          width: ${htmlEl.style.width || '100%'};
          min-height: ${htmlEl.style.minHeight || '16px'};
          font-size: ${htmlEl.style.fontSize || '12px'};
          text-align: ${htmlEl.style.textAlign || 'center'};
          color: #000;
          padding: 0;
          border: none;
          background: transparent;
          overflow: visible;
          white-space: normal;
          word-wrap: break-word;
          z-index: 1;
          position: relative;
          transform: ${isChequeField ? 'none' : 'translateY(0)'};
        `;
        
        // Store original input styles
        originalStyles.push({
          element: htmlEl,
          transform: '',
          position: '',
          borderBottom: htmlEl.style.borderBottom || '',
          overflow: htmlEl.style.overflow || '',
          whiteSpace: htmlEl.style.whiteSpace || '',
          minHeight: htmlEl.style.minHeight || '',
          display: htmlEl.style.display || '',
          visibility: htmlEl.style.visibility || '',
          zIndex: htmlEl.style.zIndex || ''
        });
        
        // Hide the input and show the span
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
        htmlEl.parentNode?.insertBefore(textSpan, htmlEl);
        
        inputReplacements.push({ input: htmlEl, span: textSpan });
      });
      
      // Fix text truncation in table cells - ensure full text is visible
      tableCells.forEach((el) => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({
          element: htmlEl,
          transform: '',
          position: '',
          borderBottom: '',
          overflow: htmlEl.style.overflow || '',
          whiteSpace: htmlEl.style.whiteSpace || '',
          minHeight: htmlEl.style.minHeight || '',
          display: '',
          visibility: '',
          zIndex: ''
        });
        // Ensure text is fully visible - no clipping
        htmlEl.style.overflow = 'visible';
        htmlEl.style.whiteSpace = 'normal';
        // Increase min height to accommodate full text
        const currentMinHeight = parseInt(htmlEl.style.minHeight || '22px');
        if (currentMinHeight < 30) {
          htmlEl.style.minHeight = 'auto';
        }
      });
      
      // Shift only text labels (outside of tables) upward, but exclude cheque text
      textLabels.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Only shift if it's not inside a table and contains text
        // Exclude cheque text to prevent shifting
        const textContent = htmlEl.textContent || '';
        const isChequeText = textContent.includes('Cheque/Draft No') || textContent.includes('Received');
        
        if (htmlEl.textContent && htmlEl.textContent.trim() && !htmlEl.closest('table') && !htmlEl.closest('.grid') && !isChequeText) {
          originalStyles.push({
            element: htmlEl,
            transform: htmlEl.style.transform || '',
            position: htmlEl.style.position || '',
            borderBottom: '',
            overflow: '',
            whiteSpace: '',
            minHeight: '',
            display: '',
            visibility: '',
            zIndex: ''
          });
          htmlEl.style.position = 'relative';
          htmlEl.style.transform = 'translateY(-3px)';
        }
      });
      
      // Ensure cheque text line stays properly aligned - no shift
      const chequeLineContainer = previewRef.current.querySelector('[style*="display: flex"][style*="alignItems"]');
      if (chequeLineContainer) {
        const htmlEl = chequeLineContainer as HTMLElement;
        originalStyles.push({
          element: htmlEl,
          transform: htmlEl.style.transform || '',
          position: htmlEl.style.position || '',
          borderBottom: '',
          overflow: '',
          whiteSpace: '',
          minHeight: '',
          display: '',
          visibility: '',
          zIndex: ''
        });
        // Ensure this container stays aligned
        htmlEl.style.position = 'relative';
        htmlEl.style.transform = 'none';
      }

      // Generate canvas from the editable invoice preview
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: previewRef.current.scrollWidth,
        height: previewRef.current.scrollHeight,
      });

      // Restore original styles and remove text span replacements
      inputReplacements.forEach(({ input, span }) => {
        // Restore input visibility
        input.style.display = '';
        input.style.visibility = '';
        // Remove the text span
        span.remove();
      });
      
      originalStyles.forEach(({ element, transform, position, borderBottom, overflow, whiteSpace, minHeight, display, visibility, zIndex }) => {
        if (transform || position) {
          element.style.transform = transform;
          element.style.position = position;
        }
        if (borderBottom !== undefined && element instanceof HTMLInputElement) {
          element.style.borderBottom = borderBottom;
        }
        if (overflow !== undefined) {
          element.style.overflow = overflow;
        }
        if (whiteSpace !== undefined) {
          element.style.whiteSpace = whiteSpace;
        }
        if (minHeight !== undefined) {
          element.style.minHeight = minHeight;
        }
        if (display !== undefined && element instanceof HTMLInputElement) {
          element.style.display = display;
        }
        if (visibility !== undefined && element instanceof HTMLInputElement) {
          element.style.visibility = visibility;
        }
        if (zIndex !== undefined) {
          element.style.zIndex = zIndex;
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with A4 format
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate dimensions with margins
      const margin = 40;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      
      // Calculate scaling to fit content properly
      const widthRatio = availableWidth / canvasWidth;
      const heightRatio = availableHeight / canvasHeight;
      const scaleRatio = Math.min(widthRatio, heightRatio);
      
      const finalWidth = canvasWidth * scaleRatio;
      const finalHeight = canvasHeight * scaleRatio;
      
      // Center the content with upward adjustment
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2 - 5; // Additional upward shift in PDF
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
      
      // Generate PDF blob and download
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Save to backend after download
      await saveInvoice();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const saveInvoice = async () => {
    // If no invoice number, skip saving but still allow PDF download
    if (!invoiceData["In_no"] && !invoiceData.invoiceNo) {
      console.log('No invoice number provided, skipping save to database');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceNo = invoiceData["In_no"] || invoiceData.invoiceNo;
      
      const checkResponse = await fetch('/api/proxy?endpoint=/api/invoices');
      const allInvoices = await checkResponse.json();
      
      const duplicate = allInvoices.find((inv: any) => {
        const existingNo = inv.data?.["In_no"] || inv.data?.invoiceNo;
        return existingNo === invoiceNo;
      });

      if (duplicate) {
        const confirmSave = confirm(`Invoice number ${invoiceNo} already exists. Do you want to update it?`);
        if (!confirmSave) {
          setIsSaving(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('invoiceData', JSON.stringify([invoiceData]));

      const response = await fetch('/api/proxy', {
        method: 'POST',
        body: formData,
        headers: {
          'endpoint': '/api/invoice-upload'
        }
      });

      if (response.ok) {
        alert('Invoice saved successfully!');
      } else {
        const error = await response.text();
        alert(`Error saving invoice: ${error}`);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // EditableSpan wrapper - stable component that doesn't re-render on value changes
  const EditableSpanWrapper = React.memo(({ field, style = {}, placeholder = "" }: { field: string, style?: any, placeholder?: string }) => {
    // Get current value from state
    const currentValue = invoiceData[field] || "";
    
    return (
      <EditableSpan
        field={field}
        initialValue={currentValue}
        onChange={handleInputChange}
        style={style}
        placeholder={placeholder}
      />
    );
  }, (prevProps, nextProps) => {
    // Only re-render if field or style changes - ignore all value changes
    return prevProps.field === nextProps.field &&
           JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
  });
  
  EditableSpanWrapper.displayName = 'EditableSpanWrapper';

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Create via Excel button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Create Invoice - Direct Entry</h1>
          <Link href="/create-invoice-excel">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg transition shadow-lg">
              Create via Excel
            </button>
          </Link>
        </div>

        {/* Download Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDownloadPDF}
            disabled={isSaving}
            className="px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Download PDF & Save'}
          </button>
        </div>

        {/* Editable Invoice Preview - Also used for PDF generation */}
        <div
          ref={previewRef}
          className="w-[800px] mx-auto bg-white shadow-lg text-black"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1130px', boxSizing: 'border-box', padding: 0 }}
          id="invoice-preview-container"
        >
          {/* Header - Single Image */}
          <div style={{ width: '100%', margin: 0, padding: 0 }}>
            <img 
              src="/inovice_formatting/invoice-header.png" 
              alt="Invoice Header" 
              style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0 }} 
            />
          </div>

          {/* Main Content Box - Editable */}
          <div style={{ width: '100%', padding: '1rem', fontSize: '12px' }}>
            {/* Top Header Section */}
            <div style={{ border: '2px solid #008000', padding: '8px', marginBottom: '1rem' }}>
              {/* Top Line - Invoice No (left) and Date (right) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ display: 'inline-block' }}>
                  {DISPLAY_NAMES['In_no']}: <EditableSpanWrapper field="In_no" style={{ width: '120px', display: 'inline-block' }} />
                </span>
                <span style={{ display: 'inline-block' }}>
                  {DISPLAY_NAMES.date}: <EditableSpanWrapper field="invoiceDate" style={{ width: '100px', display: 'inline-block' }} />
                </span>
              </div>
              
              {/* Recipient/Sender Details Section */}
              <div style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                {/* First Line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.mrRaRa}</span>
                  <EditableSpanWrapper field="mrRaRa" style={{ flex: '1', minWidth: '200px' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.place}</span>
                  <EditableSpanWrapper field="place" style={{ flex: '1', minWidth: '200px' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.to}</span>
                </div>
                
                {/* Second Line */}
                <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', marginBottom: '8px', lineHeight: '1.6', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.loveGreetings}</span>
                  <EditableSpanWrapper field="raRaNo" style={{ flex: 1, marginLeft: '8px', marginRight: '8px' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.chequeDraftNo}</span>
                  <span data-field="chequeDraftNo">
                    <EditableSpanWrapper field="chequeDraftNo" style={{ width: '100px', marginLeft: '8px', marginRight: '8px' }} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.received}</span>
                </div>
                
                {/* Remaining lines */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', lineHeight: '1.6' }}>
                  <div style={{ width: '60%' }}>
                    <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.salesDetails}</div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '8px' }}>{DISPLAY_NAMES.deposit}:</span>
                      <EditableSpanWrapper field="deposit" style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section - Two Side-by-Side Tables */}
            <div className="w-full border-2 border-green-700 mb-4" style={{ borderColor: '#008000' }}>
              <div className="grid grid-cols-12">
                {/* Left Table - Item Details */}
                <div className="col-span-9 border-r-2" style={{ borderColor: '#008000' }}>
                  {/* Header Row */}
                  <div className="grid grid-cols-7 border-b font-semibold text-center text-xs whitespace-nowrap" style={{ borderColor: '#008000' }}>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.rs}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.paise}</div>
                    <div className="col-span-2 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.detailsOfGoods}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.piece}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.crates}</div>
                    <div className="col-span-1 p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.perUnitPrice}</div>
                  </div>
                  {/* Content Rows - Editable */}
                  {Array(13).fill(0).map((_, i) => {
                    const rowTotal = calculateRowTotal(i);
                    return (
                      <div key={i} className="grid grid-cols-7 border-b text-center" style={{ borderColor: '#008000' }}>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500' }}>{rowTotal.rs !== null ? rowTotal.rs : ''}</span>
                        </div>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500' }}>{rowTotal.paise !== null ? rowTotal.paise : ''}</span>
                        </div>
                        <div className="col-span-2 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <EditableSpanWrapper field={`row${i}_details`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <EditableSpanWrapper field={`row${i}_item`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <EditableSpanWrapper field={`row${i}_piece`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                          <EditableSpanWrapper field={`row${i}_price`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Left Table - Totals Section (Auto-calculated) */}
                  <div className="grid grid-cols-7 border-t-2 border-b text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalSales().rs !== null ? calculateTotalSales().rs : ''}</span>
                    </div>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalSales().paise !== null ? calculateTotalSales().paise : ''}</span>
                    </div>
                    <div className="col-span-5 p-2 text-left font-semibold" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.totalSales}</div>
                  </div>
                  <div className="grid grid-cols-7 border-b text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalExpenses().rs > 0 ? calculateTotalExpenses().rs : ''}</span>
                    </div>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalExpenses().paise > 0 ? calculateTotalExpenses().paise : ''}</span>
                    </div>
                    <div className="col-span-5 p-2 text-left font-semibold" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.expenses}</div>
                  </div>
                  <div className="grid grid-cols-7 text-xs font-bold" style={{ borderColor: '#008000', backgroundColor: '#f0f9ff' }}>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000', borderBottom: 'none' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        {calculateNetBalance().rs !== null ? `${calculateNetBalance().isNegative ? '-' : ''}${calculateNetBalance().rs}` : ''}
                      </span>
                    </div>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000', borderRight: '1px solid #008000', borderBottom: 'none' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{calculateNetBalance().paise !== null ? calculateNetBalance().paise : ''}</span>
                    </div>
                    <div className="col-span-5 p-2 text-left font-bold" style={{ borderColor: '#008000', borderBottom: 'none' }}>{DISPLAY_NAMES.netBalance}</div>
                  </div>
                </div>

                {/* Right Table - Expenses */}
                <div className="col-span-3">
                  {/* Header Row - Using 5 columns: Details (3), Rs (1), Paise (1) */}
                  <div className="grid grid-cols-5 border-b font-semibold text-center text-xs whitespace-nowrap" style={{ borderColor: '#008000' }}>
                    <div className="col-span-3 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.detailsOfExpenses}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.rs}</div>
                    <div className="col-span-1 p-1">{DISPLAY_NAMES.paise}</div>
                  </div>
                  {/* Expense Rows */}
                  {[DISPLAY_NAMES.commission, DISPLAY_NAMES.porterage, DISPLAY_NAMES.carRental, DISPLAY_NAMES.bundleExpenses, DISPLAY_NAMES.hundekariExpenses, DISPLAY_NAMES.spaceRent, DISPLAY_NAMES.warai, DISPLAY_NAMES.otherExpenses].map((expense, idx) => (
                    <div key={idx} className="grid grid-cols-5 border-b text-xs" style={{ borderColor: '#008000' }}>
                      <div className="col-span-3 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>{expense}</div>
                      <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                        <EditableSpanWrapper field={`expense${idx}_rs`} style={{ width: '100%', minHeight: '22px' }} />
                      </div>
                      <div className="col-span-1 p-1" style={{ minHeight: '22px' }}>
                        <EditableSpanWrapper field={`expense${idx}_paise`} style={{ width: '100%', minHeight: '22px' }} />
                      </div>
                    </div>
                  ))}
                  {/* Additional empty rows */}
                  {Array(5).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} className="grid grid-cols-5 border-b text-xs" style={{ borderColor: '#008000' }}>
                      <div className="col-span-3 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                        <EditableSpanWrapper field={`empty${i}_details`} style={{ width: '100%', minHeight: '22px' }} />
                      </div>
                      <div className="col-span-1 border-r p-1" style={{ borderColor: '#008000', minHeight: '22px' }}>
                        <EditableSpanWrapper field={`empty${i}_rs`} style={{ width: '100%', minHeight: '22px' }} />
                      </div>
                      <div className="col-span-1 p-1" style={{ minHeight: '22px' }}>
                        <EditableSpanWrapper field={`empty${i}_paise`} style={{ width: '100%', minHeight: '22px' }} />
                      </div>
                    </div>
                  ))}
                  
                  {/* Right Table - Total Expenses Only (Auto-calculated) */}
                  <div className="grid grid-cols-5 border-t-2 text-xs font-semibold" style={{ borderColor: '#008000', backgroundColor: '#f9fafb' }}>
                    <div className="col-span-3 border-r p-2 text-left" style={{ borderColor: '#008000' }}>{DISPLAY_NAMES.totalExpenses}</div>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalExpenses().rs || '0'}</span>
                    </div>
                    <div className="col-span-1 p-2 text-right" style={{ borderColor: '#008000' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{calculateTotalExpenses().paise || '0'}</span>
                    </div>
                  </div>
                  {/* Horizontal line after Total Expenses */}
                  <div className="border-b-2" style={{ borderColor: '#008000', width: '100%', marginTop: '8px' }}></div>
                  {/* Errors and omissions text below Total Expenses */}
                  <div className="p-2 text-xs italic" style={{ textAlign: 'center', marginTop: '8px' }}>
                    {DISPLAY_NAMES.errorsOmissions}
                  </div>
                </div>
              </div>
            </div>

            {/* Combined Bottom Table */}
            <div className="border-2 mb-4" style={{ borderColor: '#008000' }}>
              <div className="grid grid-cols-12" style={{ minHeight: '150px' }}>
                {/* Left Side - Terms and Conditions */}
                <div className="col-span-5 p-3" style={{ fontSize: '11px', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.salesSlipSent}</div>
                  <div style={{ marginBottom: '4px' }}>
                    {DISPLAY_NAMES.amountOfSlip}
                    <EditableSpanWrapper field="amountOfSlipName" style={{ width: '150px', display: 'inline-block', marginLeft: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    {DISPLAY_NAMES.toBeCollected}
                    <EditableSpanWrapper field="toBeCollectedPlace" style={{ width: '100px', display: 'inline-block', marginLeft: '8px' }} />
                    .
                  </div>
                  <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.ifNotReceived}</div>
                  <div style={{ marginBottom: '4px' }}>{DISPLAY_NAMES.noComplaints}</div>
                  <div style={{ marginTop: '8px', fontWeight: 'bold' }}>{DISPLAY_NAMES.thanks}</div>
                </div>

                {/* Center - Grand Total (showing Net Balance) */}
                <div className="col-span-2 p-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: '12px', paddingLeft: '0', paddingRight: '0' }}>
                  <div className="border-2 p-2" style={{ borderColor: '#008000', width: '200%', minWidth: '350px', height: '45px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', backgroundColor: '#f0f9ff', marginRight: '-280px', padding: '8px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#008000', whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.grandTotal}</span>
                    <span className="bg-red-600 text-white px-2 py-0.5 text-xs font-bold" style={{ whiteSpace: 'nowrap' }}>{DISPLAY_NAMES.rs}</span>
                    <span style={{ minWidth: '120px', flex: 1, minHeight: '18px', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>
                      {calculateNetBalance().rs !== null ? `${calculateNetBalance().isNegative ? '-' : ''}${calculateNetBalance().rs}.${String(calculateNetBalance().paise || '0').padStart(2, '0')}` : ''}
                    </span>
                  </div>
                </div>

                {/* Right Side - Signature */}
                <div className="col-span-5 p-3 flex flex-col justify-end items-end" style={{ fontSize: '11px' }}>
                  <div className="flex flex-col justify-end items-center" style={{ textAlign: 'center' }}>
                    <div className="text-xs mb-2">{DISPLAY_NAMES.yoursSincerely}</div>
                    <div className="text-xs">{DISPLAY_NAMES.signatureName}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateInvoiceDirectPage;
