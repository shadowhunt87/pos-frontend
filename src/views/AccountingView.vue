<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { FINANCE_GROUPS, FINANCE_URL, financeUrl } from '@/utils/finance';
</script>

<template>
  <div>
    <PageHeader title="Contabilidad" subtitle="La contabilidad vive en el sistema financiero. Cada venta, compra, cobro y ajuste del punto de venta ya está allí con su factura, su NCF y su asiento.">
      <template #actions>
        <a :href="FINANCE_URL" target="_blank" rel="noopener" class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
          <ExternalLink class="size-4" aria-hidden="true" />Abrir el sistema contable
        </a>
      </template>
    </PageHeader>

    <p class="mb-6 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-strong">
      Se abre en otra pestaña. Entra con el mismo correo y clave. Los enlaces van a {{ FINANCE_URL }}.
    </p>

    <div class="grid gap-6 lg:grid-cols-2">
      <section v-for="g in FINANCE_GROUPS" :key="g.title" class="card">
        <h2 class="card-title">{{ g.title }}</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="l in g.links" :key="l.path">
            <a :href="financeUrl(l.path)" target="_blank" rel="noopener" class="group flex items-start justify-between gap-3 py-3">
              <span>
                <span class="block font-medium group-hover:text-brand-700">{{ l.label }}</span>
                <span class="text-sm text-ink-500">{{ l.hint }}</span>
              </span>
              <ExternalLink class="mt-1 size-4 shrink-0 text-ink-400 group-hover:text-brand-700" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
