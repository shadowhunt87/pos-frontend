import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

// Avisos flotantes para confirmar acciones sin mover el contenido de la pantalla.
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 1;

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function push(tone: ToastTone, title: string, message?: string, ms = 4500): void {
    const id = nextId++;
    toasts.value = [...toasts.value.slice(-3), { id, tone, title, message }];
    setTimeout(() => dismiss(id), ms);
  }

  return {
    toasts,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message, 7000),
    info: (title: string, message?: string) => push('info', title, message),
  };
});
