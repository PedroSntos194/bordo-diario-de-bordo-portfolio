import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { CodigoErro } from '@/lib/erros';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioRota } from '@/modulos/rota/componentes/formulario-rota';
import { EditorDePontos } from '@/modulos/rota/componentes/editor-pontos';
import { obter } from '@/modulos/rota/rota.servico';
import { HistoricoDoRegistro } from '@/modulos/auditoria/componentes/historico-do-registro';

export const metadata: Metadata = { title: 'Editar rota' };

/** T24 — Edição de rota e pontos de parada (doc 10 · US012, US013). */
export default async function PaginaEditarRota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await obter({ id });

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const rota = resultado.dados;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/rotas" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para rotas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-texto text-2xl font-semibold">{rota.nome}</h1>
          <Etiqueta tom={rota.status === 'ATIVA' ? 'sucesso' : 'neutro'}>
            {rota.status === 'ATIVA' ? 'Ativa' : 'Inativa'}
          </Etiqueta>
        </div>
      </div>

      <FormularioRota
        valoresIniciais={{
          id: rota.id,
          codigo: rota.codigo,
          nome: rota.nome,
          origem: rota.origem,
          destino: rota.destino,
          turno: rota.turno,
          // `Decimal` do Prisma não atravessa a fronteira do servidor como
          // número: vira texto aqui e volta a número na validação.
          distanciaEstimadaKm:
            rota.distanciaEstimadaKm === null ? '' : String(rota.distanciaEstimadaKm),
        }}
      />

      <hr className="border-borda" />

      <EditorDePontos
        rotaId={rota.id}
        pontosIniciais={rota.pontos.map((ponto) => ({
          nome: ponto.nome,
          endereco: ponto.endereco ?? '',
          latitude: ponto.latitude === null ? null : Number(ponto.latitude),
          longitude: ponto.longitude === null ? null : Number(ponto.longitude),
        }))}
      />

      <HistoricoDoRegistro entidade="rota" entidadeId={id} />
    </div>
  );
}
