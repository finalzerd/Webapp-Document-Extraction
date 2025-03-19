export class DataTable {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = { pages: [] };
        this.table = null;
        this.tbody = null;
        
        if (!this.container) {
            throw new Error(`Container with id ${containerId} not found`);
        }
        
        // Add styles immediately on construction
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
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
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
            .processing-row {
                animation: processing-bg 2s infinite;
            }
            @keyframes processing-bg {
                0% { background-color: #fff; }
                50% { background-color: #f0f7ff; }
                100% { background-color: #fff; }
            }
            .export-button {
                margin: 10px 0;
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
            .table-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding: 10px;
            }
            .table-status {
                font-size: 14px;
                color: #666;
            }
            .pending-row {
                opacity: 0.5;
                background-color: #f5f5f5;
            }
            .error-row {
                background-color: #fff3f3;
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

    initializeTable(headers) {
        this.container.innerHTML = '';
        
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        // Add controls section
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

        // Create table
        this.table = document.createElement('table');
        this.table.className = 'data-table';

        // Create header
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

    renderRows(pages) {
        if (!this.tbody) return;

        pages.forEach(page => {
            const row = document.createElement('tr');
            
            // Add page number
            const pageCell = document.createElement('td');
            pageCell.textContent = page.pageNumber;
            row.appendChild(pageCell);
            
            // Add field values
            Object.entries(page.fields).forEach(([field, fieldData]) => {
                const td = document.createElement('td');
                if (fieldData.value === null) {
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
        });
    }

    render(data) {
        try {
            console.log('Rendering data:', data);
            
            if (!data || !data.pages || data.pages.length === 0) {
                console.error('Invalid data format or empty data provided to DataTable render');
                return;
            }

            // Store the data
            this.data = data;

            // Get the field names from the first page
            const firstPage = data.pages[0];
            const fieldNames = Object.keys(firstPage.fields);
            
            // Log the field structure for debugging
            console.log('Field names for headers:', fieldNames);
            console.log('Sample data structure:', firstPage.fields);

            // Initialize or reinitialize the table with correct headers
            this.initializeTable(fieldNames);

            // Clear existing rows
            if (this.tbody) {
                this.tbody.innerHTML = '';
            }

            // Add new rows
            if (data.pages.length === 0) {
                const placeholderRow = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = fieldNames.length + 1; // +1 for page number column
                cell.className = 'table-placeholder';
                cell.textContent = 'No data available';
                placeholderRow.appendChild(cell);
                this.tbody.appendChild(placeholderRow);
            } else {
                // Ensure rows are rendered with fields in the same order as headers
                data.pages.forEach(page => {
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
                });
            }

            // Update status if available
            const status = this.container.querySelector('.table-status');
            if (status) {
                status.textContent = `Showing ${data.pages.length} page(s)`;
            }
        } catch (error) {
            console.error('Error in DataTable render:', error);
            throw error;
        }
    }

    async exportToExcel() {
        if (!this.data || !this.data.pages || this.data.pages.length === 0) {
            console.error('No data available for export');
            return;
        }

        try {
            const XLSX = window.XLSX;
            const wb = XLSX.utils.book_new();
            
            // Get field names in the same order as table headers
            const fieldNames = Object.keys(this.data.pages[0].fields);
            const headers = ['Page', ...fieldNames];
            
            // Create rows ensuring field order matches headers
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