export type CompanyInfo = {
    name: string;
    sector?: string;
    profits?: Record<string, number | string>;
    assets?: Record<string, number | string>;
    ebitda?  : Record<string, number | string>;
    years?: number[];
  };