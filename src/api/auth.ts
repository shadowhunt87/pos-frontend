import { publicHttp } from './client';
import type { EnrollStartResponse, LoginRequest, LoginResponse, LoginTokenResponse } from '@/types/api';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await publicHttp.post<LoginResponse>('/auth/login', body);
  return data;
}

/** Segundo paso: código de la app de autenticación (o de emergencia) con el desafío del primer paso. */
export async function loginTwoFactor(challengeToken: string, code: string): Promise<LoginTokenResponse> {
  const { data } = await publicHttp.post<LoginTokenResponse>('/auth/login/2fa', { challengeToken, code });
  return data;
}

/** Inscripción obligatoria en el login: devuelve el QR para la app de autenticación. */
export async function enrollStart(challengeToken: string): Promise<EnrollStartResponse> {
  const { data } = await publicHttp.post<EnrollStartResponse>('/auth/login/2fa/enroll', { challengeToken });
  return data;
}
