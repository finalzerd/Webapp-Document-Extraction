import { PDFDocument } from 'pdf-lib';

export class PDFHandler {
    constructor() {
        this.PAGES_PER_GROUP = 10;
    }

    async mergeBase64PDFs(base64PDFs) {
        try {
            console.log('Starting PDF merge process...');
            
            // Merge all PDFs into one
            const mergedPdfDoc = await PDFDocument.create();
            
            for (const base64PDF of base64PDFs) {
                const pdfDoc = await PDFDocument.load(Buffer.from(base64PDF, 'base64'));
                const pages = await mergedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                pages.forEach(page => mergedPdfDoc.addPage(page));
            }
            
            const mergedPDFBytes = await mergedPdfDoc.save();
            console.log('PDFs merged successfully');
            
            return Buffer.from(mergedPDFBytes).toString('base64');
        } catch (error) {
            console.error('Error merging PDFs:', error);
            throw new Error('Failed to merge PDF files: ' + error.message);
        }
    }

    async getFirstPageBase64(base64PDF) {
        try {
            console.log('Starting first page extraction...');
            const pdfDoc = await PDFDocument.load(Buffer.from(base64PDF, 'base64'));
            
            const newPdfDoc = await PDFDocument.create();
            const [firstPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
            newPdfDoc.addPage(firstPage);
            
            const pdfBytes = await newPdfDoc.save();
            console.log('First page extracted successfully');
            
            return Buffer.from(pdfBytes).toString('base64');
        } catch (error) {
            console.error('Error extracting first page:', error);
            throw new Error('Failed to extract first page: ' + error.message);
        }
    }

    async getPageCount(base64PDF) {
        try {
            console.log('Getting page count...');
            const pdfDoc = await PDFDocument.load(Buffer.from(base64PDF, 'base64'));
            const pageCount = pdfDoc.getPageCount();
            console.log(`Page count: ${pageCount}`);
            return pageCount;
        } catch (error) {
            console.error('Error getting page count:', error);
            throw new Error('Failed to get page count: ' + error.message);
        }
    }

    async getPageGroup(base64PDF, groupIndex) {
        try {
            console.log(`Getting page group ${groupIndex}...`);
            const pdfDoc = await PDFDocument.load(Buffer.from(base64PDF, 'base64'));
            const totalPages = pdfDoc.getPageCount();
            
            const startPage = groupIndex * this.PAGES_PER_GROUP;
            const endPage = Math.min(startPage + this.PAGES_PER_GROUP, totalPages);
            
            if (startPage >= totalPages) {
                throw new Error('Group index exceeds total pages');
            }

            const newPdfDoc = await PDFDocument.create();
            const pageIndices = Array.from(
                { length: endPage - startPage }, 
                (_, i) => startPage + i
            );
            
            const pages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
            pages.forEach(page => newPdfDoc.addPage(page));
            
            const pdfBytes = await newPdfDoc.save();
            console.log(`Extracted pages ${startPage + 1} to ${endPage}`);
            
            return {
                base64: Buffer.from(pdfBytes).toString('base64'),
                startPage: startPage + 1,
                endPage,
                totalPages,
                isLastGroup: endPage === totalPages
            };
        } catch (error) {
            console.error('Error extracting page group:', error);
            throw new Error(`Failed to extract page group ${groupIndex}: ${error.message}`);
        }
    }

    calculateTotalGroups(totalPages) {
        return Math.ceil(totalPages / this.PAGES_PER_GROUP);
    }
}