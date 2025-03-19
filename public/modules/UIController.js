import { DataTable } from '/modules/DataTable.js';

export class UIController {
    constructor() {
        this.isProcessing = false;
        this.selectedFields = [];
        this.currentGroupIndex = 0;
        this.totalGroups = 0;
        this.accumulatedData = { pages: [] };
        this.initializeElements();
        this.dataTable = new DataTable('dataTableContainer');
        this.bindEvents();
    }

    initializeElements() {
        // Core elements
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.uploadButton = document.getElementById('uploadButton');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.fieldSelectionContainer = document.getElementById('fieldSelection');

        // New elements for group processing
        this.createGroupProgressElements();

        // Verify critical elements
        if (!this.dropZone) throw new Error('Drop zone element not found');
        if (!this.fileInput) throw new Error('File input element not found');
        if (!this.fileList) throw new Error('File list element not found');
        if (!this.uploadButton) throw new Error('Upload button not found');
        if (!this.fieldSelectionContainer) throw new Error('Field selection container not found');
    }

    createGroupProgressElements() {
        // Create group progress container
        this.groupProgressContainer = document.createElement('div');
        this.groupProgressContainer.className = 'group-progress-container';
        this.groupProgressContainer.style.display = 'none';
        
        // Create progress elements
        const progressHTML = `
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
        
        this.groupProgressContainer.innerHTML = progressHTML;
        
        // Add styles
        const style = document.createElement('style');
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
        
        // Insert after field selection container
        this.fieldSelectionContainer.parentNode.insertBefore(
            this.groupProgressContainer,
            this.fieldSelectionContainer.nextSibling
        );
    }

    bindEvents() {
        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', () => {
                this.fileInput.click();
            });
        }
    }

    updateFileList(files) {
        if (!this.fileList) return;
        
        this.fileList.innerHTML = '';
        const filesArray = Array.from(files);

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
            this.fileList.appendChild(fileItem);
        });

        if (filesArray.length > 0) {
            const totalSize = filesArray.reduce((acc, file) => acc + file.size, 0);
            const summary = document.createElement('div');
            summary.className = 'file-summary';
            summary.textContent = `Total: ${filesArray.length} files (${this.formatFileSize(totalSize)})`;
            this.fileList.appendChild(summary);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    initializeGroupProgress(totalGroups) {
        this.currentGroupIndex = 0;
        this.totalGroups = totalGroups;
        this.accumulatedData = { pages: [] };
        this.groupProgressContainer.style.display = 'block';
        this.updateGroupProgress(0, totalGroups);
    }

    updateGroupProgress(currentGroup, totalGroups, pageInfo = null) {
        const progressFill = this.groupProgressContainer.querySelector('.group-progress-fill');
        const currentGroupText = this.groupProgressContainer.querySelector('.current-group');
        const pagesInfo = this.groupProgressContainer.querySelector('.pages-info');
        
        // Calculate percentage based on completed groups (0 to 100)
        const percentage = ((currentGroup + 1) / totalGroups) * 100;
        progressFill.style.width = `${percentage}%`;
        
        currentGroupText.textContent = `Processing group ${currentGroup + 1} of ${totalGroups}`;
        
        if (pageInfo) {
            pagesInfo.textContent = `Pages: ${pageInfo.startPage}-${pageInfo.endPage} of ${pageInfo.totalPages}`;
        }
    }

    setGroupStatus(message, isError = false) {
        const statusDiv = this.groupProgressContainer.querySelector('.group-status');
        const progressFill = this.groupProgressContainer.querySelector('.group-progress-fill');
        
        statusDiv.textContent = message;
        statusDiv.className = `group-status ${isError ? 'error' : 'success'}`;
        
        // Add or remove the processing animation class
        if (isError) {
            progressFill.classList.remove('processing');
        } else if (message.includes('Completed group')) {
            progressFill.classList.add('processing');
        } else if (message.includes('All groups processed')) {
            progressFill.classList.remove('processing');
            // Ensure the progress bar is completely filled
            progressFill.style.width = '100%';
        }
    }

    updateProgress(progressData) {
        if (this.progressContainer && this.progressBar && this.progressText) {
            this.progressContainer.style.display = 'block';
            
            const percentage = (progressData.current / progressData.total) * 100;
            this.progressBar.style.width = `${percentage}%`;
            this.progressText.textContent = progressData.message;

            if (progressData.current === progressData.total) {
                setTimeout(() => {
                    this.progressContainer.style.display = 'none';
                }, 1000);
            }
        }
    }

    showFieldSelection(fields) {
        if (!this.fieldSelectionContainer) return;

        this.fieldSelectionContainer.innerHTML = `
            <div class="field-selection">
                <h3>Select Fields to Analyze</h3>
                <div class="fields-grid">
                    ${fields.map(field => `
                        <div class="field-item">
                            <label>
                                <input type="checkbox" 
                                       value="${field.fieldName}" 
                                       data-description="${field.description}"
                                />
                                <span class="field-name">${field.fieldName}</span>
                                <span class="field-description">${field.description}</span>
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
                const selectedCheckboxes = this.fieldSelectionContainer
                    .querySelectorAll('input[type="checkbox"]:checked');
                
                this.selectedFields = Array.from(selectedCheckboxes)
                    .map(cb => cb.value);
                
                const event = new CustomEvent('fieldsSelected', { 
                    detail: this.selectedFields 
                });
                document.dispatchEvent(event);
            });
        }

        this.fieldSelectionContainer.style.display = 'block';
    }

    updateTableWithGroupData(groupData, groupInfo) {
        try {
            // Ensure dataTable is initialized
            if (!this.dataTable) {
                console.log('Initializing DataTable');
                this.dataTable = new DataTable('dataTableContainer');
            }

            // Initialize accumulatedData if needed
            if (!this.accumulatedData.pages) {
                this.accumulatedData = { pages: [] };
            }

            console.log('Adding new pages to accumulated data:', groupData.pages);
            
            // Add new pages to accumulated data
            this.accumulatedData.pages.push(...groupData.pages);
            
            // Sort pages by page number
            this.accumulatedData.pages.sort((a, b) => a.pageNumber - b.pageNumber);
            
            console.log('Rendering accumulated data:', this.accumulatedData);
            
            // Update the table with all accumulated data
            this.dataTable.render(this.accumulatedData);
            
            // Update group progress
            this.updateGroupProgress(
                groupInfo.groupIndex,
                this.totalGroups,
                {
                    startPage: groupInfo.startPage,
                    endPage: groupInfo.endPage,
                    totalPages: groupInfo.totalPages
                }
            );
        } catch (error) {
            console.error('Error updating table with group data:', error);
            throw new Error(`Failed to update table: ${error.message}`);
        }
    }

    setProcessingState(processing) {
        this.isProcessing = processing;
        if (this.dropZone) {
            this.dropZone.classList.toggle('processing', processing);
        }
        if (this.uploadButton) {
            this.uploadButton.disabled = processing;
            this.uploadButton.textContent = processing ? 'Processing PDFs...' : 'Select PDF files';
        }

        const analyzeBtn = document.getElementById('analyzeSelected');
        if (analyzeBtn) {
            analyzeBtn.disabled = processing;
        }
    }

    showError(message) {
        console.error('UI Error:', message);
        if (!this.dropZone) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.dropZone.appendChild(errorDiv);
        
        this.setGroupStatus(message, true);
        setTimeout(() => this.clearError(), 5000);
    }

    clearError() {
        if (!this.dropZone) return;
        const errorMessage = this.dropZone.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }

    resetState() {
        if (this.fileInput) this.fileInput.value = '';
        if (this.fileList) this.fileList.innerHTML = '';
        if (this.progressContainer) this.progressContainer.style.display = 'none';
        if (this.progressBar) this.progressBar.style.width = '0';
        if (this.fieldSelectionContainer) {
            this.fieldSelectionContainer.style.display = 'none';
            this.fieldSelectionContainer.innerHTML = '';
        }
        if (this.groupProgressContainer) {
            this.groupProgressContainer.style.display = 'none';
        }
        this.selectedFields = [];
        this.currentGroupIndex = 0;
        this.totalGroups = 0;
        this.accumulatedData = { pages: [] };
        this.clearError();
    }
}