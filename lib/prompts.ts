// lib/prompts.ts

export const defaultSummarizationTemplate = `You are a Summarization Assistant. Your job is to read the text below—written in any language—and produce a single-paragraph summary in clear, fluent English. Focus on the following:

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
export const defaultExtractionTemplate = `You are an Information Extraction Assistant. Your task is to read the given text (which may appear in any language) and extract any company-level financial data into a well-structured JSON array. 
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
            "filePath": "some.pdf",
            "pageNumber": 1,
            "confidence": 0.9
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
- If multiple statements for different years are found, use the year as an integer key (e.g. "2018").
- If a variable is mentioned without a specific year, you may store it under "value" directly. 
- If a "type" of entity (company/fund) is mentioned, store it in the "type" field.
- If the text includes a short description of the company, store it in the "description" field.
- Omit fields not found in the text.

Document Text:
{documentText}
`;


// -------------------------------------------------
// 2) UPDATED CONSOLIDATION TEMPLATE
// -------------------------------------------------
export const defaultConsolidationTemplate = `Consolidate company data STRICTLY using this format:
{
  "companies": [{
    "name": "Consolidated Name",
    "type": "company|fund|fund-of-funds",
    "parent": "Parent Entity",
    "variables": {
      "metric_name": {
        "value": 123,
        "sources": [{
          "filePath": "document.pdf",
          "pageNumber": 5,
          "confidence": 0.95
        }],
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
8. For funds, list all invested companies in 'investments' array
9. For companies, list parent fund in 'parentFund' 
10. For subsidiaries, list parent company in 'parentCompany'
11. Maintain full ownership hierarchy in 'ownershipPath'

RAW DATA: {rawData}

OUTPUT:
`;

// -------------------------------------------------
// 3) VARIABLE NAME DETECTION PROMPT
// (Optional, only if you use it in your pipeline)
// -------------------------------------------------
export const defaultVariableExtraction = `Out of the following text, identify what financial variables are referenced, the text can be written in languages different than English. Return **only** the list of variables in lower case, using underscores for spaces.

Example:
["revenue", "operating_income", "total_assets"]

If a year is mentioned (like 2019), do **not** embed that year into the variable name— we only want the raw variable name. We also want:
- A one-paragraph short company description, if available
- A "type" field: "company" or "fund" (if the entity invests in other companies)

{text}
`;

// 2-A) INTERMEDIATE CONSOLIDATION TEMPLATE
export const defaultIntermediateConsolidationTemplate = `
Consolidate the following company data into valid JSON. This is an INTERMEDIATE step
per document only. DO NOT merge with data from other documents yet.

**Input** (rawData):
  {rawData}

**Rules**:
1. Return a JSON array or an object with a "companies" field that is itself an array. E.g.
   [{ "name":"...", "type":"company", "variables": {...}, "parent":"...", "ownershipPath":[] }, ...]
2. Make sure each company's variables are merged if repeated within THIS text. 
3. Use EXACT numeric or string values you see in the input (unless merging year-based). 
4. Do not combine data for other documents or references.
5. Summaries or disclaimers are not needed; just the JSON data.

**Output**:
\`\`\`json
[ ...or... { "companies": [ ... ] } ] 
\`\`\`
`.trim();