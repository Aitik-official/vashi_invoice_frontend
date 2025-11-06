"use client";
import React, { useState } from 'react';
import InvoiceForm from '../../components/InvoiceForm';
import InvoicePreview from '../../components/InvoicePreview';

function CreateInvoicePage() {
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleInvoiceChange = (invoices: any[], isNewUpload: boolean = false) => {
    if (invoices && invoices.length > 0) {
      setInvoiceData(invoices[0]);
    }
  };

  const handlePreview = () => {
    if (invoiceData) {
      setShowPreview(true);
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceData) return;
    setIsUploading(true);
    try {
      const invoiceNo = invoiceData["In_no"] || invoiceData.invoiceNo;
      if (!invoiceNo) {
        alert('Invoice number is required');
        setIsUploading(false);
        return;
      }
      const checkResponse = await fetch('/api/proxy?endpoint=/api/invoices');
      const allInvoices = await checkResponse.json();
      const duplicate = allInvoices.find((inv: any) => {
        const existingNo = inv.data?.["In_no"] || inv.data?.invoiceNo;
        return existingNo === invoiceNo;
      });
      if (duplicate) {
        const confirmSave = confirm(`Invoice number ${invoiceNo} already exists. Do you want to update it?`);
        if (!confirmSave) {
          setIsUploading(false);
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
        setInvoiceData(null);
        setShowPreview(false);
      } else {
        const error = await response.text();
        alert(`Error saving invoice: ${error}`);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Create Invoice</h1>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/4">
            <InvoiceForm onChange={handleInvoiceChange} onPreview={handlePreview} />
          </div>
          <div className="lg:w-3/4">
            {showPreview && invoiceData ? (
              <div className="space-y-4">
                <InvoicePreview data={invoiceData} showDownloadButton={true} />
                <button
                  onClick={handleSaveInvoice}
                  disabled={isUploading}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-semibold disabled:bg-gray-400"
                >
                  {isUploading ? 'Saving...' : 'Save Invoice'}
                </button>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-500">
                <p>Upload an Excel file and click "Preview Invoices" to see the invoice preview here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateInvoicePage;

