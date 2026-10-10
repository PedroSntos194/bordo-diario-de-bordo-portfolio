'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Download, Hourglass } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { TipoDeExportacao } from '@/modulos/exportacao/exportacao.regras';

/**
 * Botão "Exportar para Excel" (US032 · US031 · T15, T17, T18).
 *
 * O critério de aceitação é que a exportação respeite **exatamente** os filtros
 * aplicados. Por isso os filtros não são passados por propriedade a partir da
 * tela: eles são lidos da URL, que é a mesma fonte que a consulta usou para
 * montar a listagem. Um caminho paralelo divergiria no dia em que alguém
 * acrescentasse um filtro novo e esquecesse de propagá-lo aqui.
 *
 * Dois desfechos de sucesso, e é a US031 que trouxe o segundo: recorte pequeno
 * baixa na hora; recorte grande é admitido como tarefa, e o botão passa a
 * perguntar pela situação até a planilha ficar pronta.
 */
interface Propriedades {
  tipo: TipoDeExportacao;
  /** Parâmetros que este relatório aceita — os demais são descartados. */
  parametrosAceitos: readonly string[];
  /**
   * Filtros que não estão na query string.
   *
   * Existe para as telas cujo recorte vem do **caminho** da URL, não da busca —
   * o resumo do motorista é `/app/resumo/2026-08-23`. Sem isto, ler apenas a
   * query string faria o botão exportar silenciosamente o dia de hoje enquanto
   * a tela mostra outro.
   */
  filtrosFixos?: Record<string, string>;
}

/**
 * Intervalo entre duas perguntas pela situação.
 *
 * Cinco segundos, e não um: a fila é varrida a cada minuto pelo agendador, então
 * perguntar de segundo em segundo produziria sessenta respostas idênticas antes
 * da primeira novidade. O número é uma fração do minuto para o aviso de pronto
 * não parecer preso depois que ela sai.
 */
const INTERVALO_DA_CONSULTA_MS = 5000;

/**
 * Desistência da consulta, em minutos.
 *
 * A tarefa continua sendo processada — a planilha vai aparecer na tela de
 * arquivos de qualquer jeito, e a notificação avisa. O que acaba aqui é só a
 * pergunta: uma aba esquecida aberta a noite toda não deve continuar batendo no
 * servidor.
 */
const MINUTOS_ATE_PARAR_DE_PERGUNTAR = 15;

interface PlanilhaPronta {
  nome: string;
  url: string;
  linhas: number;
}

export function BotaoExportar({ tipo, parametrosAceitos, filtrosFixos }: Propriedades) {
  const parametros = useSearchParams();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tarefaId, setTarefaId] = useState<string | null>(null);
  const [pronta, setPronta] = useState<PlanilhaPronta | null>(null);

  // A consulta em curso precisa parar quando o componente sai da tela: sem
  // isto, trocar de página deixaria o temporizador rodando contra um estado que
  // não existe mais.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!tarefaId) return;

    let ativo = true;
    const desistirEm = Date.now() + MINUTOS_ATE_PARAR_DE_PERGUNTAR * 60_000;

    async function perguntar(): Promise<void> {
      try {
        const resposta = await fetch(`/api/exportacoes/${tarefaId}`);
        if (!resposta.ok) return;

        const situacao = await resposta.json();
        if (!ativo) return;

        if (situacao.status === 'CONCLUIDA' && situacao.url) {
          setPronta({
            nome: situacao.nome,
            url: situacao.url,
            linhas: situacao.linhasGeradas ?? situacao.linhasPrevistas,
          });
          setAviso(null);
          setTarefaId(null);
          return;
        }

        if (situacao.status === 'FALHA') {
          setErro(situacao.erro ?? 'A planilha não pôde ser gerada.');
          setAviso(null);
          setTarefaId(null);
        }
      } catch {
        // Falha de rede numa consulta de acompanhamento não é motivo para
        // alarmar: a tarefa segue do lado do servidor, e a próxima passagem
        // pergunta de novo.
      }
    }

    const temporizador = setInterval(() => {
      if (Date.now() > desistirEm) {
        clearInterval(temporizador);
        setAviso(
          'A planilha ainda está sendo preparada. Ela vai aparecer na tela de arquivos assim ' +
            'que ficar pronta.',
        );
        setTarefaId(null);
        return;
      }
      void perguntar();
    }, INTERVALO_DA_CONSULTA_MS);

    return () => {
      ativo = false;
      clearInterval(temporizador);
    };
  }, [tarefaId]);

  async function exportar(): Promise<void> {
    setErro(null);
    setAviso(null);
    setPronta(null);
    setGerando(true);

    try {
      const filtros: Record<string, string> = {};
      for (const chave of parametrosAceitos) {
        const valor = parametros.get(chave);
        if (valor) filtros[chave] = valor;
      }
      Object.assign(filtros, filtrosFixos ?? {});

      const resposta = await fetch('/api/exportacoes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, filtros }),
      });

      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo?.erro?.mensagem ?? 'Não foi possível gerar a planilha.');
        return;
      }

      // O desfecho é decidido pelo `modo`, não pelo código HTTP: o campo é o
      // contrato do caso de uso, e o código é a tradução dele para quem consome
      // a API de fora.
      if (corpo.modo === 'segundo-plano') {
        setAviso(corpo.aviso);
        setTarefaId(corpo.tarefaId);
        return;
      }

      // Navegação direta em vez de âncora com `blob:`: a resposta do download
      // vem com `Content-Disposition: attachment`, então o navegador baixa o
      // arquivo sem trocar de página — e sem esbarrar na CSP, que não libera
      // `blob:` para navegação.
      window.location.href = corpo.url;
    } catch {
      setErro('Falha de rede ao gerar a planilha. Verifique a conexão e tente de novo.');
    } finally {
      if (montado.current) setGerando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Botao
        type="button"
        variante="secundaria"
        tamanho="compacto"
        onClick={exportar}
        carregando={gerando}
        rotuloCarregando="Gerando planilha…"
        disabled={tarefaId !== null}
      >
        <Download aria-hidden className="size-4" />
        Exportar para Excel
      </Botao>

      {aviso ? (
        <p
          // `polite` e não `assertive`: o aviso chega em resposta a um clique
          // do próprio usuário, e interromper a leitura de tela no meio de
          // outra coisa seria pior do que esperar a pausa.
          aria-live="polite"
          className="border-borda bg-superficie text-texto-suave flex max-w-md items-start gap-2 rounded-[--radius-padrao] border p-3 text-sm"
        >
          <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{aviso}</span>
        </p>
      ) : null}

      {pronta ? (
        <a
          href={pronta.url}
          aria-live="polite"
          className="border-primaria bg-primaria-suave text-texto flex max-w-md items-center gap-2 rounded-[--radius-padrao] border px-3 py-2 text-sm font-medium"
        >
          <Download aria-hidden className="size-4 shrink-0" />
          Baixar {pronta.nome} · {pronta.linhas.toLocaleString('pt-BR')} registros
        </a>
      ) : null}

      {erro ? <MensagemErro mensagem={erro} /> : null}
    </div>
  );
}
