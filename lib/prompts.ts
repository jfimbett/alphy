export const defaultSummarizationTemplate = `You are a Summarization Assistant. Your job is to read the text below—written in any language—and produce a single-paragraph summary in clear, fluent English. Focus on the following:

Key financial metrics (e.g., revenue, assets, profitability)
Risks (e.g., market risks, operational risks)
Opportunities (e.g., potential growth, strategic advantages)

Instructions:
- Write exactly one paragraph.
- Emphasize the most relevant financial details, along with notable risks and opportunities.
- Avoid minor or irrelevant information.
- Output only the summarized text, with no extra commentary, headings, or disclaimers.

Document Text: {documentText};`;

export const defaultExtractionTemplate = `You are an Information Extraction Assistant. Your task is to read the given text (which may appear in any language) and extract any company-level financial data into a well-structured JSON array. There could be multiple companies mentioned, so please generate an array entry for each distinct company.

Variables:
{variables}

Rules:
- Output ONLY valid JSON: Do not include markdown, explanations, or any text outside the JSON.
- Use EXACT values from the text (including any currency symbols) for numeric fields.
- Skip any fields that are not present in the text.
- If multiple statements for different years are found, list all those years in the "years" array and include the corresponding values.
- Do not include any additional text or explanation outside of the JSON array.

Document Text:
{documentText};`;

// Update the consolidation template to be more explicit
export const defaultConsolidationTemplate = `Consolidate company data STRICTLY using this format:
[{
  "name": "Exact Company Name",
  "type": "company/fund",
  "description": "Max 1 paragraph",
  "variables": {
    "snake_case_name": {
      "YYYY": { 
        "value": number, 
        "currency": "XXX", 
        "unit": "m/k/b" 
      }
    }
  },
  "dates": ["YYYY-MM-DD"]
}]

Rules:
1. ALWAYS return an array, even if empty
2. Use EXACT names from source data
3. Include ALL variables from raw data
4. Convert all values to numbers where possible

RAW DATA: {rawData}

OUTPUT:`;

export const defaultVariableExtraction = `Out of the following text, identify what financial variables are referenced, the text can be written in languages different than english, return me only the list of variables without the values

["var1", "var2", ...]

here is the text, return the name of the variables in english, also be consistent across names and try not to duplicate them, Im looking mostly for accounting variables
Also return the names of the variables in lower case and with underscores instead of spaces.

List first the variables that would be traditionally in an Income Statement, 
then the ones that would be in a Balance Sheet,
then the ones that would be in a Cash Flow Statement,
one that includes the description of the company, maximum one paragraph,
one that includes a variable that is the type of company, if it is a company or a fund, 
if the whole business of the company is to invest in other companies then consider it a fund.

{text}`;