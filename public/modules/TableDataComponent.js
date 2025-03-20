/**
 * TableDataComponent - Component for rendering bank statement table data
 */
export class TableDataComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id ${containerId} not found`);
        }
        
        this.data = { pages: [] };
        this.addStyles();
    }

    /**
     * Add component styles
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tables-container {
                margin-top: 20px;
            }
            .extracted-table-container {
                margin-bottom: 30px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                padding: 16px;
            }
            .page-header {
                margin: 0 0 12px 0;
                font-size: 18px;
                color: #333;
                border-bottom: 1px solid #eee;
                padding-bottom: 8px;
            }
            .extracted-table {
                width: 100%;
                border-collapse: collapse;
            }
            .extracted-table th, .extracted-table td {
                border: 1px solid #ddd;
                padding: 8px 12px;
                text-align: left;
            }
            .extracted-table th {
                background-color: #f8f9fa;
                position: sticky;
                top: 0;
                z-index: 10;
                font-weight: 600;
            }
            .extracted-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .extracted-table tr:hover {
                background-color: #f5f5f5;
            }
            .no-data-message {
                color: #999;
                font-style: italic;
                text-align: center;
                padding: 20px;
            }
            .export-controls {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 15px;
            }
            .export-button {
                padding: 8px 16px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.3s;
            }
            .export-button:hover {
                background-color: #45a049;
            }
            .loading-message {
                text-align: center;
                padding: 20px;
                color: #666;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Create view for a single table
     * @param {Object} tableData - Table data with headers and rows
     * @param {number} pageNumber - Page number
     * @returns {HTMLElement} Table container element
     */
    createTableView(tableData, pageNumber) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'extracted-table-container';
        
        // Add page header
        const pageHeader = document.createElement('h3');
        pageHeader.className = 'page-header';
        pageHeader.textContent = `Page ${pageNumber}`;
        tableContainer.appendChild(pageHeader);
        
        // Handle empty data case
        if (!tableData?.headers?.length || !tableData?.rows?.length) {
            const noDataMsg = document.createElement('p');
            noDataMsg.className = 'no-data-message';
            noDataMsg.textContent = 'No table data found on this page';
            tableContainer.appendChild(noDataMsg);
            return tableContainer;
        }
        
        // Create table
        const table = document.createElement('table');
        table.className = 'extracted-table';
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        tableData.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body with rows
        const tbody = document.createElement('tbody');
        
        tableData.rows.forEach(row => {
            const tr = document.createElement('tr');
            
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        
        return tableContainer;
    }

    /**
     * Render data to the component
     * @param {Object} data - Data object with pages array
     */
    render(data) {
        try {
            console.log('Rendering table data:', data);
            
            // Store the data
            this.data = data || { pages: [] };
            
            // Clear container
            this.container.innerHTML = '';
            
            // Add export button
            this.addExportButton();
            
            // Handle empty data
            if (!data?.pages?.length) {
                this.showLoadingState();
                return;
            }
    
            // Create container for all tables
            const tablesContainer = document.createElement('div');
            tablesContainer.className = 'tables-container';
            
            // Add each page's table
            data.pages.forEach(page => {
                const tableView = this.createTableView(page.tableData, page.pageNumber);
                tablesContainer.appendChild(tableView);
            });
            
            this.container.appendChild(tablesContainer);
        } catch (error) {
            console.error('Error in TableDataComponent render:', error);
            this.showError(error);
        }
    }
    
    /**
     * Add export button to the container
     */
    addExportButton() {
        const exportControls = document.createElement('div');
        exportControls.className = 'export-controls';
        
        const exportButton = document.createElement('button');
        exportButton.className = 'export-button';
        exportButton.textContent = 'Export to Excel';
        exportButton.onclick = () => this.exportToExcel();
        
        // Disable if no data
        if (!this.data?.pages?.length) {
            exportButton.disabled = true;
            exportButton.style.opacity = '0.5';
        }
        
        exportControls.appendChild(exportButton);
        this.container.appendChild(exportControls);
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'loading-message';
        loadingMessage.textContent = 'Extracting transaction data, tables will appear here as they are processed...';
        
        this.container.appendChild(loadingMessage);
    }
    
    /**
     * Show error message
     */
    showError(error) {
        this.container.innerHTML += `
            <div style="padding: 20px; color: #d32f2f; background: #ffebee; border-radius: 4px;">
                <h3>Error Displaying Tables</h3>
                <p>${error.message}</p>
            </div>
        `;
    }

    /**
     * Export table data to Excel
     */
    exportToExcel() {
        if (!this.data?.pages?.length) {
            alert('No data available for export');
            return;
        }

        try {
            const XLSX = window.XLSX;
            if (!XLSX) {
                throw new Error('XLSX library not loaded');
            }
            
            const wb = XLSX.utils.book_new();
            
            // Process each page with data
            this.data.pages.forEach(page => {
                if (page.tableData?.headers?.length && page.tableData?.rows?.length) {
                    // Create worksheet with headers and data rows
                    const wsData = [page.tableData.headers, ...page.tableData.rows];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    
                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(wb, ws, `Page ${page.pageNumber}`);
                }
            });
            
            // Add consolidated sheet if multiple pages
            if (wb.SheetNames.length > 1) {
                const consolidatedData = this.createConsolidatedTable();
                const ws = XLSX.utils.aoa_to_sheet([consolidatedData.headers, ...consolidatedData.rows]);
                XLSX.utils.book_append_sheet(wb, ws, 'All Transactions');
            }
            
            // If no data was added to the workbook, return
            if (wb.SheetNames.length === 0) {
                alert('No data available for export');
                return;
            }
            
            const filename = 'bank_statement_data_' + new Date().toISOString().slice(0, 10) + '.xlsx';
            XLSX.writeFile(wb, filename);
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export data. Please try again.');
        }
    }
    
    /**
     * Create consolidated table with data from all pages
     * @returns {Object} Consolidated table data
     */
    createConsolidatedTable() {
        // Find all unique headers across all pages
        const allHeaders = new Set();
        this.data.pages.forEach(page => {
            if (page.tableData?.headers) {
                page.tableData.headers.forEach(header => allHeaders.add(header));
            }
        });
        
        // Convert to array and ensure common bank statement columns come first
        const priorityHeaders = ['Date', 'Transaction Date', 'Description', 'Debit', 'Credit', 'Amount', 'Balance'];
        const headers = Array.from(allHeaders);
        
        // Sort headers to put priority ones first
        headers.sort((a, b) => {
            const aIndex = priorityHeaders.findIndex(h => a.includes(h));
            const bIndex = priorityHeaders.findIndex(h => b.includes(h));
            
            if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
            if (aIndex >= 0) return -1;
            if (bIndex >= 0) return 1;
            return a.localeCompare(b);
        });
        
        // Gather all rows from all pages
        const allRows = [];
        this.data.pages.forEach(page => {
            if (page.tableData?.rows) {
                // For each row, map to the consolidated headers
                page.tableData.rows.forEach(row => {
                    const newRow = new Array(headers.length).fill('');
                    
                    // Map values to the correct position in the new row
                    page.tableData.headers.forEach((header, index) => {
                        const newIndex = headers.indexOf(header);
                        if (newIndex >= 0 && index < row.length) {
                            newRow[newIndex] = row[index];
                        }
                    });
                    
                    // Add page number as metadata
                    newRow.push(page.pageNumber.toString());
                    allRows.push(newRow);
                });
            }
        });
        
        // Sort rows by date if possible
        this.sortRowsByDate(allRows, headers);
        
        return {
            headers: [...headers, 'Page'],
            rows: allRows
        };
    }
    
    /**
     * Sort rows by date if a date column exists
     * @param {Array} rows - Array of row data
     * @param {Array} headers - Array of header names
     */
    sortRowsByDate(rows, headers) {
        // Try to find a date column
        const dateColumnIndex = headers.findIndex(h => 
            h.toLowerCase().includes('date') || 
            h.toLowerCase().includes('time')
        );
        
        if (dateColumnIndex >= 0) {
            rows.sort((a, b) => {
                const dateA = this.parseDate(a[dateColumnIndex]);
                const dateB = this.parseDate(b[dateColumnIndex]);
                
                if (dateA && dateB) {
                    return dateA - dateB;
                }
                return 0;
            });
        }
    }
    
    /**
     * Parse date string to Date object
     * @param {string} dateStr - Date string to parse
     * @returns {Date|null} Date object or null if invalid
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Try different date formats
        const formats = [
            // DD/MM/YYYY
            str => {
                const parts = str.split('/');
                if (parts.length === 3) {
                    return new Date(parts[2], parts[1] - 1, parts[0]);
                }
                return null;
            },
            // MM/DD/YYYY
            str => {
                const parts = str.split('/');
                if (parts.length === 3) {
                    return new Date(parts[2], parts[0] - 1, parts[1]);
                }
                return null;
            },
            // YYYY-MM-DD
            str => {
                const parts = str.split('-');
                if (parts.length === 3) {
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                return null;
            }
        ];
        
        for (const format of formats) {
            const date = format(dateStr);
            if (date && !isNaN(date.getTime())) {
                return date;
            }
        }
        
        return null;
    }
}