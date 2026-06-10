// Traduce los errores de Supabase Auth a mensajes en español para la UI.
// Vive en un util compartido (no en un archivo "use server") para poder
// reutilizarlo desde varias server actions: el registro y el alta de agentes
// por parte del admin de agencia.
export function translateAuthError(message: string): string {
  if (message.includes("already registered")) return "Ya existe una cuenta con ese email";
  if (message.includes("already been registered")) return "Ya existe una cuenta con ese email";
  if (message.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres";
  if (message.includes("Unable to validate")) return "Email inválido";
  return "Error al crear la cuenta. Intentá de nuevo";
}
