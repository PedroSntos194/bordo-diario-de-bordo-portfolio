import type { SituacaoDoMotorista } from './acompanhamento.regras';
import { horaNoFusoOperacao } from '@/utilitarios/data';

export interface PendenciaDeConferencia {
  motoristaId: string;
  nome: string;
  tipo:
    'ACESSO' | 'PRIMEIRA_UTILIZACAO' | 'SEM_REGISTRO' | 'JORNADA_ANTERIOR' | 'CONFERIR_FECHAMENTO';
  mensagem: string;
}

/** Um dia aberto às 20h30 exige conferir se o trabalho terminou, não fechar automaticamente. */
export function conferirImplantacao(motoristas: SituacaoDoMotorista[], agora: Date) {
  const { hora, minuto } = horaNoFusoOperacao(agora);
  const conferirFimDoDia = hora > 20 || (hora === 20 && minuto >= 30);
  const pendencias: PendenciaDeConferencia[] = [];
  for (const motorista of motoristas) {
    const adicionar = (tipo: PendenciaDeConferencia['tipo'], mensagem: string) =>
      pendencias.push({ motoristaId: motorista.id, nome: motorista.nome, tipo, mensagem });
    if (motorista.contaAtiva) {
      if (motorista.acesso !== 'PRONTO') adicionar('ACESSO', motorista.proximoPasso);
      else if (!motorista.adocaoConcluida)
        adicionar(
          'PRIMEIRA_UTILIZACAO',
          'Acompanhar as etapas da primeira utilização que ainda não têm registro.',
        );
      if (motorista.escalado && motorista.operacao === 'AGUARDANDO_INICIAR')
        adicionar(
          'SEM_REGISTRO',
          'Confirmar se trabalhou e conferir registros pendentes de envio no celular.',
        );
    }
    // O fechamento de registros existentes também precisa ser conferido para contas desativadas.
    if (motorista.jornadaAnteriorAberta)
      adicionar(
        'JORNADA_ANTERIOR',
        `Conferir a jornada ainda aberta de ${motorista.jornadaAnteriorAberta.data}.`,
      );
    if (conferirFimDoDia && ['DIA_INICIADO', 'CORRIDA_EM_ANDAMENTO'].includes(motorista.operacao))
      adicionar(
        'CONFERIR_FECHAMENTO',
        'Confirmar se o trabalho terminou; conferir o encerramento das corridas e do dia e o envio dos registros.',
      );
  }
  return pendencias;
}

/** Ignora horário da consulta e ordem da lista; mudanças na operação e nas pendências contam. */
export function assinaturaDaConferencia(entrada: {
  data: string;
  disponivel: boolean;
  motoristas: SituacaoDoMotorista[];
  pendencias: PendenciaDeConferencia[];
}): string {
  return JSON.stringify({
    data: entrada.data,
    disponivel: entrada.disponivel,
    motoristas: entrada.motoristas
      .map((motorista) => ({
        id: motorista.id,
        acesso: motorista.acesso,
        operacao: motorista.operacao,
        corridas: motorista.corridasConcluidasNoDia,
        adocao: motorista.adocao
          .filter((etapa) => etapa.concluida)
          .map((etapa) => etapa.chave)
          .sort(),
        anterior: motorista.jornadaAnteriorAberta?.id ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pendencias: entrada.pendencias.map(({ motoristaId, tipo }) => `${motoristaId}:${tipo}`).sort(),
  });
}
