'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Download, FileUp, TriangleAlert, Upload } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { confirmarImportacao } from '@/modulos/importacao/importacao.acoes';
import {
  EXTENSOES_ACEITAS,
  MODELOS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_DE_IMPORTACAO,
  validarArquivo,
  type TipoDeImportacao,
} from '@/modulos/importacao/importacao.regras';
import type { PreviaDaImportacao } from '@/modulos/importacao/importacao.servico';
import type { ResultadoDaImportacao } from '@/modulos/importacao/importacao.servico';
import { ehErroDaAplicacao, type RespostaDeErro } from '@/lib/erros';

/**
 * Importação por planilha, em três passos visíveis (US015 · RF035).
 *
 *   escolher o tipo → analisar o arquivo → confirmar a gravação
 *
 * A prévia entre a análise e a gravação é o ponto da tela. Sem ela, o
 * administrador descobriria os oito CPFs errados **depois** de já ter criado os
 * outros cinquenta e dois — e não teria como saber quais dos sessenta entraram.
 *
 * As mesmas regras de extensão e tamanho de `importacao.regras.ts` rodam aqui,
 * antes do envio: subir 5 MB por uma rede de escritório para receber um 413 é
 * um minuto perdido que a verificação local economiza. Quem decide de verdade
 * continua sendo o servidor.
 */
export function FormularioImportacao() {
  const router = useRouter();
  const [confirmando, iniciarConfirmacao] = useTransition();
  const campoArquivo = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<TipoDeImportacao>('USUARIO');
  const [analisando, setAnalisando] = useState(false);
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [concluida, setConcluida] = useState<ResultadoDaImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function reiniciar(): void {
    setPrevia(null);
    setConcluida(null);
    setErro(null);
    if (campoArquivo.current) campoArquivo.current.value = '';
  }

  async function analisar(arquivo: File): Promise<void> {
    setErro(null);
    setPrevia(null);
    setConcluida(null);

    try {
      validarArquivo({ nome: arquivo.name, tamanhoBytes: arquivo.size });
    } catch (falha) {
      setErro(ehErroDaAplicacao(falha) ? falha.message : 'Arquivo não aceito.');
      return;
    }

    const corpo = new FormData();
    corpo.set('arquivo', arquivo);
    corpo.set('tipoDestino', tipo);

    setAnalisando(true);
    try {
      const resposta = await fetch('/api/importacoes', { method: 'POST', body: corpo });
      const dados: unknown = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        const falha = dados as RespostaDeErro | null;
        setErro(falha?.erro?.mensagem ?? 'Não foi possível ler a planilha.');
        return;
      }

      setPrevia(dados as PreviaDaImportacao);
    } catch {
      // Rede caindo no meio de um upload é o caso comum aqui, não uma falha
      // do sistema. A mensagem diz o que fazer em vez de exibir um código.
      setErro('Não foi possível enviar o arquivo. Verifique a conexão e tente de novo.');
    } finally {
      setAnalisando(false);
    }
  }

  function confirmar(): void {
    if (!previa) return;
    setErro(null);

    iniciarConfirmacao(async () => {
      const resultado = await confirmarImportacao({ id: previa.importacaoId });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setConcluida(resultado.dados);
      setPrevia(null);
      if (campoArquivo.current) campoArquivo.current.value = '';
      router.refresh();
    });
  }

  const modelo = MODELOS[tipo];
  const ocupado = analisando || confirmando;

  return (
    <div className="flex flex-col gap-5">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-texto mb-2 text-sm font-medium">O que você quer importar?</legend>

        <div className="flex flex-wrap gap-2">
          {TIPOS_DE_IMPORTACAO.map((opcao) => (
            <label
              key={opcao}
              className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-4 ${
                tipo === opcao ? 'border-primaria bg-primaria-suave' : 'border-borda'
              }`}
            >
              <input
                type="radio"
                name="tipoDestino"
                value={opcao}
                checked={tipo === opcao}
                onChange={() => {
                  setTipo(opcao);
                  reiniciar();
                }}
                disabled={ocupado}
                className="size-4"
              />
              <span className="text-texto text-sm font-medium">{MODELOS[opcao].rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <div>
          <h2 className="text-texto text-sm font-semibold">1 · Baixe o modelo</h2>
          <p className="text-texto-suave text-xs">
            {modelo.colunas.length} colunas, uma linha de exemplo e uma aba de instruções. O arquivo
            é reconhecido pelo cabeçalho — planilha fora do modelo é recusada inteira, sem gravar
            nada.
          </p>
        </div>

        <a
          href={`/api/importacoes/modelo?tipoDestino=${tipo}`}
          className="border-borda text-texto hover:bg-superficie inline-flex min-h-[--spacing-toque] w-fit items-center gap-2 rounded-[--radius-padrao] border px-4 text-sm font-medium"
        >
          <Download aria-hidden className="size-4" />
          Modelo de {modelo.rotulo.toLowerCase()}
        </a>
      </div>

      <div className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <div>
          <h2 className="text-texto text-sm font-semibold">2 · Envie o arquivo preenchido</h2>
          <p className="text-texto-suave text-xs">
            {EXTENSOES_ACEITAS.join(' ou ')}, até {TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB. Nada é
            gravado agora: você vê o que vai entrar antes de confirmar.
          </p>
        </div>

        <input
          ref={campoArquivo}
          type="file"
          accept={EXTENSOES_ACEITAS.join(',')}
          disabled={ocupado}
          onChange={(evento) => {
            const arquivo = evento.target.files?.[0];
            if (arquivo) void analisar(arquivo);
          }}
          className="text-texto file:border-borda file:bg-superficie file:text-texto block w-full text-sm file:mr-3 file:min-h-10 file:rounded-[--radius-padrao] file:border file:px-4 file:text-sm file:font-medium"
        />

        {analisando ? (
          <p role="status" className="text-texto-suave text-sm">
            Lendo a planilha…
          </p>
        ) : null}
      </div>

      {previa ? (
        <section className="border-primaria/30 bg-primaria-suave/40 flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
          <div className="flex items-center gap-2">
            <FileUp aria-hidden className="text-primaria size-5 shrink-0" />
            <h2 className="text-texto text-sm font-semibold">
              3 · Confira antes de gravar — {previa.nomeArquivo}
            </h2>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-texto-suave text-xs">Linhas lidas</dt>
              <dd className="text-texto text-lg font-semibold">{previa.linhasTotal}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Entram</dt>
              <dd className="text-sucesso text-lg font-semibold">{previa.linhasOk}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Com problema</dt>
              <dd
                className={`text-lg font-semibold ${previa.linhasErro > 0 ? 'text-erro' : 'text-texto'}`}
              >
                {previa.linhasErro}
              </dd>
            </div>
          </dl>

          {previa.exemplosIgnorados > 0 ? (
            <p className="text-texto-suave flex items-start gap-2 text-xs">
              <TriangleAlert aria-hidden className="text-atencao mt-0.5 size-4 shrink-0" />
              {previa.exemplosIgnorados === 1
                ? 'A linha de exemplo do modelo foi reconhecida e ignorada.'
                : `${previa.exemplosIgnorados} linhas de exemplo do modelo foram reconhecidas e ignoradas.`}
            </p>
          ) : null}

          {previa.erros.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-texto text-sm font-medium">Linhas que não vão entrar</h3>

              <div className="border-borda max-h-72 overflow-auto rounded-[--radius-padrao] border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-superficie sticky top-0">
                    <tr>
                      <th scope="col" className="text-texto-suave px-3 py-2 text-xs font-semibold">
                        Linha
                      </th>
                      <th scope="col" className="text-texto-suave px-3 py-2 text-xs font-semibold">
                        Coluna
                      </th>
                      <th scope="col" className="text-texto-suave px-3 py-2 text-xs font-semibold">
                        Valor
                      </th>
                      <th scope="col" className="text-texto-suave px-3 py-2 text-xs font-semibold">
                        Motivo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-borda divide-y">
                    {previa.erros.map((linha) => (
                      <tr key={`${linha.linha}-${linha.coluna}`}>
                        <td className="text-texto px-3 py-2 font-mono text-xs">{linha.linha}</td>
                        <td className="text-texto px-3 py-2 text-xs">{linha.coluna}</td>
                        <td className="text-texto-suave px-3 py-2 text-xs">{linha.valor || '—'}</td>
                        <td className="text-texto px-3 py-2 text-xs">{linha.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previa.errosOmitidos > 0 ? (
                <p className="text-texto-suave text-xs">
                  E mais {previa.errosOmitidos}. A lista completa vem no relatório, depois de
                  confirmar.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Botao
              type="button"
              onClick={confirmar}
              carregando={confirmando}
              rotuloCarregando="Importando…"
              disabled={previa.linhasOk === 0}
            >
              <Upload aria-hidden className="size-4" />
              {previa.linhasOk === 0
                ? 'Nenhuma linha válida para importar'
                : `Importar ${previa.linhasOk} ${previa.linhasOk === 1 ? 'linha' : 'linhas'}`}
            </Botao>

            <Botao type="button" variante="secundaria" onClick={reiniciar} disabled={confirmando}>
              Cancelar
            </Botao>
          </div>
        </section>
      ) : null}

      {concluida ? (
        <section className="border-sucesso/30 bg-sucesso-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-4">
          <h2 className="text-texto text-sm font-semibold">Importação concluída</h2>
          <p className="text-texto text-sm">
            {concluida.importados}{' '}
            {concluida.importados === 1 ? 'registro criado' : 'registros criados'}
            {concluida.recusados > 0 ? ` · ${concluida.recusados} recusado(s)` : ''}.
          </p>

          {concluida.contemSenhas ? (
            <p className="text-texto-suave text-xs">
              O relatório traz a <strong>senha temporária</strong> de cada usuário criado — é assim
              que você entrega os acessos. Ele expira em poucos dias e some do histórico; baixe
              agora. Cada pessoa troca a senha no primeiro acesso.
            </p>
          ) : null}

          <a
            href={concluida.url}
            className="border-borda text-texto hover:bg-superficie inline-flex min-h-[--spacing-toque] w-fit items-center gap-2 rounded-[--radius-padrao] border px-4 text-sm font-medium"
          >
            <Download aria-hidden className="size-4" />
            Baixar relatório
          </a>
        </section>
      ) : null}
    </div>
  );
}
