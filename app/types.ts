export type CompanyInfo = {
    name: string;
    sector?: string;
    profits?: Record<string, number | string>;
    assets?: Record<string, number | string>;
    ebitda?  : Record<string, number | string>;
    years?: number[];
  };

  export interface VariableData {
    value?: number | string;
    currency?: string;
    unit?: string;
  }
  
  export interface ConsolidatedCompany {
    name: string;
    variables: Record<string, VariableData>;
    dates: string[];
  }