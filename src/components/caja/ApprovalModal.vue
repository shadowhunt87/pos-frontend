<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { errorMessage } from '@/api/errors';
import { requestApproval } from '@/api/pos';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { ApprovalAction } from '@/types/api';
import { APPROVAL_LABEL } from '@/utils/labels';

const props = defineProps<{ action: ApprovalAction | null }>();
const emit = defineEmits<{ approved: [approvalId: string]; close: [] }>();

const email = ref('');
const pin = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

// El correo se recuerda mientras la caja esté abierta (suele autorizar el mismo supervisor); el PIN nunca.
watch(
  () => props.action,
  (a) => {
    if (!a) return;
    pin.value = '';
    error.value = null;
  },
);

async function submit(): Promise<void> {
  const action = props.action;
  if (!action || busy.value || !email.value.trim() || !/^\d{4,6}$/.test(pin.value)) return;
  busy.value = true;
  error.value = null;
  try {
    const r = await requestApproval({ action, supervisorEmail: email.value.trim(), pin: pin.value });
    pin.value = '';
    emit('approved', r.approvalId);
  } catch (e) {
    error.value = errorMessage(e);
    pin.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :open="!!action" title="Autorización de supervisor" @close="emit('close')">
    <form id="approval-form" class="space-y-4" novalidate @submit.prevent="submit">
      <div class="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-strong">
        <ShieldCheck class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>Para {{ action ? APPROVAL_LABEL[action] : 'esta acción' }} hace falta que un supervisor ponga su PIN.</p>
      </div>
      <div>
        <label for="approval-email" class="label">Correo del supervisor</label>
        <input id="approval-email" v-model="email" type="email" class="input" autocomplete="off" required />
      </div>
      <div>
        <label for="approval-pin" class="label">PIN</label>
        <input
          id="approval-pin"
          v-model="pin"
          type="password"
          class="input text-center font-mono text-xl tracking-[0.4em]"
          inputmode="numeric"
          maxlength="6"
          autocomplete="off"
          required
        />
      </div>
      <ErrorAlert :message="error" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="submit" form="approval-form" variant="accent" :loading="busy" :disabled="!email.trim() || !/^\d{4,6}$/.test(pin)">
        Autorizar
      </BaseButton>
    </template>
  </BaseModal>
</template>
