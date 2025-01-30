-- db/testdata.sql
-- 
-- This file inserts random data into the tables: users, uploads, files, extractions, named_entities.
-- 
-- Make sure you have already run your schema (db/schema.sql) so these tables exist.

-- 1) Insert some users
INSERT INTO users (email, password_hash, full_name)
VALUES 
  ('john@example.com', 'fakehash123', 'John Doe'),
  ('jane@example.com', 'fakehashABC', 'Jane Smith'),
  ('bob@example.com',  'fakehashXYZ', 'Bob Martin');

-- 2) Insert some uploads
-- Let's assume each user did a couple of uploads
-- We'll store references to user_id = 1, 2, 3 from above. 
-- The "upload_path" might be a local or S3 path, just an example string
INSERT INTO uploads (user_id, upload_name, upload_path)
VALUES
  (1, 'Q1 Financials', '/uploads/2023_04_01_Q1_financials.zip'),
  (1, 'M&A Documents', '/uploads/MnA_Acquisition_Jan.zip'),
  (2, 'Random Folder', '/uploads/RandomDataFolder.zip'),
  (3, 'Company Deck', '/uploads/CompanyDeckInfo.zip');

-- 3) Insert some files 
-- The foreign key "upload_id" must match the "upload_id" from the uploads above.
-- We'll add random PDF/Excel names to show variety
INSERT INTO files (upload_id, file_name, file_path, mime_type, is_extracted)
VALUES
  -- For the first upload (upload_id=1)
  (1, 'Fund_ABC_Financials.pdf', '/files/Fund_ABC_Financials.pdf', 'application/pdf', FALSE),
  (1, 'Q1_Statements.xls',        '/files/Q1_Statements.xls',       'application/vnd.ms-excel', FALSE),
  (1, 'Company_Overview.pdf',     '/files/Company_Overview.pdf',    'application/pdf', FALSE),

  -- For the second upload (upload_id=2)
  (2, 'M_and_A_Terms.pdf',        '/files/M_and_A_Terms.pdf',       'application/pdf', FALSE),
  (2, 'Deal_Appendix.xlsx',       '/files/Deal_Appendix.xlsx',      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', FALSE),

  -- For the third upload (upload_id=3)
  (3, 'Random_Presentation.pdf',  '/files/Random_Presentation.pdf',  'application/pdf', FALSE),

  -- For the fourth upload (upload_id=4)
  (4, 'Company_Deck_v2.pdf',      '/files/Company_Deck_v2.pdf',     'application/pdf', FALSE),
  (4, 'Some_Excel_Data.xlsx',     '/files/Some_Excel_Data.xlsx',    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', FALSE);

-- 4) Insert extractions
-- We'll pretend we've already extracted text from some files. 
-- That means "is_extracted" would be TRUE for them if we want to reflect that. 
-- Let’s do that in the insert for extractions directly:

-- For demonstration, let's insert extracted text for file_id = 1, 2, 3 (the PDFs or XLS from above).
-- This means you’d have run your pipeline on these files, got the text, and are saving it here.
-- We'll also set them to is_extracted=TRUE in the files table.
UPDATE files SET is_extracted = TRUE WHERE file_id IN (1, 2, 3);

INSERT INTO extractions (file_id, extracted_text, summarized_text)
VALUES
  (1, 
   'This is random extracted text from Fund_ABC_Financials.pdf. It mentions Fund ABC and total assets of $120M <think>some hidden reasoning about their capital structure</think>.', 
   'Fund ABC has $120M in assets.'),
  (2, 
   'Extracted text from Q1_Statements.xls, which lists total revenue of $50M. <think>some hidden reasoning about revenue breakdown</think>', 
   'Revenue stands at $50M.'),
  (3,
   'Overview about the company. They are interested in a partial exit. <think>this is hidden reasoning</think>',
   'Company is exploring a partial exit.');


-- 5) Insert named_entities (optional)
-- Let’s say we recognized 2 entities in file 1 and 1 entity in file 2.
INSERT INTO named_entities (file_id, entity_type, entity_name, confidence)
VALUES
  (1, 'FUND', 'Fund ABC', 0.95),
  (1, 'METRIC', '$120M', 0.90),
  (2, 'METRIC', '$50M', 0.88);
