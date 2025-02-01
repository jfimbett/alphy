-- db/schema.sql

-- 1) Users table
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  company VARCHAR(255),
  reason TEXT,
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

-- 7) Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  session_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);


CREATE TABLE files (
  file_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  session_id INT REFERENCES sessions(session_id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5) Extractions table
CREATE TABLE IF NOT EXISTS extractions (
  extraction_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  extracted_text TEXT,
  summarized_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

-- 6) Named Entities table
CREATE TABLE IF NOT EXISTS named_entities (
  entity_id SERIAL PRIMARY KEY,
  file_id INT NOT NULL,
  entity_type VARCHAR(50),
  entity_name VARCHAR(255),
  confidence NUMERIC(5, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(file_id)
);

