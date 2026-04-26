CREATE TABLE IF NOT EXISTS healthai.sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES healthai.api_users(id) ON DELETE CASCADE
);
