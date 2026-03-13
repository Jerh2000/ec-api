CREATE DATABASE MarketOS_Main

CREATE TABLE roles 
(
  id          INT          PRIMARY KEY IDENTITY(1,1),
  nombre      VARCHAR(50)  UNIQUE NOT NULL,
  descripcion VARCHAR(200) NULL,
  is_active   BIT          DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT GETDATE()
);

INSERT INTO roles (nombre, descripcion, created_at) VALUES
  ('admin',    'Administrador del tenant',      GETDATE()),
  ('cliente',  'Cliente externo de la empresa', GETDATE()),
  ('empleado', 'Empleado de la empresa',        GETDATE());

  -- Tenants (empresas)
CREATE TABLE tenants (
  id          VARCHAR(36)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  UNIQUE NOT NULL,
  db_client   VARCHAR(10)  NOT NULL,
  db_host     VARCHAR(200) NOT NULL,
  db_port     INT          NOT NULL,
  db_user     VARCHAR(100) NOT NULL,
  db_password VARCHAR(200) NOT NULL,
  db_name     VARCHAR(100) NOT NULL,
  is_active   BIT          DEFAULT 1,
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  deleted_at  DATETIME     NULL
);

-- Usuarios (identidades — una fila por persona)
CREATE TABLE users (
  id            VARCHAR(36)  PRIMARY KEY,
  email         VARCHAR(200) UNIQUE NOT NULL,   -- unicidad global simple
  password_hash VARCHAR(200) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  is_active     BIT          DEFAULT 1,
  created_at    DATETIME     NOT NULL,
  updated_at    DATETIME     NOT NULL,
  deleted_at    DATETIME     NULL
);

-- Membresías (relación many-to-many users ↔ tenants)
CREATE TABLE user_tenants (
  user_id    VARCHAR(36) NOT NULL REFERENCES users(id),
  tenant_id  VARCHAR(36) NOT NULL REFERENCES tenants(id),
  role_id    INT         NOT NULL REFERENCES roles(id),
  is_active  BIT         DEFAULT 1,
  created_at DATETIME    NOT NULL,
  updated_at DATETIME    NOT NULL,

  PRIMARY KEY (user_id, tenant_id)   -- un usuario, un rol por empresa
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
  id          VARCHAR(36)  PRIMARY KEY,
  user_id     VARCHAR(36)  REFERENCES users(id),
  token_hash  VARCHAR(200) UNIQUE NOT NULL,
  expires_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL,
  revoked_at  DATETIME     NULL
);


INSERT INTO users (
  id, email, password_hash, nombre,
  is_active, created_at, updated_at, deleted_at
)
VALUES (
  NEWID(),
  'admin@fruttiencanto.com',
  -- bcrypt hash de 'Admin123!' — reemplaza con el hash real generado por tu app
  '$2b$10$Ei7Qv6QkL1fKj9WzHnqR4.eW1kT9Jl3mNpY8sXcVgDuBhA0oZqMui',
  'Administrador',
  1, GETDATE(), GETDATE(), NULL
);



INSERT INTO user_tenants (user_id, tenant_id, role_id, is_active, created_at, updated_at)
SELECT
  u.id,
  t.id,
  r.id,
  1,
  GETDATE(),
  GETDATE()
FROM users    u CROSS JOIN
     tenants  t CROSS JOIN
     roles    r
WHERE u.email  = 'admin@fruttiencanto.com'
 
  AND r.nombre = 'admin';