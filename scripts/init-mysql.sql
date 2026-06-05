-- Yerel MySQL kurulumu için örnek script
-- XAMPP phpMyAdmin veya mysql CLI ile çalıştırın

CREATE DATABASE IF NOT EXISTS blb_authenticator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'blb_auth'@'localhost' IDENTIFIED BY 'blb_auth_secret';
CREATE USER IF NOT EXISTS 'blb_auth'@'%' IDENTIFIED BY 'blb_auth_secret';

GRANT ALL PRIVILEGES ON blb_authenticator.* TO 'blb_auth'@'localhost';
GRANT ALL PRIVILEGES ON blb_authenticator.* TO 'blb_auth'@'%';

FLUSH PRIVILEGES;
