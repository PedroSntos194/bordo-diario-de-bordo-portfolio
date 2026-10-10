'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { gerarFechamento } from '@/modulos/fechamento/fechamento.acoes';

interface Gerado {
  motoristas: { id: string; nome: string };
  medicao: { id: string; nome: string };
}

/**
 * Gera as duas planilhas do período escolhido. Cada clique cria arquivos
 * novos — o que já foi enviado ao cliente continua na lista, intacto.
 */
export function GerarFechamento({ inicio, emAndamento }: { inicio: string; emAndamento: boolean }) {
  const router = useRouter();
  const [gerando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<Gerado | null>(null);

  function gerar(): void {
    setErro(null);
    setGerado(null);
    iniciar(async () => {
      const resultado = await gerarFechamento({ inicio });
      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      setGerado(resultado.dados);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro ? <MensagemErro mensagem={erro} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" onClick={gerar} carregando={gerando}>
          <FileSpreadsheet aria-hidden className="size-4" />
          Gerar planilhas
        </Botao>
        <p className="text-texto-suave text-sm">
          {emAndamento
            ? 'O período ainda não terminou: a planilha mostra os números até agora.'
            : 'Pagamento dos motoristas e boletim de medição, no formato que vocês já usam.'}
        </p>
      </div>
      {gerado ? (
        <div
          role="status"
          className="border-sucesso/30 bg-sucesso-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-3 text-sm"
        >
          <p className="text-texto font-medium">Planilhas prontas.</p>
          {[gerado.motoristas, gerado.medicao].map((arquivo) => (
            <a
              key={arquivo.id}
              href={`/api/arquivos/${arquivo.id}/download`}
              className="text-primaria inline-flex items-center gap-1.5 font-medium underline"
            >
              <Download aria-hidden className="size-4" />
              {arquivo.nome}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
