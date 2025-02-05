-- Create database
CREATE DATABASE sec_financial_data;
\c sec_financial_data;

-- Create tables
CREATE TABLE companies (
    cik VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE tickers (
    id SERIAL PRIMARY KEY,
    cik VARCHAR(10) REFERENCES companies(cik),
    ticker VARCHAR(10) NOT NULL
);

CREATE TABLE financial_data (
    id SERIAL PRIMARY KEY,
    cik VARCHAR(10) REFERENCES companies(cik),
    accn VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    location VARCHAR(50),
    value NUMERIC(15,2) NOT NULL,
    frame VARCHAR(20) NOT NULL,
    taxonomy VARCHAR(20) NOT NULL,
    units VARCHAR(10) NOT NULL,
    account_name VARCHAR(255) NOT NULL
);

-- Indexes for faster search
CREATE INDEX idx_companies_name ON companies USING gin(to_tsvector('english', name));
CREATE INDEX idx_tickers_ticker ON tickers(ticker);
CREATE INDEX idx_financial_data_cik ON financial_data(cik);

ALTER TABLE tickers
ADD CONSTRAINT unique_cik_ticker UNIQUE (cik, ticker);