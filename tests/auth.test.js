'use strict';

/**
 * @file tests/auth.test.js
 * @description Tests de integración para los endpoints de autenticación.
 *
 * Para ejecutar: npm test
 */

const request = require('supertest');
const app = require('../src/app');

// Mock de servicios para no depender de BD real en tests
jest.mock('../src/services/authService');
jest.mock('../src/config/database');

const authService = require('../src/services/authService');

describe('POST /api/v1/auth/login', () => {

  it('debe retornar 200 y tokens con credenciales válidas', async () => {
    authService.login.mockResolvedValueOnce({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: { id: '1', email: 'test@example.com', role: 'user' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('debe retornar 422 si el email es inválido', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-email', password: 'password123' });

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('debe retornar 401 si las credenciales son incorrectas', async () => {
    const { AppError } = jest.requireActual('../src/utils/AppError');
    authService.login.mockRejectedValueOnce(
      new (require('../src/utils/AppError'))('Credenciales incorrectas.', 401)
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(res.statusCode).toBe(401);
  });

});

describe('GET /api/v1/auth/me', () => {

  it('debe retornar 401 sin token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

});