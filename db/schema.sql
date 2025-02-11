-- db/schema.sql

-- 1) Users table (unchanged)
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  company VARCHAR(255),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- sessions table (lighter)
CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  session_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);


CREATE TABLE IF NOT EXISTS files (
  file_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  session_id INT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);


-- 4) Extractions table (modified)
CREATE TABLE IF NOT EXISTS extractions (
  extraction_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  extracted_text TEXT,      -- Store path to text file if large
  summarized_text TEXT,     -- Store path to summary file if large
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

-- 5) Named Entities table (unchanged)
CREATE TABLE IF NOT EXISTS named_entities (
  entity_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  entity_type VARCHAR(50),
  entity_name VARCHAR(255),
  confidence NUMERIC(5, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

-- Example: Create an uploads table
CREATE TABLE IF NOT EXISTS uploads (
  upload_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,                -- references 'users' table
  upload_name VARCHAR(255) NOT NULL,   -- name of the upload (e.g. "Financial Docs")
  upload_path TEXT,                    -- optional path or label, if needed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create api_keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    provider TEXT NOT NULL,
    decrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);