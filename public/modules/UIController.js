import { DataTable } from '/modules/DataTable.js';

export class UIController {
    constructor() {
        this.state = {
            isProcessing: false,
            selectedFields: [],
            currentGroupIndex: 0,
            totalGroups: 0,
            accumulatedData: { pages: [] },
            currentPage: 0,
            totalPages: 0
        };
        
        // Initialize elements first
        this.elements = this.initializeElements();
        
        // Initialize data table
        try {
            this.dataTable = new DataTable('dataTableContainer');
        } catch (error) {
            console.warn('DataTable initialization failed:', error.message);
            this.dataTable = null;
        }
        
        this.bindEvents();
    }

    /**
     * Initialize all UI elements
     * @returns {Object} Object containing elements
     */
    initializeElements() {
        // Core elements
        const elements = {
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            uploadButton: document.getElementById('uploadButton'),
            progressContainer: document.getElementById('progressContainer'),
            progressBar: document.getElementById('progressBar'),
            progressText: document.getElementById('progressText'),
            fieldSelectionContainer: document.getElementById('fieldSelection'),
            modeSelectionContainer: document.getElementById('modeSelection'),
            extractionProgressContainer: document.getElementById('extractionProgressContainer'),
            groupProgress: this.createGroupProgressElements(),
            simpleProgress: null // Will be initialized when needed
        };
        
        // Validate critical elements (excluding optional ones)
        this.validateRequiredElements(elements);
        
        // Initially hide the dropZone
        if (elements.dropZone) {
            elements.dropZone.style.display = 'none';
        }
        
        return elements;
    }
    
    /**
     * Validate that required elements exist
     */
    validateRequiredElements(elements) {
        const requiredElements = [
            'dropZone', 'fileInput', 'fileList', 'uploadButton',
            'fieldSelectionContainer', 'modeSelectionContainer'
        ];
        
        const missingElements = [];
        for (const key of requiredElements) {
            if (!elements[key]) {
                missingElements.push(key);
            }
        }
        
        if (missingElements.length > 0) {
            console.warn(`Missing required UI elements: ${missingElements.join(', ')}`);
        }
    }

    /**
     * Create group progress elements
     * @returns {Object} DOM elements for group progress
     */
    createGroupProgressElements() {
        // Create container
        const container = document.createElement('div');
        container.className = 'group-progress-container';
        container.style.display = 'none';
        
        // Create HTML structure
        container.innerHTML = `
            <div class="group-progress">
                <h4>Processing PDF in Groups</h4>
                <div class="group-progress-bar">
                    <div class="group-progress-fill"></div>
                </div>
                <div class="group-progress-text">
                    <span class="current-group">Processing group 0 of 0</span>
                    <span class="pages-info">Pages: 0-0 of 0</span>
                </div>
                <div class="group-status"></div>
            </div>
        `;
        
        // Add styles
        this.addGroupProgressStyles();
        
        // Don't try to insert it yet - we'll do that when we need to show it
        
        return {
            container,
            fill: container.querySelector('.group-progress-fill'),
            currentGroup: container.querySelector('.current-group'),
            pagesInfo: container.querySelector('.pages-info'),
            status: container.querySelector('.group-status')
        };
    }

    /**
     * Method to replace the progress bar with a simple text status indicator
     */
    createSimpleProgressDisplay() {
        // Create container
        const container = document.createElement('div');
        container.id = 'simple-progress-container';
        container.className = 'simple-progress-container';
        container.style.display = 'none';
        
        // Create HTML structure
        container.innerHTML = `
            <div class="simple-progress">
                <h4>Processing Document</h4>
                <div class="progress-status">
                    <span id="progress-text">Processing...</span>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.id = 'simple-progress-styles';
        style.textContent = `
            .simple-progress-container {
                margin-top: 20px;
                padding: 15px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                text-align: center;
            }
            .simple-progress h4 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 16px;
            }
            .progress-status {
                font-size: 16px;
                color: #2196f3;
                margin: 10px 0;
                font-weight: 500;
            }
            @keyframes pulse {
                0% { opacity: 0.8; }
                50% { opacity: 1; }
                100% { opacity: 0.8; }
            }
            #progress-text {
                display: inline-block;
                animation: pulse 1.5s infinite;
            }
        `;
        
        if (!document.getElementById('simple-progress-styles')) {
            document.head.appendChild(style);
        }
        
        return container;
    }

    /**
     * Initialize simple progress display
     * @param {number} totalPages - Total number of pages
     */
    initializeSimpleProgress(totalPages) {
        // Reset state
        this.state.currentPage = 1;
        this.state.totalPages = totalPages;
        
        // Create container if it doesn't exist
        if (!this.elements.simpleProgress) {
            const container = this.createSimpleProgressDisplay();
            
            // Try to add it to the document
            const fieldContainer = this.elements.fieldSelectionContainer;
            if (fieldContainer && fieldContainer.parentNode) {
                fieldContainer.parentNode.insertBefore(container, fieldContainer.nextSibling);
                this.elements.simpleProgress = {
                    container,
                    text: container.querySelector('#progress-text')
                };
            } else {
                // Fallback to data table container
                const dataTableContainer = document.getElementById('dataTableContainer');
                if (dataTableContainer) {
                    dataTableContainer.parentNode.insertBefore(container, dataTableContainer);
                    this.elements.simpleProgress = {
                        container,
                        text: container.querySelector('#progress-text')
                    };
                }
            }
        }
        
        // Check if we have the elements
        if (this.elements.simpleProgress?.container) {
            this.elements.simpleProgress.container.style.display = 'block';
            this.updateSimpleProgress(1);
        }
    }

    /**
     * Update simple progress display
     * @param {number} currentPage - Current page being processed
     */
    updateSimpleProgress(currentPage) {
        if (!this.elements.simpleProgress?.text) return;
        
        this.state.currentPage = currentPage;
        this.elements.simpleProgress.text.textContent = 
            `Processing page ${currentPage} of ${this.state.totalPages}`;
    }

    /**
     * Complete simple progress display
     * @param {boolean} success - Whether processing was successful
     * @param {string} message - Optional completion message
     */
    completeSimpleProgress(success = true, message = null) {
        if (!this.elements.simpleProgress?.text) return;
        
        if (success) {
            this.elements.simpleProgress.text.textContent = 
                message || `Completed processing all ${this.state.totalPages} pages!`;
        } else {
            this.elements.simpleProgress.text.textContent = 
                message || 'Processing incomplete due to errors';
        }
        
        // Remove animation
        this.elements.simpleProgress.text.style.animation = 'none';
        
        // Add success/error styling
        this.elements.simpleProgress.text.style.color = success ? '#4caf50' : '#f44336';
        
        // Hide after delay
        setTimeout(() => {
            if (this.elements.simpleProgress?.container) {
                this.elements.simpleProgress.container.style.display = 'none';
            }
        }, 3000);
    }

    /**
     * Add styles for group progress
     */
    addGroupProgressStyles() {
        // Check if styles are already added
        if (document.getElementById('group-progress-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'group-progress-styles';
        style.textContent = `
            .group-progress-container {
                margin-top: 20px;
                padding: 15px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .group-progress h4 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 16px;
            }
            .group-progress-bar {
                height: 8px;
                background: #f0f0f0;
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
                position: relative;
            }
            .group-progress-fill {
                height: 100%;
                width: 0;
                background: linear-gradient(90deg, #2196f3, #64b5f6);
                transition: width 0.5s ease;
                border-radius: 4px;
                position: absolute;
                top: 0;
                left: 0;
            }
            .group-progress-text {
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                color: #666;
                margin-top: 8px;
            }
            .group-status {
                margin-top: 10px;
                font-size: 14px;
                padding: 8px;
                border-radius: 4px;
            }
            .group-status.error {
                background-color: #ffebee;
                color: #d32f2f;
            }
            .group-status.success {
                background-color: #e8f5e9;
                color: #2e7d32;
            }
            @keyframes progress-glow {
                0% { box-shadow: 0 0 5px rgba(33, 150, 243, 0.5); }
                50% { box-shadow: 0 0 10px rgba(33, 150, 243, 0.8); }
                100% { box-shadow: 0 0 5px rgba(33, 150, 243, 0.5); }
            }
            .group-progress-fill.processing {
                animation: progress-glow 1.5s infinite;
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        if (this.elements.uploadButton) {
            this.elements.uploadButton.addEventListener('click', () => {
                if (this.elements.fileInput) {
                    this.elements.fileInput.click();
                }
            });
        }
    }

    /**
     * Show mode selection dialog
     */
    showModeSelection() {
        const container = this.elements.modeSelectionContainer;
        if (!container) return;
        
        container.innerHTML = `
            <div class="mode-selection">
                <h3>Select Document Type</h3>
                <div class="mode-options">
                    <div class="mode-option">
                        <input type="radio" id="fieldExtractionMode" name="extractionMode" value="field" checked>
                        <label for="fieldExtractionMode">
                            <div class="mode-title">Invoice or Receipt</div>
                            <div class="mode-description">Extract specific fields like invoice numbers, dates, amounts, etc.</div>
                            <div class="mode-best-for">Best for: Invoices, Receipts, Forms</div>
                            <div class="mode-note"><strong>Note:</strong> You'll need to select which fields to extract.</div>
                        </label>
                    </div>
                    <div class="mode-option">
                        <input type="radio" id="tableExtractionMode" name="extractionMode" value="table">
                        <label for="tableExtractionMode">
                            <div class="mode-title">Bank Statement</div>
                            <div class="mode-description">Extract complete transaction tables automatically</div>
                            <div class="mode-best-for">Best for: Bank Statements, Transaction Lists, Reports</div>
                            <div class="mode-note"><strong>Note:</strong> All transaction data will be extracted automatically.</div>
                        </label>
                    </div>
                </div>
                <button id="continueWithMode" class="primary-btn">Continue</button>
            </div>
        `;
    
        const continueBtn = document.getElementById('continueWithMode');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                const selectedMode = document.querySelector('input[name="extractionMode"]:checked')?.value || 'field';
                container.style.display = 'none';
                
                document.dispatchEvent(new CustomEvent('modeSelected', { 
                    detail: selectedMode 
                }));
            });
        }
    
        container.style.display = 'block';
    }

    /**
     * Show or hide extraction progress
     */
    showExtractionProgress(show = true, status = '', percentage = 0) {
        const container = this.elements.extractionProgressContainer;
        if (!container) return;
        
        if (show) {
            const statusMessage = document.getElementById('statusMessage');
            const progressFill = document.getElementById('extractionProgressFill');
            const progressDetails = document.getElementById('progressDetails');
            
            if (statusMessage) statusMessage.textContent = status || 'Processing...';
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressDetails) {
                progressDetails.textContent = `Progress: ${percentage}% complete`;
            }
            
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Update file list display
     */
    updateFileList(files) {
        const fileList = this.elements.fileList;
        if (!fileList) return;
        
        fileList.innerHTML = '';
        const filesArray = Array.from(files);

        // Create file items
        filesArray.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;

            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = this.formatFileSize(file.size);

            fileItem.appendChild(fileName);
            fileItem.appendChild(fileSize);
            fileList.appendChild(fileItem);
        });

        // Show summary
        if (filesArray.length > 0) {
            const totalSize = filesArray.reduce((acc, file) => acc + file.size, 0);
            const summary = document.createElement('div');
            summary.className = 'file-summary';
            summary.textContent = `Total: ${filesArray.length} files (${this.formatFileSize(totalSize)})`;
            fileList.appendChild(summary);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Make sure group progress container is added to the DOM
     */
    ensureGroupProgressInDOM() {
        // Check if container is already in the DOM
        if (this.elements.groupProgress.container.parentNode) {
            return true;
        }
        
        // Try to add it to the document
        const fieldContainer = this.elements.fieldSelectionContainer;
        if (fieldContainer && fieldContainer.parentNode) {
            fieldContainer.parentNode.insertBefore(
                this.elements.groupProgress.container,
                fieldContainer.nextSibling
            );
            return true;
        }
        
        // As a fallback, try to add it to the data table container
        const dataTableContainer = document.getElementById('dataTableContainer');
        if (dataTableContainer) {
            dataTableContainer.parentNode.insertBefore(
                this.elements.groupProgress.container,
                dataTableContainer
            );
            return true;
        }
        
        // Last resort, add it to the body
        if (document.body) {
            document.body.appendChild(this.elements.groupProgress.container);
            return true;
        }
        
        return false;
    }

    /**
     * Initialize group progress display
     */
    initializeGroupProgress(totalGroups) {
        this.state.currentGroupIndex = 0;
        this.state.totalGroups = totalGroups;
        this.state.accumulatedData = { pages: [] };
        
        // Make sure container is in the DOM before showing it
        if (!this.ensureGroupProgressInDOM()) {
            console.warn('Could not add group progress to DOM');
            return false;
        }
        
        // Show the container
        if (this.elements.groupProgress.container) {
            this.elements.groupProgress.container.style.display = 'block';
        }
        
        this.updateGroupProgress(0, totalGroups);
        return true;
    }

    /**
     * Update group progress display
     */
    updateGroupProgress(currentGroup, totalGroups, pageInfo = null) {
        // Safety check for element existence
        const { fill, currentGroup: currentGroupText, pagesInfo } = this.elements.groupProgress || {};
        if (!fill || !currentGroupText) {
            console.warn('Group progress elements not available');
            return;
        }
        
        // Calculate percentage
        const percentage = ((currentGroup + 1) / totalGroups) * 100;
        fill.style.width = `${percentage}%`;
        
        if (currentGroupText) {
            currentGroupText.textContent = `Processing group ${currentGroup + 1} of ${totalGroups}`;
        }
        
        if (pagesInfo && pageInfo) {
            pagesInfo.textContent = `Pages: ${pageInfo.startPage}-${pageInfo.endPage} of ${pageInfo.totalPages}`;
        }
    }

    /**
     * Set group status message
     */
    setGroupStatus(message, isError = false) {
        // Safety check
        const { status, fill } = this.elements.groupProgress || {};
        if (!status) {
            console.warn('Group status element not available');
            return;
        }
        
        status.textContent = message;
        status.className = `group-status ${isError ? 'error' : 'success'}`;
        
        if (fill) {
            if (isError) {
                fill.classList.remove('processing');
            } else if (message.includes('Completed group')) {
                fill.classList.add('processing');
            } else if (message.includes('All groups processed')) {
                fill.classList.remove('processing');
                fill.style.width = '100%';
            }
        }
    }

    /**
     * Update progress display
     */
    updateProgress(progressData) {
        const { progressContainer, progressBar, progressText } = this.elements;
        
        if (progressContainer && progressBar && progressText) {
            progressContainer.style.display = 'block';
            
            const percentage = (progressData.current / progressData.total) * 100;
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = progressData.message;

            if (progressData.current === progressData.total) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1000);
            }
        }
    }

    /**
     * Show field selection UI
     */
    showFieldSelection(fields) {
        const container = this.elements.fieldSelectionContainer;
        if (!container) return;

        container.innerHTML = `
            <div class="field-selection">
                <h3>Select Fields to Analyze</h3>
                <div class="fields-grid">
                    ${fields.map(field => `
                        <div class="field-item">
                            <label>
                                <input type="checkbox" 
                                       value="${field.fieldName}" 
                                       data-description="${field.description || ''}"
                                />
                                <span class="field-name">${field.fieldName}</span>
                                <span class="field-description">${field.description || ''}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
                <button id="analyzeSelected" class="analyze-btn">
                    Analyze Selected Fields
                </button>
            </div>
        `;

        const analyzeBtn = document.getElementById('analyzeSelected');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                const selectedCheckboxes = container.querySelectorAll('input[type="checkbox"]:checked');
                this.state.selectedFields = Array.from(selectedCheckboxes).map(cb => cb.value);
                
                document.dispatchEvent(new CustomEvent('fieldsSelected', { 
                    detail: this.state.selectedFields 
                }));
            });
        }

        container.style.display = 'block';
    }

    /**
     * Update table with group data
     */
    updateTableWithGroupData(groupData, groupInfo) {
        try {
            // Initialize dataTable if needed
            if (!this.dataTable) {
                try {
                    this.dataTable = new DataTable('dataTableContainer');
                } catch (error) {
                    console.warn('Failed to initialize DataTable:', error.message);
                    return false;
                }
            }

            // Initialize accumulatedData if needed
            if (!this.state.accumulatedData.pages) {
                this.state.accumulatedData = { pages: [] };
            }
            
            // Add new pages to accumulated data
            this.state.accumulatedData.pages.push(...groupData.pages);
            
            // Sort pages by page number
            this.state.accumulatedData.pages.sort((a, b) => a.pageNumber - b.pageNumber);
            
            // Update the table with all accumulated data
            this.dataTable.render(this.state.accumulatedData);
            
            // Update group progress
            this.updateGroupProgress(
                groupInfo.groupIndex,
                this.state.totalGroups,
                {
                    startPage: groupInfo.startPage,
                    endPage: groupInfo.endPage,
                    totalPages: groupInfo.totalPages
                }
            );
            
            return true;
        } catch (error) {
            console.error('Error updating table with group data:', error);
            this.showError(`Failed to update table: ${error.message}`);
            return false;
        }
    }

    /**
     * Set processing state
     */
    setProcessingState(processing) {
        this.state.isProcessing = processing;
        
        if (this.elements.dropZone) {
            this.elements.dropZone.classList.toggle('processing', processing);
        }
        
        if (this.elements.uploadButton) {
            this.elements.uploadButton.disabled = processing;
            this.elements.uploadButton.textContent = processing ? 'Processing PDFs...' : 'Select PDF files';
        }

        const analyzeBtn = document.getElementById('analyzeSelected');
        if (analyzeBtn) {
            analyzeBtn.disabled = processing;
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        console.error('UI Error:', message);
        const dropZone = this.elements.dropZone;
        if (!dropZone) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        dropZone.appendChild(errorDiv);
        
        // Only try to set group status if the elements exist
        if (this.elements.groupProgress?.status) {
            this.setGroupStatus(message, true);
        }
        
        setTimeout(() => this.clearError(), 5000);
    }

    /**
     * Clear error message
     */
    clearError() {
        const dropZone = this.elements.dropZone;
        if (!dropZone) return;
        
        const errorMessage = dropZone.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }

    /**
     * Reset UI state
     */
    resetState() {
        const { fileInput, fileList, progressContainer, progressBar, 
                fieldSelectionContainer, groupProgress, modeSelectionContainer, 
                dropZone, simpleProgress } = this.elements;
                
        if (fileInput) fileInput.value = '';
        if (fileList) fileList.innerHTML = '';
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0';
        
        if (fieldSelectionContainer) {
            fieldSelectionContainer.style.display = 'none';
            fieldSelectionContainer.innerHTML = '';
        }
        
        if (groupProgress?.container) {
            groupProgress.container.style.display = 'none';
        }
        
        if (simpleProgress?.container) {
            simpleProgress.container.style.display = 'none';
        }
        
        // Hide extraction progress
        this.showExtractionProgress(false);
        
        // Show mode selection and hide drop zone
        if (modeSelectionContainer) {
            modeSelectionContainer.style.display = 'block';
        }
        
        if (dropZone) {
            dropZone.style.display = 'none';
        }
        
        // Reset state
        this.state.selectedFields = [];
        this.state.currentGroupIndex = 0;
        this.state.totalGroups = 0;
        this.state.accumulatedData = { pages: [] };
        this.state.currentPage = 0;
        this.state.totalPages = 0;
        
        this.clearError();
    }
}