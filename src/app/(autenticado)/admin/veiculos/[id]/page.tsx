import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioContrato } from '@/modulos/veiculo/componentes/formulario-contrato';
import { FormularioVeiculo } from '@/modulos/veiculo/componentes/formulario-veiculo';
import { obter, obterContrato } from '@/modulos/veiculo/veiculo.servico';
import { CodigoErro } from '@/lib/erros';
import { formatarPlaca } from '@/utilitarios/placa';
import { HistoricoDoRegistro } from '@/modulos/auditoria/componentes/historico-do-registro';
import { ConsumoDoVeiculo } from '@/modulos/abastecimento/componentes/consumo-do-veiculo';

export const metadata: Metadata = { title: 'Editar veículo' };

/** T22 — Edição de veículo (doc 10 · US011). */
export default async function PaginaEditarVeiculo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [resultado, contrato] = await Promise.all([obter({ id }), obterContrato({ id })]);

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const veiculo = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/veiculos" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para veículos
        </Link>
        <h1 className="text-texto font-mono text-2xl font-semibold">
          {formatarPlaca(veiculo.placa)}
        </h1>
      </div>

      <FormularioVeiculo
        valoresIniciais={{
          id: veiculo.id,
          placa: veiculo.placa,
          modelo: veiculo.modelo,
          marca: veiculo.marca,
          ano: veiculo.ano,
          capacidadePassageiros: veiculo.capacidadePassageiros,
          odometroAtual: veiculo.odometroAtual,
          observacoes: veiculo.observacoes,
        }}
      />

      {contrato.sucesso ? <FormularioContrato contrato={contrato.dados} /> : null}

      <ConsumoDoVeiculo veiculoId={id} />

      <HistoricoDoRegistro entidade="veiculo" entidadeId={id} />
    </div>
  );
}
