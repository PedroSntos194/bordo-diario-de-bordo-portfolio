import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioAbrirJornada } from '@/modulos/jornada/componentes/formulario-abrir-jornada';
import { disponiveis } from '@/modulos/veiculo/veiculo.servico';
import { minhaEscalaDeHoje } from '@/modulos/escala/escala.servico';

export const metadata: Metadata = { title: 'Iniciar meu dia' };

/** T05 — Abrir jornada (doc 10 · US016). */
export default async function PaginaAbrirJornada() {
  const [resultado, escala] = await Promise.all([disponiveis(), minhaEscalaDeHoje()]);

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  /**
   * Pré-seleção pela escala do dia (US014 · RF013).
   *
   * A van escalada pode não estar na lista — ela pode ter ficado presa numa
   * jornada que ninguém encerrou (RN013). Nesse caso o formulário avisa em vez
   * de simplesmente não pré-selecionar, que é o mesmo defeito do menu morto da
   * Sprint 3: a interface faria algo diferente do esperado sem dizer por quê.
   */
  const escalado = escala.sucesso ? escala.dados : null;
  const escaladoDisponivel =
    escalado?.veiculoId !== undefined &&
    escalado.veiculoId !== null &&
    resultado.dados.some((veiculo) => veiculo.id === escalado.veiculoId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Iniciar meu dia</h1>
      </div>

      <FormularioAbrirJornada
        veiculos={resultado.dados}
        veiculoEscaladoId={escaladoDisponivel ? escalado!.veiculoId : null}
        placaEscaladaIndisponivel={escalado?.placa && !escaladoDisponivel ? escalado.placa : null}
      />
    </div>
  );
}
