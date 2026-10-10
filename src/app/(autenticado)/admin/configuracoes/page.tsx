import type { Metadata } from 'next';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioConfiguracoes } from '@/modulos/configuracao/componentes/formulario-configuracoes';
import { listar } from '@/modulos/configuracao/configuracao.servico';

export const metadata: Metadata = { title: 'Configurações' };

/**
 * Parâmetros do sistema (US042 · RF040).
 *
 * O horário do consolidado é o único cuja alteração **não** vale na hora: o
 * agendador o lê uma vez, ao registrar o cron (AD-9). Os demais são consultados
 * no momento do uso e passam a valer imediatamente.
 */
const CHAVES_QUE_EXIGEM_REINICIO = ['horario_consolidado', 'horario_alerta_pendencia'];

export default async function PaginaConfiguracoes() {
  const resultado = await listar();

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Configurações</h1>
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Configurações</h1>
        <p className="text-texto-suave text-sm">
          Prazos e horários que o sistema usa. Toda alteração fica registrada na auditoria.
        </p>
      </div>

      <FormularioConfiguracoes
        parametros={resultado.dados}
        chavesQueExigemReinicio={CHAVES_QUE_EXIGEM_REINICIO}
      />
    </div>
  );
}
