import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import { ErroDeValidacao, ehErroDaAplicacao, type ErrosDeCampo } from '@/lib/erros';
import {
  gravarConfiguracao,
  listarConfiguracoes,
  obterValor,
} from '@/modulos/configuracao/configuracao.repositorio';
import {
  CHAVES_EDITAVEIS,
  PARAMETROS,
  definicaoDe,
  formatarDinheiroDoCampo,
  validarOrdemDosHorarios,
  validarParametro,
  type GrupoDeParametro,
  type TipoDeParametro,
} from '@/modulos/configuracao/configuracao.regras';

/**
 * Parâmetros do sistema (US042 · RF040).
 *
 * "Alterações entram em vigor sem reiniciar o sistema" é critério de aceitação,
 * e sai de graça pela decisão tomada lá atrás: os parâmetros vivem em tabela e
 * são lidos **no momento do uso** — `obterValor` é chamado dentro de cada caso
 * de uso, não numa constante carregada na subida.
 *
 * A exceção honesta é o **agendador**: ele lê `horario_consolidado` uma vez, ao
 * registrar o cron. Mudar o horário exige reiniciar aquele processo, e a tela
 * avisa isso em vez de deixar o administrador achar que já valeu.
 */

export interface ParametroDaTela {
  chave: string;
  rotulo: string;
  explicacao: string;
  tipo: TipoDeParametro;
  grupo: GrupoDeParametro;
  unidade: string | null;
  minimo: number | null;
  maximo: number | null;
  /** Já no formato que o campo do formulário espera. */
  valor: string;
  atualizadoEm: Date | null;
}

function paraCampo(tipo: TipoDeParametro, valor: unknown): string {
  if (tipo === 'telefones') return Array.isArray(valor) ? valor.join('\n') : '';
  if (tipo === 'sim-nao') return valor === true ? 'sim' : 'nao';
  if (tipo === 'dinheiro') return typeof valor === 'number' ? formatarDinheiroDoCampo(valor) : '';
  return String(valor ?? '');
}

export const listar = definirAcao<void, ParametroDaTela[]>({
  nome: 'configuracao.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const gravadas = await listarConfiguracoes(contexto.tx);
    const porChave = new Map(gravadas.map((linha) => [linha.chave, linha]));

    // A lista sai de `PARAMETROS`, não do banco: assim um parâmetro novo
    // aparece na tela mesmo antes de existir linha para ele, e um parâmetro que
    // não é editável não vaza para a interface só por estar na tabela.
    return PARAMETROS.map((definicao) => {
      const gravada = porChave.get(definicao.chave);

      return {
        chave: definicao.chave,
        rotulo: definicao.rotulo,
        explicacao: definicao.explicacao,
        tipo: definicao.tipo,
        grupo: definicao.grupo ?? 'operacao',
        unidade: definicao.unidade ?? null,
        minimo: definicao.minimo ?? null,
        maximo: definicao.maximo ?? null,
        valor: paraCampo(definicao.tipo, gravada ? gravada.valor : definicao.padrao),
        atualizadoEm: gravada?.atualizadoEm ?? null,
      };
    });
  },
});

const esquemaSalvar = z.object({
  valores: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
});

type EntradaSalvar = z.infer<typeof esquemaSalvar>;

export const salvar = definirAcao<EntradaSalvar, { alterados: string[] }>({
  nome: 'configuracao.salvar',
  perfis: ['ADMIN'],
  esquema: esquemaSalvar,
  executar: async ({ valores }, contexto) => {
    // Valida **tudo** antes de gravar **qualquer coisa**, acumulando os erros.
    //
    // Parar no primeiro faria o administrador descobrir um problema por vez, a
    // cada tentativa de salvar — com cinco campos, até cinco idas e vindas para
    // consertar o que dava para ver de uma vez.
    const normalizados = new Map<string, number | string | string[] | boolean>();
    const erros: ErrosDeCampo = {};

    for (const [chave, valor] of Object.entries(valores)) {
      if (!CHAVES_EDITAVEIS.includes(chave)) continue;

      try {
        normalizados.set(chave, validarParametro(chave, valor));
      } catch (erro) {
        if (!ehErroDaAplicacao(erro)) throw erro;
        Object.assign(erros, erro.campos ?? { [chave]: erro.message });
      }
    }

    if (Object.keys(erros).length > 0) {
      throw new ErroDeValidacao(erros, 'Corrija os campos destacados.');
    }

    // Regra que cruza dois parâmetros. Usa o valor que está sendo salvo e, para
    // o que não veio no formulário, o que já está no banco.
    const alerta = String(
      normalizados.get('horario_alerta_pendencia') ??
        (await obterValor(contexto.tx, 'horario_alerta_pendencia', '20:00')),
    );
    const consolidado = String(
      normalizados.get('horario_consolidado') ??
        (await obterValor(contexto.tx, 'horario_consolidado', '23:00')),
    );
    // Esta ainda para sozinha: é uma única regra, sobre um par de campos.
    validarOrdemDosHorarios(alerta, consolidado);

    const alterados: string[] = [];

    for (const [chave, valor] of normalizados) {
      // Sem linha gravada, o "anterior" é o padrão que a tela mostrava: salvar o
      // formulário sem tocar num parâmetro novo não deve gravar nem auditar nada.
      const anterior = await obterValor<unknown>(
        contexto.tx,
        chave,
        definicaoDe(chave)?.padrao ?? null,
      );

      // Nada mudou: não grava e não audita. Trilha cheia de "alterou de 12 para
      // 12" é ruído que atrapalha quem investiga de verdade (RN026).
      if (JSON.stringify(anterior) === JSON.stringify(valor)) continue;

      await gravarConfiguracao(
        contexto.tx,
        chave,
        valor,
        definicaoDe(chave)?.explicacao ?? chave,
        contexto.usuario.id,
      );

      contexto.auditar({
        acao: 'ATUALIZAR',
        entidade: 'configuracao',
        entidadeId: chave,
        valorAnterior: { valor: anterior },
        valorNovo: { valor },
      });

      alterados.push(chave);
    }

    return { alterados };
  },
});
