// lib/prompts.ts

export const defaultSummarizationTemplate = `
### IMPORTANT
Return **only** valid JSON (no markdown fences, no extra text). You are in JSON mode.


You are a Summarization Assistant. Your job is to read the text below—written in any language—and produce a single-paragraph summary in clear, fluent English. Focus on the following:

Key financial metrics (e.g., revenue, assets, profitability)
Risks (e.g., market risks, operational risks)
Opportunities (e.g., potential growth, strategic advantages)

Instructions:
- Write exactly one paragraph.
- Emphasize the most relevant financial details, along with notable risks and opportunities.
- Avoid minor or irrelevant information.
- Output only the summarized text, with no extra commentary, headings, or disclaimers.
- Include source file path and page numbers
- Note any ownership relationships
- Preserve exact numerical values with units

Document Text: {documentText};

Output format:
    {
      "companies": [{
        "name": "Example Corp",
        "type": "company",
        "parent": "Parent Fund",
        "variables": {
          "valuation": 1000000,
          "revenue": 500000
        },
        "sources": [{
          "filePath": "documents/financials.pdf",
          "pageNumber": 3
        }]
      }]
    }
`;


// -------------------------------------------------
// 1) UPDATED EXTRACTION TEMPLATE
// -------------------------------------------------
export const defaultExtractionTemplate = `
### IMPORTANT
Return **only** valid JSON (no markdown fences, no extra text). You are in JSON mode.

You are an Information Extraction Assistant. Your task is to read the given text (which may appear in any language) and extract any company-level financial data into a well-structured JSON array. 
There could be multiple companies mentioned, so generate an array entry for each distinct company.

**IMPORTANT**: 
- Each variable must appear **only once**, without appending the year to the variable name. 
- If a year is mentioned in the text (e.g., 2018, 2019), store that as a nested object under the variable key. 
- Example structure for a single variable "operating_income" across 2018 and 2019:

  "variables": {
    "operating_income": {
      "2018": {
        "value": "123,456",
        "currency": "USD",
        "sources": [
          {
            "filePath": "<relative/path/to/file>",
            "pageNumber": 1
          }
        ]
      },
      "2019": {
        "value": "200,000",
        "currency": "USD",
        "sources": []
      }
    }
  }

Rules:
- Output ONLY valid JSON: no markdown, no extra text.
- Use EXACT values from the text (including currency symbols) for numeric fields where possible.
- For each variable and each year (or for the top-level value), include a "sources" array. Each element must be an object with:
  {
    "filePath": "<relative/path/to/file>",
    "pageNumber": <page number as integer>
  }
- Do NOT emit "<relative/path/to/file>" (or any placeholder) literally; use the actual filename (e.g. "Annual report 2020.pdf").
- If multiple statements for different years are found, use the year as an integer key (e.g. "2018").
- If a variable is mentioned without a specific year, you may store it under "value" directly. 
- If a "type" of entity (company/fund) is mentioned, store it in the "type" field. Use only company, fund, or fund-of-funds.
- If the text includes a short description of the company, store it in the "description" field.
- Omit fields not found in the text.
- ALWAYS prioritize returning a complete JSON object, even if it means truncating the output, make sure you close the JSON object properly.

Document Path:
{documentPath}

Document Text:
{documentText}
`;


// -------------------------------------------------
// 2) UPDATED CONSOLIDATION TEMPLATE
// -------------------------------------------------
export const defaultConsolidationTemplate = `
### IMPORTANT
Return **only** valid JSON (no markdown fences, no extra text). You are in JSON mode.


Consolidate company data STRICTLY using this format:
{
  "companies": [{
    "name": "Consolidated Name",
    "type": "company|fund|fund-of-funds",
    "parent": "Parent Entity",
    "variables": {
      "metric_name": {
        "value": 123,
        "sources": [
          {
            "filePath": "<relative/path/to/file>",
            "pageNumber": 5
          }
        ],
        "2018": {
          "value": 456,
          "sources": [...]
        }
      }
    },
    "ownershipPath": ["Top Parent", "Immediate Parent"],
      "investments": [{
      "company": "Invested Company Name",
      "ownershipPercentage": 30,
      "sources": [...] 
    }],
    "subsidiaries": ["Subsidiary Name"],
    "parentFund": "Main Fund Name",
  }]
}

Rules:
1. ALWAYS return an array of companies, even if empty.
2. DO NOT append the year to the variable name; if a year is present, store it under that key inside "metric_name".
3. Consolidate repeated variables. If the same metric is found in multiple places, combine them as necessary, merging sources.
4. Convert all values to numbers where possible, but preserve numeric formatting if it's ambiguous (like "1,501,419" can stay as string if uncertain).
5. Use EXACT names from the raw data for the company and variables, except do not append the year in the variable name.
6. ALWAYS translate the variable names to English, even if the original text is in another language.
7. Always return the file path and page number for each source, this is a must, you know for sure what is the name of the file, and the page number comes from information inside of the text.
8. Do NOT emit "<relative/path/to/file>" (or any placeholder) literally; replace it with the actual source document filename (e.g. "Annual report 2020.pdf").
9. For funds, list all invested companies in 'investments' array.
10. For companies, list parent fund in 'parentFund'.
11. For subsidiaries, list parent company in 'parentCompany'.
12. Maintain full ownership hierarchy in 'ownershipPath'.
13. ALWAYS return a complete JSON object, if your response is too long I prefer to have it cut off than to have an incomplete JSON object.
14. Do not return any other text, just the JSON object.

RAW DATA: {rawData}

OUTPUT:
`;

// -------------------------------------------------
// 3) VARIABLE NAME DETECTION PROMPT
// (Optional, only if you use it in your pipeline)
// -------------------------------------------------
export const defaultVariableExtraction = `
### IMPORTANT
Return **only** valid lists (no markdown fences, no extra text). 

Out of the following text, identify what financial variables are referenced, the text can be written in languages different than English. Return **only** the list of variables in lower case, using underscores for spaces.

Example:
["revenue", "operating_income", "total_assets"]

If a year is mentioned (like 2019), do **not** embed that year into the variable name— we only want the raw variable name. We also want:
- A one-paragraph short company description, if available
- A "type" field: "company" or "fund" (if the entity invests in other companies), do not use the name of the type in any other language. For example
do not use Aksjeselskap for norwegian companies.

{text}
`;
// File: lib/prompts.ts

export const defaultIntermediateConsolidationTemplate = `
### IMPORTANT
Return **only** valid JSON (no markdown fences, no extra text). You are in JSON mode.

Analyze and merge company data from different sections of this document. Follow these rules:

1. Combine duplicate entries for the same company
2. Preserve all numerical values and their sources
3. Maintain year-specific data under appropriate keys
4. Never discard any financial metrics or sources
5. Keep all ownership hierarchy details
6. For each metric under "variables" (for every year or top-level value), include a "sources" array. Each element must be an object with:
   {
     "filePath": "<relative/path/to/file>",
     "pageNumber": <page number as integer>
   }
7. Do NOT emit "<relative/path/to/file>" (or any placeholder) literally; use the actual source filename (e.g. "Annual report 2020.pdf").

Input Data:
{rawData}

Return a JSON array with merged companies in this format:
[
  {
    "name": "Company Name",
    "variables": {
      "metric_name": {
        "2023": {
          "value": 100000,
          "currency": "USD",
          "sources": [
            {"filePath": "<relative/path/to/file>", "pageNumber": 5}
          ]
        }
      }
    },
    "ownershipPath": ["Parent Company"],
    "investments": [
      {
        "company": "Subsidiary Name",
        "ownershipPercentage": 60,
        "sources": [...] 
      }
    ]
  }
]
`;
