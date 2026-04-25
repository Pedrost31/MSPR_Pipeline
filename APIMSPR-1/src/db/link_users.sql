--  api_users aux profils santé
ALTER TABLE healthai.utilisateur
  ADD COLUMN IF NOT EXISTS api_user_id INT,
  ADD CONSTRAINT fk_api_user
    FOREIGN KEY (api_user_id)
    REFERENCES healthai.api_users(id)
    ON DELETE SET NULL;
