export class DataTable {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id ${containerId} not found`);
        }
        
        this.data = { pages: [] };
        this.table = null;
        this.tbody = null;
        
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .table-wrapper {
                margin-top: 20px;
                overflow-x: auto;
                background: white;
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .table-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding: 10px;
            }
            .export-button {
                padding: 8px 16px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .export-button:hover {
                background-color: #45a049;
            }
            .table-status {
                font-size: 14px;
                color: #666;
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
            .data-table th, .data-table td {
                border: 1px solid #ddd;
                padding: 12px 8px;
                text-align: left;
            }
            .data-table th {
                background-color: #f8f9fa;
                position: sticky;
                top: 0;
                z-index: 10;
                font-weight: 600;
            }
            .data-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .data-table tr:hover {
                background-color: #f5f5f5;
            }
            .no-value {
                color: #999;
                font-style: italic;
            }
            .date-value {
                color: #2196f3;
            }
            .table-placeholder {
                text-align: center;
                padding: 20px;
                color: #666;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Creates the table structure with headers
     * @param {Array} headers - Array of column headers 
     */
    initializeTable(headers) {
        this.container.innerHTML = '';
        
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        // Create controls section
        const controls = document.createElement('div');
        controls.className = 'table-controls';
        
        const exportButton = document.createElement('button');
        exportButton.className = 'export-button';
        exportButton.textContent = 'Export to Excel';
        exportButton.onclick = () => this.exportToExcel();
        
        const status = document.createElement('div');
        status.className = 'table-status';
        status.textContent = 'Processing data...';
        
        controls.appendChild(exportButton);
        controls.appendChild(status);
        tableWrapper.appendChild(controls);

        // Create table with headers
        this.table = document.createElement('table');
        this.table.className = 'data-table';
        
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add Page Number header
        const pageHeader = document.createElement('th');
        pageHeader.textContent = 'Page';
        headerRow.appendChild(pageHeader);
        
        // Add field headers
        headers.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        this.table.appendChild(thead);

        // Create tbody
        this.tbody = document.createElement('tbody');
        this.table.appendChild(this.tbody);

        tableWrapper.appendChild(this.table);
        this.container.appendChild(tableWrapper);
    }
    
    /**
     * Renders data to the table
     * @param {Object} data - Data object with pages array
     */
    render(data) {
        try {
            console.log('Rendering data:', data);
            
            if (!data?.pages?.length) {
                console.error('Invalid data format or empty data provided');
                return;
            }

            // Store the data
            this.data = data;

            // Get field names from the first page
            const firstPage = data.pages[0];
            const fieldNames = Object.keys(firstPage.fields);

            // Initialize table with headers
            this.initializeTable(fieldNames);

            // Clear existing rows
            if (this.tbody) {
                this.tbody.innerHTML = '';
            }

            // Handle empty data case
            if (data.pages.length === 0) {
                this.renderEmptyState(fieldNames.length + 1);
                return;
            }

            // Render each page
            data.pages.forEach(page => this.renderPageRow(page, fieldNames));

            // Update status
            const status = this.container.querySelector('.table-status');
            if (status) {
                status.textContent = `Showing ${data.pages.length} page(s)`;
            }
        } catch (error) {
            console.error('Error in DataTable render:', error);
            throw error;
        }
    }
    
    /**
     * Renders an empty state placeholder
     * @param {number} colSpan - Number of columns to span
     */
    renderEmptyState(colSpan) {
        const placeholderRow = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = colSpan;
        cell.className = 'table-placeholder';
        cell.textContent = 'No data available';
        placeholderRow.appendChild(cell);
        this.tbody.appendChild(placeholderRow);
    }
    
    /**
     * Renders a single page row
     * @param {Object} page - Page data object
     * @param {Array} fieldNames - Array of field names in order
     */
    renderPageRow(page, fieldNames) {
        const row = document.createElement('tr');
        
        // Add page number
        const pageCell = document.createElement('td');
        pageCell.textContent = page.pageNumber;
        row.appendChild(pageCell);
        
        // Add fields in the same order as headers
        fieldNames.forEach(fieldName => {
            const td = document.createElement('td');
            const fieldData = page.fields[fieldName];
            
            if (!fieldData || fieldData.value === null) {
                td.textContent = 'N/A';
                td.className = 'no-value';
            } else {
                td.textContent = fieldData.value;
                if (fieldData.type === 'date') {
                    td.className = 'date-value';
                }
            }
            row.appendChild(td);
        });

        this.tbody.appendChild(row);
    }
    
    /**
     * Export table data to Excel
     */
    async exportToExcel() {
        if (!this.data?.pages?.length) {
            console.error('No data available for export');
            return;
        }

        try {
            const XLSX = window.XLSX;
            if (!XLSX) {
                throw new Error('XLSX library not loaded');
            }
            
            const wb = XLSX.utils.book_new();
            
            // Get field names in the same order as table headers
            const fieldNames = Object.keys(this.data.pages[0].fields);
            const headers = ['Page', ...fieldNames];
            
            // Create rows with consistent field order
            const rows = this.data.pages.map(page => {
                const row = [page.pageNumber];
                fieldNames.forEach(fieldName => {
                    const fieldData = page.fields[fieldName];
                    row.push(fieldData && fieldData.value !== null ? fieldData.value : 'N/A');
                });
                return row;
            });

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');

            const filename = 'extracted_data_' + new Date().toISOString().slice(0, 10) + '.xlsx';
            XLSX.writeFile(wb, filename);

        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export data. Please try again.');
        }
    }
}