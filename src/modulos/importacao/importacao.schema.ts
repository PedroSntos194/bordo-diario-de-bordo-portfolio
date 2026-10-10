import { z } from 'zod';
import { esquemaPaginacao } from '@/lib/paginacao';
import { TIPOS_DE_IMPORTACAO } from '@/modulos/importacao/importacao.regras';

/**
 * Contratos de entrada da importação (US015 · RF035).
 *
 * O upload é a única entrada do sistema em que o esquema do formulário e o da
 * ação **não podem ser o mesmo objeto** (regra 4 do projeto): o formulário
 * manipula um `File` do navegador e a ação recebe os bytes já lidos. O que é
 * compartilhado entre as duas pontas são as *regras* — extensão, tamanho e
 * modelo —, que ficam em `importacao.regras.ts` e valem nos dois lados.
 *
 * `conteudo` é validado como `Uint8Array`, e não como `Buffer`: `Buffer` não
 * existe no navegador, e um esquema que quebra ao ser importado por um Client
 * Component é uma armadilha esperando alguém. Todo `Buffer` do Node é um
 * `Uint8Array`, então a checagem é a mesma na prática.
 */

export const esquemaTipoDeImportacao = z.object({
  tipoDestino: z.enum(TIPOS_DE_IMPORTACAO, {
    errorMap: () => ({ message: 'Escolha o que deseja importar.' }),
  }),
});

export type EntradaTipoDeImportacao = z.infer<typeof esquemaTipoDeImportacao>;

export const esquemaAnalisarImportacao = esquemaTipoDeImportacao.extend({
  nomeArquivo: z.string().trim().min(1, 'Selecione um arquivo.').max(240),
  conteudo: z.custom<Buffer>(
    (valor) => valor instanceof Uint8Array && valor.byteLength > 0,
    'Arquivo ausente ou vazio.',
  ),
});

export type EntradaAnalisarImportacao = z.infer<typeof esquemaAnalisarImportacao>;

export const esquemaConfirmarImportacao = z.object({ id: z.string().uuid() });

export type EntradaConfirmarImportacao = z.infer<typeof esquemaConfirmarImportacao>;

export const esquemaListarImportacoes = esquemaPaginacao;

export type EntradaListarImportacoes = z.infer<typeof esquemaListarImportacoes>;
