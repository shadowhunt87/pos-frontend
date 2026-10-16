<script setup lang="ts">
import { ref, watch } from 'vue';
import { setPin } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { useToastStore } from '@/stores/toast';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const toast = useToastStore();

const pin = ref('');
const confirmPin = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    pin.value = '';
    confirmPin.value = '';
    error.value = null;
  },
);

async function save(): Promise<void> {
  if (busy.value) return;
  if (!/^\d{4,6}$/.test(pin.value)) {
    error.value = 'El PIN es de 4 a 6 números.';
    return;
  }
  if (pin.value !== confirmPin.value) {
    error.value = 'Los dos PIN no coinciden.';
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await setPin(pin.value);
    toast.success('PIN guardado', 'Con tu correo y este PIN autorizas en la caja.');
    emit('close');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="Mi PIN de supervisor" @close="emit('close')">
    <form id="pin-form" class="space-y-4" novalidate @submit.prevent="save">
      <p class="text-sm text-ink-500">
        Con tu correo y este PIN autorizas en la caja descuentos grandes, anulaciones, devoluciones, ventas a crédito y salidas de efectivo. Tras 5 intentos
        fallidos se bloquea 5 minutos.
      </p>
      <div>
        <label for="pin-new" class="label">PIN nuevo (4 a 6 números)</label>
        <input id="pin-new" v-model="pin" type="password" inputmode="numeric" maxlength="6" class="input font-mono tracking-[0.3em]" autocomplete="new-password" />
      </div>
      <div>
        <label for="pin-confirm" class="label">Repite el PIN</label>
        <input id="pin-confirm" v-model="confirmPin" type="password" inputmode="numeric" maxlength="6" class="input font-mono tracking-[0.3em]" autocomplete="new-password" />
      </div>
      <ErrorAlert :message="error" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="pin-form" variant="accent" :loading="busy">Guardar PIN</BaseButton>
    </template>
  </BaseModal>
</template>
