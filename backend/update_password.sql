-- Update admin user with bcrypt hash for password 'admin123'
-- Generated fresh in container with bcrypt 4.0.1
UPDATE collaborators 
SET hashed_password = '$2b$12$Oj62mwLdlmAAwUIFBM2jteNMXGn2CFrL4KkA/1NmKDnnHJhKKOGQt' 
WHERE email = 'admin@example.com';
