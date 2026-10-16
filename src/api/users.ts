import { http } from './client';
import type { CreateUserRequest, Page, UserRow, UpdateUserRequest } from '@/types/api';

// Usuarios de la empresa: rutas del núcleo, solo para el administrador. Crear o cambiar un usuario pide la clave del
// administrador (y su código si tiene verificación en dos pasos): un token robado no basta.

export async function listUsers(q: { q?: string; page?: number; limit?: number } = {}): Promise<Page<UserRow>> {
  return (await http.get<Page<UserRow>>('/users', { params: { limit: 100, ...q } })).data;
}

export async function createUser(body: CreateUserRequest): Promise<UserRow> {
  return (await http.post<UserRow>('/auth/register', body)).data;
}

export async function updateUser(id: string, body: UpdateUserRequest): Promise<UserRow> {
  return (await http.patch<UserRow>(`/users/${id}`, body)).data;
}

export async function resetUserPassword(id: string, body: { password: string; confirmPassword: string; confirmCode?: string }): Promise<unknown> {
  return (await http.post<unknown>(`/users/${id}/reset-password`, body)).data;
}
