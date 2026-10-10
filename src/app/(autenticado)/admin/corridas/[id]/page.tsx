import { redirect } from 'next/navigation';

/**
 * O detalhe da corrida já existe em `/app/corrida/[id]`, e o serviço permite o
 * acesso do administrador a qualquer corrida. Manter duas telas iguais seria
 * duplicação; o mapa do trajeto (US029) entra naquela, na Sprint 8.
 */
export default async function RedirecionarParaDetalheDaCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/corrida/${id}`);
}
