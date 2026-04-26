CREATE TABLE IF NOT EXISTS healthai.api_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT NOW()
);


-- UPDATE healthai.api_users SET role = 'admin' WHERE email = 'your@email.com';
