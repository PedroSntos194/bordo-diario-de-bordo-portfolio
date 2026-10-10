import type { Metadata } from 'next';
import Link from 'next/link';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { PainelDeRetencao } from '@/modulos/retencao/componentes/painel-de-retencao';
import { previa } from '@/modulos/retencao/retencao.servico';

export const metadata: Metadata = { title: 'Retenção de dados' };

/**
 * Retenção e descarte (US044 · RNF007 · RN029).
 *
 * A tela cumpre duas funções que a LGPD cobra em momentos diferentes: **definir**
 * por quanto tempo cada dado fica guardado, e **provar** que a política foi
 * aplicada. A prova vem da trilha de auditoria — cada execução do expurgo grava
 * um registro com os prazos usados, as datas de corte e quanto saiu.
 */
export default async function PaginaRetencao() {
  const resultado = await previa();

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Retenção de dados</h1>
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Retenção de dados</h1>
        <p className="text-texto-suave text-sm">
          Por quanto tempo cada tipo de dado fica guardado, e o descarte do que já venceu (RNF007).
        </p>
      </div>

      <PainelDeRetencao previa={resultado.dados} />

      <section className="border-borda flex flex-col gap-2 rounded-[--radius-padrao] border border-dashed p-4">
        <h2 className="text-texto text-sm font-semibold">O que o sistema não apaga sozinho</h2>
        <p className="text-texto-suave text-sm">
          A <strong>trilha de auditoria</strong> tem prazo de cinco anos, mas fica fora do alcance
          desta tela de propósito: ela é imutável por regra (RN027), e o próprio sistema não tem
          permissão para apagá-la. Dar a ele esse poder para cumprir um prazo que só vence daqui a
          anos destruiria hoje a proteção que a regra existe para dar. O expurgo da trilha é
          procedimento de manutenção, com acesso privilegiado ao banco, descrito no runbook de
          implantação.
        </p>
        <p className="text-texto-suave text-sm">
          Jornadas, corridas e ocorrências também não vencem por esta rotina: são o diário de bordo
          em si, com prazo de cinco anos, e o que existe hoje tem meses de idade.
        </p>
        <Link href="/admin/auditoria?entidade=retencao" className="text-primaria text-sm underline">
          Ver o histórico das execuções na trilha
        </Link>
      </section>
    </div>
  );
}
