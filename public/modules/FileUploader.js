export class FileUploader {
    constructor(config = {}) {
        this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB
        this.maxTotalSize = 100 * 1024 * 1024; // 100MB combined
        this.maxTotalFiles = config.maxTotalFiles || 10;
        this.allowedFileType = config.allowedFileType || 'application/pdf';
        this.onError = config.onError || ((error) => console.error(error));
        this.onProgress = config.onProgress || (() => {});
    }

    async handleFiles(files) {
        try {
            const filesArray = Array.from(files);
            console.log('FileUploader: Processing files:', filesArray.map(f => f.name));

            if (!this.validateFiles(filesArray)) {
                return null;
            }

            const base64Results = await Promise.all(
                filesArray.map(async (file, index) => {
                    console.log(`Converting file ${index + 1}/${filesArray.length}:`, file.name);
                    const base64 = await this.convertToBase64(file);
                    
                    this.onProgress({
                        stage: 'conversion',
                        current: index + 1,
                        total: filesArray.length,
                        message: `Converting file ${index + 1} of ${filesArray.length}`
                    });
                    
                    return base64;
                })
            );

            console.log('FileUploader: All files converted successfully');
            return base64Results.map(result => result.split(',')[1]);

        } catch (error) {
            console.error('FileUploader Error:', error);
            this.onError(error);
            return null;
        }
    }

    validateFiles(files) {
        if (!files || files.length === 0) {
            this.onError(new Error('No files selected'));
            return false;
        }

        if (files.length > this.maxTotalFiles) {
            this.onError(new Error(`Maximum ${this.maxTotalFiles} files allowed`));
            return false;
        }

        // Calculate total size
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > this.maxTotalSize) {
            this.onError(new Error(`Combined file size exceeds 100MB limit`));
            return false;
        }

        for (const file of files) {
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPDF) {
                this.onError(new Error(`${file.name} is not a PDF file`));
                return false;
            }

            if (file.size > this.maxFileSize) {
                this.onError(new Error(`${file.name} exceeds 100MB size limit`));
                return false;
            }
        }

        return true;
    }

    convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                console.log(`File converted: ${file.name}`);
                resolve(reader.result);
            };
            
            reader.onerror = () => {
                console.error(`Error reading file: ${file.name}`);
                reject(new Error(`Failed to read file: ${file.name}`));
            };

            reader.readAsDataURL(file);
        });
    }
}