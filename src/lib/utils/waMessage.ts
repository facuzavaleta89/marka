interface WaParams {
  agentPhone: string;
  userName: string;
  propertyTitle: string;
  propertyAddress: string;
}

// Retorna null si el agente no tiene número configurado (evita armar un link roto).
export function generateWaUrl({
  agentPhone,
  userName,
  propertyTitle,
  propertyAddress,
}: WaParams): string | null {
  if (!agentPhone || agentPhone.trim() === "") return null;
  const message = `Hola, mi nombre es ${userName} y me gustaría saber más información sobre ${propertyTitle} ubicado en ${propertyAddress}.`;
  return `https://wa.me/${agentPhone}?text=${encodeURIComponent(message)}`;
}
