import { after } from 'next/server';
import { comoResposta } from '@/lib/acao-segura';
import { logger } from '@/lib/logger';
import { exportar } from '@/modulos/exportacao/exportacao.servico';
import { processarExportacoesPendentes } from '@/modulos/exportacao/tarefa.servico';

export const dynamic = 'force-dynamic';
// after() compartilha o tempo da rota, incluindo geração e armazenamento.
export const maxDuration = 300;

/**
 * `POST /api/exportacoes` (doc 16 · RF032 · US032, US031).
 *
 * Dois códigos de sucesso, e a diferença é a do doc 16: **201** quando a
 * planilha já existe e o corpo traz a URL de download, **202** quando o recorte
 * é grande demais para a requisição e foi admitido como tarefa, com `tarefaId`
 * para acompanhar. O cliente decide o que fazer pelo campo `modo`, não pelo
 * código — mas o código precisa estar certo para quem consome a API de fora.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => null);
  const resultado = await exportar(corpo);

  const status = resultado.sucesso && resultado.dados.modo === 'segundo-plano' ? 202 : 201;

  // Admitida para segundo plano: processa **depois de a resposta sair**, em vez
  // de esperar a próxima passagem do agendador. Sem isto, quem pede um ano de
  // corridas esperaria até uma hora por uma planilha que sai em segundos.
  //
  // Não há risco de a mesma tarefa sair duas vezes se o agendador correr junto:
  // a reclamação é um `updateMany` condicionado a `PENDENTE`, e o banco deixa
  // exatamente um passar.
  if (status === 202) {
    after(async () => {
      try {
        await processarExportacoesPendentes();
      } catch (erro) {
        // A tarefa continua pendente e a passagem seguinte a pega. Deixar a
        // exceção subir aqui não ajudaria ninguém: a resposta já foi enviada.
        logger.error('exportacao.apos-resposta.falhou', {
          detalhe: erro instanceof Error ? erro.message : String(erro),
        });
      }
    });
  }

  return comoResposta(resultado, status);
}
