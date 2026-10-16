// Pila de modales abiertos: con uno encima de otro (el PIN del supervisor sobre el cobro), Escape cierra solo el de arriba.
const stack: symbol[] = [];

export function pushModal(id: symbol): void {
  if (!stack.includes(id)) stack.push(id);
}

export function popModal(id: symbol): void {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopModal(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}

export function anyModalOpen(): boolean {
  return stack.length > 0;
}
