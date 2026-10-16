import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

export interface FakeResponse {
  status: number;
  data: unknown;
}

// Adapter de Axios que responde sin red y guarda las peticiones recibidas.
export function fakeAdapter(respond: (config: InternalAxiosRequestConfig) => FakeResponse) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data } = respond(config);
    const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, {}, response);
    }
    return response;
  };
  return { adapter, calls };
}

export function bearer(config: InternalAxiosRequestConfig): string | undefined {
  const headers = AxiosHeaders.from(config.headers);
  const value = headers.get('Authorization');
  return typeof value === 'string' ? value : undefined;
}

// JWT sin firma válida: el front solo lee el payload.
export function makeToken(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.firma`;
}


export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
