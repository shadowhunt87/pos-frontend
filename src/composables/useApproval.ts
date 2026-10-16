import { ref } from 'vue';
import { ApiError } from '@/api/errors';
import type { ApprovalAction } from '@/types/api';

const ACTIONS: readonly ApprovalAction[] = ['DISCOUNT', 'VOID', 'RETURN', 'CASH_OUT', 'DRAWER', 'CREDIT_SALE'];

/**
 * Autorización de supervisor (D-POS6 del backend). La caja intenta la acción; si el servidor responde
 * 422 APPROVAL_REQUIRED, pide el correo y el PIN de un supervisor y reintenta UNA vez con el approvalId (sirve una vez y
 * por 2 minutos). Quien es supervisor nunca recibe ese error.
 */
export function useApproval() {
  const action = ref<ApprovalAction | null>(null);
  let resolver: ((approvalId: string | null) => void) | null = null;

  function ask(a: ApprovalAction): Promise<string | null> {
    resolver?.(null);
    return new Promise((resolve) => {
      resolver = resolve;
      action.value = a;
    });
  }

  /** El modal terminó: con el id de la autorización, o null si se canceló. */
  function settle(approvalId: string | null): void {
    action.value = null;
    const r = resolver;
    resolver = null;
    r?.(approvalId);
  }

  /** Ejecuta la acción y, si hace falta, la autorización. Devuelve null si el cajero canceló el PIN. */
  async function run<T>(fn: (approvalId?: string) => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'APPROVAL_REQUIRED') throw e;
      const requested = e.body?.action;
      const a = ACTIONS.find((x) => x === requested);
      if (!a) throw e;
      const approvalId = await ask(a);
      if (!approvalId) return null;
      return fn(approvalId);
    }
  }

  return { action, settle, run };
}
