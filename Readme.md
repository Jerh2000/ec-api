# API REST Multitenant — Node.js + Express

---

## Modelo de Datos: Relación many-to-many Users ↔ Tenants

### El problema del diseño anterior
Tener `tenant_id` directo en `users` significaba duplicar personas:

```
❌ ANTES — Juan existe dos veces, dos contraseñas, datos duplicados
users: { id:1, email: abc@gmail.com, tenant_id: empresa-a, role: empleado }
users: { id:2, email: abc@gmail.com, tenant_id: empresa-b, role: cliente  }
```

### La solución: tabla de relación user_tenants
```
✅ AHORA — Juan existe una sola vez como persona

users:        { id:1, email: abc@gmail.com, nombre: Juan Pérez }

user_tenants: { user_id:1, tenant_id: empresa-a, role_id:3 }  ← empleado en A
              { user_id:1, tenant_id: empresa-b, role_id:2 }  ← cliente en B
```

### Diagrama completo

```
┌──────────┐       ┌──────────────┐       ┌─────────┐
│  users   │──(1)──│ user_tenants │──(N)──│ tenants │
│──────────│       │──────────────│       │─────────│
│ id       │       │ user_id (FK) │       │ id      │
│ email    │       │ tenant_id(FK)│       │ name    │
│ password │       │ role_id  (FK)│       │ slug    │
│ nombre   │       │ is_active    │       │ db_*    │
│ is_active│       │ created_at   │       └─────────┘
└──────────┘       └──────┬───────┘
                           │(N)
                      ┌────▼────┐
                      │  roles  │
                      │─────────│
                      │ id      │
                      │ nombre  │
                      └─────────┘
```

### Ventajas concretas
- **Una sola contraseña** para todas las empresas donde trabaja Juan
- **Datos personales centralizados** — cambiar el nombre lo actualiza en todos los tenants
- **Agregar a una empresa nueva** es solo un INSERT en `user_tenants`, no duplicar datos
- **Roles independientes por empresa** — empleado en A, cliente en B
- **Desactivar acceso a una empresa** sin afectar las otras membresías

---

## Estructura de Archivos

```
src/
├── app.js
├── server.js
├── config/
│   ├── database.js
│   └── jwt.js
├── controllers/
│   ├── authController.js       ← login 1 paso y 2 pasos
│   ├── userController.js       ← identidad + membresías
│   ├── roleController.js
│   └── tenantController.js
├── middlewares/
│   ├── authenticate.js
│   ├── errorHandler.js
│   ├── rateLimiter.js
│   └── validate.js
├── models/
│   ├── userModel.js            ← tabla users (identidad)
│   ├── userTenantModel.js      ← tabla user_tenants (membresías) ← NUEVO
│   ├── roleModel.js
│   ├── tenantModel.js
│   └── refreshTokenModel.js
├── routes/
│   ├── index.js
│   ├── authRoutes.js
│   ├── userRoutes.js           ← rutas de identidad + membresías
│   ├── roleRoutes.js
│   └── tenantRoutes.js
├── services/
│   ├── authService.js          ← login 1 paso y 2 pasos
│   ├── userService.js          ← identidad + membresías
│   └── tenantService.js
├── utils/
│   ├── AppError.js
│   ├── apiResponse.js
│   └── logger.js
└── validators/
    ├── authValidators.js
    └── userValidators.js
```

---

## Tablas en AUTH DB

```sql
-- Roles
CREATE TABLE roles (
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
```

---

## Flujos de Autenticación

### Flujo 1 — Dos pasos (recomendado para apps multi-empresa)

```
PASO 1: Verificar identidad
POST /auth/verify-identity
{ "email": "abc@gmail.com", "password": "1234" }

Respuesta:
{
  "userId": "uuid-juan",
  "nombre": "Juan Pérez",
  "tenants": [
    { "tenant_id": "uuid-a", "tenant_name": "Empresa A", "role_nombre": "empleado" },
    { "tenant_id": "uuid-b", "tenant_name": "Empresa B", "role_nombre": "cliente"  }
  ]
}

→ El frontend muestra el selector de empresa

PASO 2: Seleccionar empresa
POST /auth/select-tenant
{ "userId": "uuid-juan", "tenantId": "uuid-a" }

Respuesta: { accessToken, refreshToken, user: { role: "empleado", tenantId: "uuid-a" } }
```

### Flujo 2 — Un solo paso (tenant conocido, ej: subdominio)

```
POST /auth/login
{ "email": "abc@gmail.com", "password": "1234", "tenantId": "uuid-a" }

Respuesta: { accessToken, refreshToken, user }
```

---

## Endpoints

### Auth
| Método | Ruta                    | Auth | Descripción                        |
|--------|-------------------------|------|------------------------------------|
| POST   | /auth/verify-identity   | No   | Paso 1: verifica credenciales      |
| POST   | /auth/select-tenant     | No   | Paso 2: selecciona empresa         |
| POST   | /auth/login             | No   | Login directo (tenantId conocido)  |
| POST   | /auth/refresh           | No   | Renovar tokens                     |
| POST   | /auth/logout            | No   | Cerrar sesión actual               |
| GET    | /auth/me                | Sí   | Perfil autenticado                 |
| POST   | /auth/logout-all        | Sí   | Cerrar todas las sesiones          |

### Roles
| Método | Ruta         | Roles      | Descripción    |
|--------|--------------|------------|----------------|
| GET    | /roles       | cualquiera | Listar roles   |
| GET    | /roles/:id   | cualquiera | Obtener rol    |
| POST   | /roles       | superadmin | Crear rol      |
| PUT    | /roles/:id   | superadmin | Actualizar rol |
| DELETE | /roles/:id   | superadmin | Desactivar rol |

### Usuarios — Identidad
| Método | Ruta                  | Roles  | Descripción                      |
|--------|-----------------------|--------|----------------------------------|
| POST   | /users                | admin  | Crear usuario (solo identidad)   |
| GET    | /users/:id            | admin  | Obtener usuario                  |
| PUT    | /users/:id            | admin  | Actualizar datos personales      |
| DELETE | /users/:id            | admin  | Eliminar de la plataforma        |
| PATCH  | /users/:id/password   | propio | Cambiar contraseña               |

### Usuarios — Membresías
| Método | Ruta                                  | Roles  | Descripción                  |
|--------|---------------------------------------|--------|------------------------------|
| GET    | /users/:id/tenants                    | admin  | Ver empresas del usuario     |
| POST   | /users/:id/tenants                    | admin  | Agregar usuario a empresa    |
| PATCH  | /users/:id/tenants/:tenantId/role     | admin  | Cambiar rol en esa empresa   |
| DELETE | /users/:id/tenants/:tenantId          | admin  | Quitar de esa empresa        |

### Tenants
| Método | Ruta           | Roles      | Descripción          |
|--------|----------------|------------|----------------------|
| POST   | /tenants       | superadmin | Crear tenant         |
| GET    | /tenants       | superadmin | Listar tenants       |
| GET    | /tenants/:id   | superadmin | Obtener tenant       |
| PUT    | /tenants/:id   | superadmin | Actualizar tenant    |
| DELETE | /tenants/:id   | superadmin | Eliminar tenant      |

---

## Instalación

```bash
npm install
cp .env.example .env
# Crear tablas en AUTH DB (ver SQL arriba)
npm run dev
```