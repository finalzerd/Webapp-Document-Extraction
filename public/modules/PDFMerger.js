// PDFMerger.js
import PDFMerger from 'pdf-merger-js';

export class PDFHandler {
    constructor() {
        this.merger = new PDFMerger();
    }

    async mergeBase64PDFs(base64PDFs) {
        try {
            // Reset merger for new operation
            this.merger = new PDFMerger();
            
            // Convert each base64 PDF to buffer and add to merger
            for (const base64PDF of base64PDFs) {
                const pdfBuffer = Buffer.from(base64PDF, 'base64');
                await this.merger.add(pdfBuffer);
            }
            
            // Merge PDFs and get the result as buffer
            const mergedPDFBuffer = await this.merger.saveAsBuffer();
            
            // Convert merged PDF back to base64
            return mergedPDFBuffer.toString('base64');
        } catch (error) {
            console.error('Error merging PDFs:', error);
            throw new Error('Failed to merge PDF files: ' + error.message);
        }
    }

    async getFirstPageBase64(base64PDF) {
        try {
            this.merger = new PDFMerger();
            const pdfBuffer = Buffer.from(base64PDF, 'base64');
            
            // Add only the first page
            await this.merger.add(pdfBuffer, [1]);
            
            // Get the first page as buffer
            const firstPageBuffer = await this.merger.saveAsBuffer();
            
            // Convert to base64
            return firstPageBuffer.toString('base64');
        } catch (error) {
            console.error('Error extracting first page:', error);
            throw new Error('Failed to extract first page: ' + error.message);
        }
    }
}