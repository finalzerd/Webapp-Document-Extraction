import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { VertexAI } from '@google-cloud/vertexai';
import { PDFHandler } from './PDFHandler.js';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Token usage logging function
function logTokenUsage(endpoint, input, output) {
    const inputTokens = Math.ceil(JSON.stringify(input).length / 4);
    const outputTokens = Math.ceil(output.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const cost = (totalTokens / 1000) * 0.0005;

    console.log('\n' + '='.repeat(40));
    console.log(`Token Usage for ${endpoint}`);
    console.log('-'.repeat(40));
    console.log(`Input Tokens: ${inputTokens}`);
    console.log(`Output Tokens: ${outputTokens}`);
    console.log(`Total Tokens: ${totalTokens}`);
    console.log(`Estimated Cost: $${cost.toFixed(6)}`);
    console.log('='.repeat(40) + '\n');
}

// Load and verify credentials
const credentials = JSON.parse(
    await readFile(new URL('./config/google-credentials.json', import.meta.url))
);
console.log('Loaded Google Cloud credentials for project:', credentials.project_id);

const app = express();
const pdfHandler = new PDFHandler();

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increased limit to 100MB
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Vertex AI
let vertex_ai = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id,
    location: 'us-central1',
    credentials: credentials
});

// Initialize generative model
let generativeModel = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-1.5-flash-002',
    generationConfig: {
        'maxOutputTokens': 8192,
        'temperature': 0.7,
        'topP': 0.8,
    },
    safetySettings: [
        {
            'category': 'HARM_CATEGORY_HATE_SPEECH',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_HARASSMENT',
            'threshold': 'OFF',
        }
    ],
});

// Merge PDFs endpoint
app.post('/merge-pdfs', async (req, res) => {
    try {
        const { pdfs } = req.body;
        
        if (!pdfs || !Array.isArray(pdfs)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid input: pdfs array is required' 
            });
        }

        console.log('Server: Received merge request for', pdfs.length, 'PDFs');

        if (pdfs.length === 1) {
            return res.json({
                success: true,
                mergedPDF: pdfs[0]
            });
        }

        const mergedPDF = await pdfHandler.mergeBase64PDFs(pdfs);
        console.log('Server: PDFs merged successfully');

        return res.json({
            success: true,
            mergedPDF: mergedPDF
        });
    } catch (error) {
        console.error('Server: Merge error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to merge PDFs'
        });
    }
});

// Get page count endpoint
app.post('/get-page-count', async (req, res) => {
    try {
        const { base64Content } = req.body;
        
        if (!base64Content) {
            return res.status(400).json({ 
                success: false,
                error: 'No PDF content provided' 
            });
        }

        const pageCount = await pdfHandler.getPageCount(base64Content);
        console.log('Page count:', pageCount);

        return res.json({
            success: true,
            pageCount: pageCount
        });

    } catch (error) {
        console.error('Page count error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Suggest fields endpoint (uses first page only)
app.post('/suggest-fields', async (req, res) => {
    try {
        const { base64Content } = req.body;
        
        if (!base64Content) {
            return res.status(400).json({ 
                success: false,
                error: 'No PDF content provided' 
            });
        }

        const firstPageBase64 = await pdfHandler.getFirstPageBase64(base64Content);
        
        const request = {
            contents: [{
                role: "user",
                parts: [
                    { text: `Analyze this PDF document and identify extractable fields. Return your response in this exact JSON format, with no additional text before or after:

[
    {
        "fieldName": "field1",
        "description": "description1"
    },
    {
        "fieldName": "field2",
        "description": "description2"
    }
]

Important rules:
1. Return ONLY the JSON array, no other text
2. Use camelCase for fieldNames (no spaces)
3. Both fieldName and description must be in the same language as the document
4. Each field must have exactly these two properties: fieldName and description
5. Ensure the response is valid JSON with proper quotes and commas` },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: firstPageBase64
                        }
                    }
                ]
            }]
        };

        const response = await generativeModel.generateContent(request);
        const result = response.response.candidates[0].content.parts[0].text;
        
        logTokenUsage('suggest-fields', request.contents[0].parts[0].text, result);

        let fields;
        try {
            // Try to find a JSON array in the response
            const jsonMatch = result.match(/\[(.*?)\]/s);
            if (jsonMatch) {
                fields = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON array found, try to parse the entire response
                fields = JSON.parse(result);
            }

            // Validate the fields structure
            if (!Array.isArray(fields)) {
                throw new Error('Invalid response format: expected array of fields');
            }

            fields = fields.filter(field => 
                field && 
                typeof field === 'object' &&
                typeof field.fieldName === 'string' &&
                typeof field.description === 'string'
            );

            if (fields.length === 0) {
                throw new Error('No valid fields found in response');
            }

            console.log('Parsed fields:', fields);
        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('Raw response:', result);
            throw new Error('Failed to parse field suggestions from AI response');
        }

        return res.json({
            success: true,
            fields: fields
        });

    } catch (error) {
        console.error('Field suggestion error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Extract data from group endpoint
app.post('/extract-data-group', async (req, res) => {
    try {
        const { base64Content, selectedFields, groupInfo } = req.body;
        
        if (!base64Content || !selectedFields || !groupInfo) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid input provided' 
            });
        }

        // Get the specific group of pages
        const groupPages = await pdfHandler.getPageGroup(base64Content, groupInfo.groupIndex);

        const requestText = `Extract the following fields from pages ${groupInfo.startPage} to ${groupInfo.endPage}: ${selectedFields.join(', ')}

Return your response in this exact JSON format, with no additional text before or after:

{
    "pages": [
        {
            "pageNumber": number,
            "fields": {
                "fieldName1": {
                    "value": "extracted value",
                    "type": "text"
                }
            }
        }
    ]
}

Rules:
1. Return ONLY the JSON object, no other text
2. Use proper JSON format with double quotes
3. For empty or not found values, use null
4. Page numbers must be actual numbers, not strings
5. Keep original field names exactly as provided
6. Use "type": "date" for date values, "text" for others`;

        const request = {
            contents: [{
                role: "user",
                parts: [
                    { text: requestText },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: groupPages.base64
                        }
                    }
                ]
            }]
        };

        const response = await generativeModel.generateContent(request);
        const result = response.response.candidates[0].content.parts[0].text;
        
        logTokenUsage('extract-data-group', requestText, result);

        let extractedData;
        try {
            // Try to find a JSON object in the response
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON object found in response');
            }

            // Validate the structure
            if (!extractedData.pages || !Array.isArray(extractedData.pages)) {
                throw new Error('Invalid response format: missing pages array');
            }

            // Validate each page
            extractedData.pages.forEach(page => {
                if (!page.pageNumber || !page.fields) {
                    throw new Error('Invalid page format in response');
                }
            });

            console.log('Parsed extracted data:', extractedData);
        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('Raw response:', result);
            throw new Error('Failed to parse extracted data from AI response');
        }

        return res.json({
            success: true,
            data: extractedData,
            groupInfo: groupInfo
        });

    } catch (error) {
        console.error('Group data extraction error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            groupInfo: req.body.groupInfo
        });
    }
});


// Extract table data endpoint
app.post('/extract-table-data', async (req, res) => {
    try {
        const { base64Content } = req.body;
        
        if (!base64Content) {
            return res.status(400).json({ 
                success: false,
                error: 'No PDF content provided' 
            });
        }

        // Step 1: Get page count only once
        console.log("Getting document page count...");
        const pageCount = await pdfHandler.getPageCount(base64Content);
        console.log(`PDF has ${pageCount} pages total`);

        // Step 2: Extract first page for header analysis
        console.log("Analyzing first page to determine table structure...");
        const firstPageBase64 = await pdfHandler.getFirstPageBase64(base64Content);
        
        // First page analysis request
        const headerRequest = {
            contents: [{
                role: "user",
                parts: [
                    { text: `Extract ONLY the column headers from the main transaction table in this bank statement.
Format your response as a simple array of strings like this: ["Column1", "Column2", "Column3"]
If there are multiple tables, focus on the main transaction table that shows statement entries.
DO NOT include any additional text, explanation, or code blocks.` },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: firstPageBase64
                        }
                    }
                ]
            }]
        };

        let headers = [];
        // Use retry pattern for header extraction
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const headerResponse = await generativeModel.generateContent(headerRequest);
                const headerResult = headerResponse.response.candidates[0].content.parts[0].text;
                
                // Clean the response
                let cleanedResponse = headerResult.trim();
                if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/^```(\w+)?\s*/, '').replace(/\s*```\s*$/, '');
                }
                
                // Find array pattern
                const arrayMatch = cleanedResponse.match(/\[\s*".*"\s*\]/);
                if (arrayMatch) {
                    cleanedResponse = arrayMatch[0];
                }
                
                try {
                    headers = JSON.parse(cleanedResponse);
                    console.log("Successfully extracted headers:", headers);
                    break; // Success, exit retry loop
                } catch (parseError) {
                    console.log(`Header parsing error (attempt ${attempt}/3):`, parseError.message);
                    if (attempt === 3) throw parseError;
                    await delay(attempt * 3000); // Exponential backoff with longer delays
                }
            } catch (error) {
                console.error(`Header extraction error (attempt ${attempt}/3):`, error.message);
                if (attempt === 3) throw error;
                await delay(attempt * 3000); // Exponential backoff with longer delays
            }
        }
        
        // If we still don't have headers, use default ones
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
            headers = ["Date", "Description", "Amount", "Balance"];
            console.log("Using default headers:", headers);
        }

        // Step 3: Process each page sequentially to extract table data
        const extractedData = {
            pages: []
        };
        
        // Create a cache to store page groups and avoid redundant fetching
        const pageGroupCache = {};
        
        // Process pages one by one with retries
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            // Calculate page group
            const groupIndex = Math.floor((pageNum - 1) / 10);

            // Get or create page group data
            if (!pageGroupCache[groupIndex]) {
                console.log(`Fetching page group ${groupIndex}...`);
                pageGroupCache[groupIndex] = await pdfHandler.getPageGroup(base64Content, groupIndex);
            } else {
                console.log(`Using cached page group ${groupIndex} for page ${pageNum}`);
            }

            let succeeded = false;
            
            // Define retry function for page processing
            for (let attempt = 1; attempt <= 5 && !succeeded; attempt++) {
                try {
                    console.log(`Processing page ${pageNum} of ${pageCount} (attempt ${attempt}/5)...`);
                    
                    // Get page data
                    const pageGroup = pageGroupCache[groupIndex];
                    
                    // Create page request
                    const pageRequest = {
                        contents: [{
                            role: "user",
                            parts: [
                                { text: `Extract the transaction table data from page ${pageNum} of this bank statement.
Format your response as a valid JavaScript array of arrays like this:
[
  ["Value1", "Value2", "Value3"],
  ["Value1", "Value2", "Value3"]
]
Rules:
- Include ALL transaction rows on the page
- Make sure rows align with these columns: ${JSON.stringify(headers)}
- Return ONLY the array of arrays with no explanations
- If there's no table data on this page, return an empty array: []
- DO NOT include column headers, only data rows
- Replace any newlines in cell values with spaces` },
                                {
                                    inlineData: {
                                        mimeType: "application/pdf",
                                        data: pageGroup.base64
                                    }
                                }
                            ]
                        }]
                    };
                    
                    const pageResponse = await generativeModel.generateContent(pageRequest);
                    const pageResult = pageResponse.response.candidates[0].content.parts[0].text;
                    
                    // Clean the response
                    let cleanedResponse = pageResult.trim();
                    if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
                        cleanedResponse = cleanedResponse.replace(/^```(\w+)?\s*/, '').replace(/\s*```\s*$/, '');
                    }
                    
                    // Extract array
                    const arrayMatch = cleanedResponse.match(/\[\s*\[[\s\S]*\]\s*\]/);
                    if (arrayMatch) {
                        cleanedResponse = arrayMatch[0];
                    }
                    
                    // Parse the rows data
                    let rows = [];
                    try {
                        rows = JSON.parse(cleanedResponse);
                        console.log(`Successfully parsed ${rows.length} rows for page ${pageNum}`);
                        
                        // Sanitize the data - ensure all cells are strings with no newlines
                        rows = rows.map(row => {
                            return row.map(cell => String(cell || '').replace(/[\r\n]+/g, ' '));
                        });
                        
                        // Add to result
                        extractedData.pages.push({
                            pageNumber: pageNum,
                            tableData: {
                                headers: headers,
                                rows: rows
                            }
                        });
                        
                        succeeded = true;
                    } catch (parseError) {
                        console.error(`Error parsing rows for page ${pageNum} (attempt ${attempt}/5):`, parseError.message);
                        if (attempt === 5) {
                            // After max retries, add empty data
                            extractedData.pages.push({
                                pageNumber: pageNum,
                                tableData: {
                                    headers: headers,
                                    rows: []
                                }
                            });
                        } else {
                            // Wait longer between retries
                            await delay(15000);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing page ${pageNum} (attempt ${attempt}/5):`, error.message);
                    
                    if (attempt === 5) {
                        // After max retries, add empty data
                        extractedData.pages.push({
                            pageNumber: pageNum,
                            tableData: {
                                headers: headers,
                                rows: []
                            }
                        });
                    } else {
                        // Wait longer between retries
                        await delay(15000);
                    }
                }
            }
            
            // Add a longer wait between pages (10 seconds) to avoid rate limits
            if (pageNum < pageCount) {
                console.log(`Waiting 15 seconds before processing next page...`);
                await delay(15000);
            }
        }
        
        // Sort pages by page number to ensure correct order
        extractedData.pages.sort((a, b) => a.pageNumber - b.pageNumber);
        
        console.log(`Successfully processed ${extractedData.pages.length} pages`);
        
        return res.json({
            success: true,
            data: extractedData
        });

    } catch (error) {
        console.error('Table data extraction error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function for delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=== Server Started ===`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
    console.log(`Vertex AI Status: Ready`);
});

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('=== Unhandled Rejection ===');
    console.error(error);
});

process.on('uncaughtException', (error) => {
    console.error('=== Uncaught Exception ===');
    console.error(error);
});