import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';

// Standardized PDF generation settings for consistent output across all systems
export const PDF_GENERATION_CONFIG = {
  // Canvas settings - optimized for consistent quality and file size
  canvas: {
    scale: 2.5, // Higher scale for better quality and consistent file size (350KB+)
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    removeContainer: true,
    imageTimeout: 10000, // Increased timeout for better reliability
    width: 800, // Fixed width for consistency
    height: 1130, // Fixed height for consistency
  },
  
  // Image settings - PNG for better quality, consistent file size
  image: {
    format: 'image/png' as const,
    quality: 1.0, // Maximum quality for PNG
  },
  
  // PDF settings - standardized dimensions
  pdf: {
    orientation: 'p' as const,
    unit: 'pt' as const,
    format: 'a4' as const,
    compress: true,
    margin: 40, // Consistent margins
  }
};

// Standardized PDF generation function
export const generateStandardizedPDF = async (
  component: React.ReactElement,
  filename: string,
  options: {
    isZipGeneration?: boolean;
    customScale?: number;
  } = {}
): Promise<{ filename: string; data: Uint8Array }> => {
  try {
    // Create hidden div with standardized dimensions
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = `${PDF_GENERATION_CONFIG.canvas.width}px`;
    hiddenDiv.style.height = `${PDF_GENERATION_CONFIG.canvas.height}px`;
    hiddenDiv.style.background = '#fff';
    hiddenDiv.style.color = '#000';
    hiddenDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
    hiddenDiv.style.boxSizing = 'border-box';
    
    // Add standardized styles for consistent rendering
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      * {
        color: #000 !important;
        background-color: #fff !important;
        border-color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box !important;
      }
      
      /* Ensure consistent font rendering */
      body, div, span, p, td, th {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: inherit !important;
        line-height: inherit !important;
      }
      
      /* Fix table cell alignment */
      .pdf-cell-fix {
        position: relative !important;
        top: -2.5px !important;
        vertical-align: middle !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      /* Ensure images maintain aspect ratio */
      img {
        max-width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
      }
      
      /* Stamp specific styling for consistency */
      img[src*="Stamp_mum.png"] {
        width: 144px !important;
        height: 120px !important;
        object-fit: contain !important;
        min-width: 144px !important;
        max-width: 144px !important;
        min-height: 120px !important;
        max-height: 120px !important;
        aspect-ratio: 1.2/1 !important;
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
        width: 144px !important;
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
    `;
    hiddenDiv.appendChild(styleTag);
    document.body.appendChild(hiddenDiv);

    // Render component into hidden div
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(component);

    // Wait for render and images to load
    await new Promise(r => setTimeout(r, 800));

    // Apply cell alignment fixes
    const tableCells = hiddenDiv.querySelectorAll('.pdf-cell-fix');
    tableCells.forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.style.position = 'relative';
      htmlCell.style.top = '-2.5px';
    });

    // Apply upward shift BEFORE html2canvas - use multiple methods for reliability
    // Method 1: Reduce padding-top of main content box
    const mainContentBox = hiddenDiv.querySelector('div[style*="paddingTop"][style*="0.5rem"], div[style*="padding"][style*="1rem"][style*="fontSize"][style*="12px"]');
    if (mainContentBox instanceof HTMLElement) {
      // Reduce padding-top to shift content up
      const currentPaddingTop = mainContentBox.style.paddingTop || '';
      if (currentPaddingTop.includes('0.5rem')) {
        mainContentBox.style.paddingTop = '0';
      } else if (currentPaddingTop.includes('1rem')) {
        mainContentBox.style.paddingTop = '0.25rem';
      }
      
      // Also apply negative margin-top
      mainContentBox.style.marginTop = '-60px';
      mainContentBox.style.position = 'relative';
      
      // Method 2: Apply to all child elements using top positioning
      const allChildren = mainContentBox.querySelectorAll('*');
      allChildren.forEach((child) => {
        if (child instanceof HTMLElement) {
          child.style.position = 'relative';
          child.style.top = '-60px';
        }
      });
      
      // Method 3: Specifically target headers
      const headers = hiddenDiv.querySelectorAll('div[style*="#035f87"]');
      headers.forEach((header) => {
        if (header instanceof HTMLElement) {
          header.style.position = 'relative';
          header.style.top = '-60px';
          header.style.marginTop = '-60px';
        }
      });
      
      // Method 4: Apply to grand total box elements
      const grandTotalElements = hiddenDiv.querySelectorAll('[data-pdf-shift="true"]');
      grandTotalElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.position = 'relative';
          element.style.top = '-60px';
          element.style.marginTop = '-60px';
        }
      });
    }

    // Wait for all images to load
    await waitForImagesToLoad(hiddenDiv);
    
    // Use standardized canvas settings
    const scale = options.customScale || PDF_GENERATION_CONFIG.canvas.scale;
    const canvas = await html2canvas(hiddenDiv, {
      ...PDF_GENERATION_CONFIG.canvas,
      scale,
      onclone: (clonedDoc) => {
        // Ensure stamp maintains exact dimensions in cloned document
        const clonedStamp = clonedDoc.querySelector('img[src*="Stamp_mum.png"]');
        if (clonedStamp instanceof HTMLElement) {
          clonedStamp.style.width = '144px';
          clonedStamp.style.height = '120px';
          clonedStamp.style.objectFit = 'contain';
          clonedStamp.style.aspectRatio = '1.2/1';
          clonedStamp.style.transform = 'none';
          clonedStamp.style.scale = '1';
          clonedStamp.style.flexShrink = '0';
          clonedStamp.style.flexGrow = '0';
        }
        
        // Shift all text content upward for PDF - use CSS injection and data attributes
        // Inject a style tag with transform rules
        const styleTag = clonedDoc.createElement('style');
        styleTag.textContent = `
          [data-pdf-shift="true"] {
            transform: translateY(-60px) !important;
            position: relative !important;
          }
          div[style*="paddingTop"][style*="0.5rem"],
          div[style*="padding"][style*="1rem"][style*="fontSize"][style*="12px"] {
            transform: translateY(-60px) !important;
            position: relative !important;
          }
          div[style*="paddingTop"][style*="0.5rem"] *,
          div[style*="padding"][style*="1rem"][style*="fontSize"][style*="12px"] * {
            transform: translateY(-60px) !important;
            position: relative !important;
          }
          div[style*="#035f87"],
          div[style*="backgroundColor"][style*="#035f87"] {
            transform: translateY(-60px) !important;
            position: relative !important;
          }
          div[style*="#035f87"] *,
          div[style*="backgroundColor"][style*="#035f87"] * {
            transform: translateY(-60px) !important;
          }
        `;
        clonedDoc.head.appendChild(styleTag);
        
        // Apply directly to elements with data-pdf-shift attribute (grand total box)
        const pdfShiftElements = clonedDoc.body.querySelectorAll('[data-pdf-shift="true"]');
        pdfShiftElements.forEach((element: Element) => {
          if (element instanceof HTMLElement) {
            element.style.setProperty('transform', 'translateY(-60px)', 'important');
            element.style.setProperty('position', 'relative', 'important');
          }
        });
        
        // Also apply directly to main content box and headers
        const allDivs = clonedDoc.body.querySelectorAll('div');
        
        allDivs.forEach((box) => {
          if (box instanceof HTMLElement) {
            const style = box.getAttribute('style') || '';
            const hasPaddingTop = style.includes('paddingTop') && style.includes('0.5rem');
            const hasPadding = style.includes('padding') && style.includes('1rem');
            const hasFontSize = style.includes('fontSize') && style.includes('12px');
            const hasWidth = style.includes('width') && style.includes('100%');
            
            if ((hasPaddingTop || hasPadding) && hasFontSize && hasWidth) {
              // Shift the entire container
              box.style.setProperty('transform', 'translateY(-60px)', 'important');
              box.style.setProperty('position', 'relative', 'important');
              
              // Apply to all child elements
              const allChildren = box.querySelectorAll('*');
              allChildren.forEach((element: Element) => {
                if (element instanceof HTMLElement) {
                  element.style.setProperty('transform', 'translateY(-60px)', 'important');
                }
              });
            }
            
            // Target headers specifically
            if (style.includes('#035f87')) {
              box.style.setProperty('transform', 'translateY(-60px)', 'important');
              box.style.setProperty('position', 'relative', 'important');
              const headerChildren = box.querySelectorAll('*');
              headerChildren.forEach((child: Element) => {
                if (child instanceof HTMLElement) {
                  child.style.setProperty('transform', 'translateY(-60px)', 'important');
                }
              });
            }
          }
        });
      },
      ignoreElements: (element) => {
        // Ignore elements with problematic CSS
        const style = window.getComputedStyle(element);
        return style.color.includes('oklch') || 
               style.backgroundColor.includes('oklch') ||
               style.borderColor.includes('oklch');
      }
    });
    
    // Generate image data with standardized settings
    const imgData = canvas.toDataURL(PDF_GENERATION_CONFIG.image.format, PDF_GENERATION_CONFIG.image.quality);
    
    // Create PDF with standardized settings
    const pdf = new jsPDF({
      orientation: PDF_GENERATION_CONFIG.pdf.orientation,
      unit: PDF_GENERATION_CONFIG.pdf.unit,
      format: PDF_GENERATION_CONFIG.pdf.format,
      compress: PDF_GENERATION_CONFIG.pdf.compress
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate dimensions with consistent margins
    const margin = PDF_GENERATION_CONFIG.pdf.margin;
    const availableWidth = pdfWidth - (margin * 2);
    const availableHeight = pdfHeight - (margin * 2);
    
    // Calculate scaling to fit content properly
    const widthRatio = availableWidth / canvasWidth;
    const heightRatio = availableHeight / canvasHeight;
    const scaleRatio = Math.min(widthRatio, heightRatio);
    
    const finalWidth = canvasWidth * scaleRatio;
    const finalHeight = canvasHeight * scaleRatio;
    
    // Center the content
    const x = (pdfWidth - finalWidth) / 2;
    const y = (pdfHeight - finalHeight) / 2;
    
    // Add image to PDF
    pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight, undefined, 'FAST');
    
    // Generate PDF data
    const pdfData = pdf.output('arraybuffer');
    
    // Clean up
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
    
    return { 
      filename: filename || `Invoice_${Date.now()}.pdf`, 
      data: new Uint8Array(pdfData) 
    };
  } catch (error) {
    console.error('Standardized PDF generation error:', error);
    throw error;
  }
};

// Helper function to wait for images to load
function waitForImagesToLoad(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(images.map(img => {
    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  })).then(() => {});
}

// Export for backward compatibility
export default generateStandardizedPDF;
