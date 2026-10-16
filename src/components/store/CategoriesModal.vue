<script setup lang="ts">
import { Plus, RotateCcw, X } from 'lucide-vue-next';
import { ref } from 'vue';
import { createCategory, updateCategory } from '@/api/admin';
import { errorMessage } from '@/api/errors';
import BaseButton from '@/components/BaseButton.vue';
import BaseModal from '@/components/BaseModal.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import type { PosCategory } from '@/types/api';

const props = defineProps<{ open: boolean; categories: PosCategory[] }>();
const emit = defineEmits<{ changed: []; close: [] }>();

const name = ref('');
const color = ref('#0f9483');
const busy = ref(false);
const error = ref<string | null>(null);

async function add(): Promise<void> {
  if (!name.value.trim() || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await createCategory({ name: name.value.trim(), color: color.value, sortOrder: props.categories.length });
    name.value = '';
    emit('changed');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function toggle(c: PosCategory): Promise<void> {
  error.value = null;
  try {
    await updateCategory(c.id, { name: c.name, active: !c.active });
    emit('changed');
  } catch (e) {
    error.value = errorMessage(e);
  }
}
</script>

<template>
  <BaseModal :open="open" title="Categorías de la caja" description="Agrupan los productos en la caja (Bebidas, Colmado…)." @close="emit('close')">
    <div class="flex flex-wrap gap-2">
      <span
        v-for="c in categories"
        :key="c.id"
        :class="['inline-flex min-h-9 items-center gap-2 rounded-full border border-line py-1 pr-1.5 pl-3.5 text-sm font-medium', !c.active && 'opacity-50']"
      >
        <span class="size-2.5 rounded-full" :style="{ background: c.color || 'var(--ink-300)' }" aria-hidden="true" />{{ c.name }}
        <button type="button" class="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900" :aria-label="c.active ? `Desactivar ${c.name}` : `Activar ${c.name}`" @click="toggle(c)">
          <component :is="c.active ? X : RotateCcw" class="size-3.5" />
        </button>
      </span>
      <span v-if="!categories.length" class="text-sm text-ink-500">Sin categorías todavía.</span>
    </div>
    <form class="mt-5 flex flex-wrap items-end gap-3" @submit.prevent="add">
      <div class="min-w-48 flex-1">
        <label for="cat-new" class="label">Nueva categoría</label>
        <input id="cat-new" v-model="name" class="input" maxlength="60" />
      </div>
      <div>
        <label for="cat-color" class="label">Color</label>
        <input id="cat-color" v-model="color" type="color" class="h-[46px] w-16 cursor-pointer rounded-lg border border-ink-200 bg-surface p-1" />
      </div>
      <BaseButton type="submit" variant="secondary" size="lg" :icon="Plus" :loading="busy" :disabled="!name.trim()">Agregar</BaseButton>
    </form>
    <div class="mt-3"><ErrorAlert :message="error" /></div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">Listo</BaseButton>
    </template>
  </BaseModal>
</template>
