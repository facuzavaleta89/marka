interface WaParams {
  agentPhone: string;
  userName: string;
  propertyTitle: string;
  propertyAddress: string;
}

export function generateWaUrl({
  agentPhone,
  userName,
  propertyTitle,
  propertyAddress,
}: WaParams): string {
  const message = `Hola, mi nombre es ${userName} y me gustaría saber más información sobre ${propertyTitle} ubicado en ${propertyAddress}.`;
  return `https://wa.me/${agentPhone}?text=${encodeURIComponent(message)}`;
}
