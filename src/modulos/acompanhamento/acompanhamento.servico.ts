import { definirAcao } from '@/lib/acao-segura';
import { consultarMotoristas } from '@/modulos/acompanhamento/acompanhamento.repositorio';
import {
  avaliarSituacaoDoMotorista,
  filtrarSituacoes,
  resumirSituacoes,
  type SituacaoDoMotorista,
} from '@/modulos/acompanhamento/acompanhamento.regras';
import {
  esquemaPainelDeMotoristas,
  type EntradaPainelDeMotoristas,
} from '@/modulos/acompanhamento/acompanhamento.schema';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';
import { dataOperacional } from '@/utilitarios/data';

export interface PainelDeMotoristas {
  data: string;
  consultadoEm: Date;
  resumo: ReturnType<typeof resumirSituacoes>;
  motoristas: SituacaoDoMotorista[];
}

export const painelDeMotoristas = definirAcao<EntradaPainelDeMotoristas, PainelDeMotoristas>({
  nome: 'acompanhamento.motoristas',
  perfis: ['ADMIN'],
  esquema: esquemaPainelDeMotoristas,
  semTransacao: true,
  executar: async ({ data, busca, atencao }, contexto) => {
    const agora = new Date();
    const dia = data ?? dataOperacional(agora);
    const retratos = await consultarMotoristas(contexto.tx, dia);
    const situacoes = retratos.map((motorista) =>
      avaliarSituacaoDoMotorista(motorista, dia, agora, VERSAO_AVISO_PRIVACIDADE),
    );
    return {
      data: dia,
      consultadoEm: agora,
      resumo: resumirSituacoes(situacoes),
      motoristas: filtrarSituacoes(situacoes, busca, atencao === 'atencao'),
    };
  },
});
