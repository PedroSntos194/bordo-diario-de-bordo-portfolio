import { definirAcao } from '@/lib/acao-segura';
import { esquemaDia, type EntradaDia } from '@/modulos/relatorio/relatorio.schema';
import { contarPreparacao } from '@/modulos/preparacao/preparacao.repositorio';

export const consultarPreparacao = definirAcao<
  EntradaDia,
  { data: string } & Awaited<ReturnType<typeof contarPreparacao>>
>({
  nome: 'preparacao.consultar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaDia,
  executar: async ({ data }, contexto) => ({
    data,
    ...(await contarPreparacao(contexto.tx, data)),
  }),
});
