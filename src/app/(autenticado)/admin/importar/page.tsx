import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, CircleSlash, FileSpreadsheet } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { FormularioImportacao } from '@/modulos/importacao/componentes/formulario-importacao';
import { listar } from '@/modulos/importacao/importacao.servico';
import { MODELOS } from '@/modulos/importacao/importacao.regras';
import { formatarDataHora } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Importar cadastros' };

/**
 * Importação de cadastros por planilha (US015 · RF035).
 *
 * O histórico embaixo do formulário não é enfeite: importação é a operação que
 * mais gera a pergunta "isso já foi feito?" — sessenta usuários criados de uma
 * vez são invisíveis na listagem de usuários, que fica igual a qualquer outro
 * dia com sessenta linhas. Aqui fica registrado quem carregou o quê, quando, e
 * quantas linhas entraram (RF036 · RN030).
 */
export default async function PaginaImportar() {
  const historico = await listar({ tamanho: 10 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Importar cadastros</h1>
        <p className="text-texto-suave text-sm">
          Usuários, veículos ou rotas em lote, a partir de uma planilha.
        </p>
      </div>

      <FormularioImportacao />

      <section className="flex flex-col gap-2">
        <h2 className="text-texto text-lg font-semibold">Importações anteriores</h2>

        {!historico.sucesso || historico.dados.dados.length === 0 ? (
          <EstadoVazio
            motivo="sem-dados"
            titulo="Nenhuma importação registrada"
            descricao="Assim que você importar uma planilha, o registro aparece aqui com autor, data e quantidade de linhas."
          />
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {historico.dados.dados.map((importacao) => (
              <li key={importacao.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                {importacao.status === 'CONCLUIDA' ? (
                  <CheckCircle2 aria-hidden className="text-sucesso size-4 shrink-0" />
                ) : importacao.status === 'PROCESSANDO' ? (
                  <FileSpreadsheet aria-hidden className="text-texto-suave size-4 shrink-0" />
                ) : (
                  <CircleSlash aria-hidden className="text-erro size-4 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-texto truncate text-sm font-medium">
                    {MODELOS[importacao.tipoDestino].rotulo} · {importacao.arquivo.nomeOriginal}
                  </p>
                  <p className="text-texto-suave text-xs">
                    {formatarDataHora(importacao.criadoEm)} · {importacao.autor.nome} ·{' '}
                    {importacao.linhasOk} de {importacao.linhasTotal} importadas
                    {importacao.linhasErro > 0 ? ` · ${importacao.linhasErro} recusadas` : ''}
                  </p>
                </div>

                <Etiqueta tom={TOM_DO_STATUS[importacao.status]}>
                  {ROTULO_DO_STATUS[importacao.status]}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}

        <p className="text-texto-suave text-xs">
          Os arquivos enviados e os relatórios ficam em{' '}
          <Link href="/admin/arquivos" className="text-primaria underline">
            Arquivos
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

const ROTULO_DO_STATUS = {
  PROCESSANDO: 'Não confirmada',
  CONCLUIDA: 'Concluída',
  REJEITADA: 'Nada importado',
  FALHA: 'Falha',
} as const;

const TOM_DO_STATUS = {
  PROCESSANDO: 'neutro',
  CONCLUIDA: 'sucesso',
  REJEITADA: 'atencao',
  FALHA: 'erro',
} as const;
