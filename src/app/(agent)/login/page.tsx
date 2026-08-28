import { LoginForm } from "./LoginForm";

// Mensajes de aviso que puede mostrar el login, indexados por un CÓDIGO corto.
// El parámetro de la URL trae solo el código; el texto sale de acá, del server.
// ⚠ Nunca renderizar texto que venga de la URL: sería una puerta a inyección de
// contenido (cualquiera podría mandarle a un tercero un /login?… con el mensaje
// que quisiera).
const NOTICES: Record<string, string> = {
  no_agency:
    "Tu cuenta no está asociada a ninguna inmobiliaria. Escribinos si creés que es un error.",
};

// Server Component: lee el motivo de la URL y le pasa el texto ya resuelto al
// formulario (client). Mismo reparto que /register (page server + form client).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : null;
  const notice = reason ? NOTICES[reason] : undefined;

  return <LoginForm notice={notice} />;
}
