-- db/schema.sql

-- 1) Users table
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  upload_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  upload_name VARCHAR(255),
  upload_path TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 3) Files table
CREATE TABLE IF NOT EXISTS files (
  file_id SERIAL PRIMARY KEY,
  upload_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT,
  mime_type VARCHAR(100),
  is_extracted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (upload_id) REFERENCES uploads(upload_id)
);

-- 4) Extractions table
CREATE TABLE IF NOT EXISTS extractions (
  extraction_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  extracted_text TEXT,
  summarized_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

-- 5) Named entities (optional)
CREATE TABLE IF NOT EXISTS named_entities (
  entity_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  entity_type VARCHAR(50),
  entity_name VARCHAR(255),
  confidence NUMERIC(5, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

-- 6) Sessions table (to store user progress)
CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  session_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
