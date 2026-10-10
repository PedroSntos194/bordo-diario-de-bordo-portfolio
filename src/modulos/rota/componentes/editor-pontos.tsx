'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { SeletorCoordenada } from '@/componentes/mapa/seletor-coordenada';
import { salvarPontosDaRota } from '@/modulos/rota/rota.acoes';
import { interpretarNumero } from '@/utilitarios/numero';

/**
 * Editor de pontos de parada (T24 · US013 · RF012).
 *
 * A ordem dos pontos é a ordem do array, e é ela que o motorista vê na tela da
 * corrida. Por isso reordenar é uma ação de primeira classe aqui, com botões
 * explícitos em vez de arrastar: arrastar não funciona com teclado nem com
 * leitor de tela, e não é confiável em tela de toque pequena (RNF022).
 */

export interface PontoEditavel {
  nome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
}

interface Propriedades {
  rotaId: string;
  pontosIniciais: PontoEditavel[];
}

interface Sugestao {
  nome: string;
  latitude: number;
  longitude: number;
}

export function EditorDePontos({ rotaId, pontosIniciais }: Propriedades) {
  const [pontos, setPontos] = useState<PontoEditavel[]>(pontosIniciais);
  const [selecionado, setSelecionado] = useState<number | null>(
    pontosIniciais.length > 0 ? 0 : null,
  );

  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [buscando, iniciarBusca] = useTransition();
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);

  const [salvando, iniciarSalvamento] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const ponto = selecionado !== null ? pontos[selecionado] : undefined;

  function alterarPonto(indice: number, alteracao: Partial<PontoEditavel>): void {
    setSalvo(false);
    setPontos((atuais) =>
      atuais.map((item, posicao) => (posicao === indice ? { ...item, ...alteracao } : item)),
    );
  }

  function adicionar(): void {
    setSalvo(false);
    setPontos((atuais) => [...atuais, { nome: '', endereco: '', latitude: null, longitude: null }]);
    setSelecionado(pontos.length);
  }

  function remover(indice: number): void {
    setSalvo(false);
    setPontos((atuais) => atuais.filter((_, posicao) => posicao !== indice));
    setSelecionado((atual) => {
      if (atual === null) return null;
      if (atual === indice) return null;
      return atual > indice ? atual - 1 : atual;
    });
  }

  function mover(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    if (destino < 0 || destino >= pontos.length) return;

    setSalvo(false);
    setPontos((atuais) => {
      const copia = [...atuais];
      const [removido] = copia.splice(indice, 1);
      if (removido) copia.splice(destino, 0, removido);
      return copia;
    });
    setSelecionado(destino);
  }

  function buscarEndereco(): void {
    if (termoBusca.trim().length < 3) return;
    setAvisoBusca(null);
    setSugestoes([]);

    iniciarBusca(async () => {
      try {
        const resposta = await fetch(
          `/api/geocodificacao?endereco=${encodeURIComponent(termoBusca)}`,
        );
        if (!resposta.ok) {
          setAvisoBusca('Busca indisponível no momento. Marque o ponto no mapa.');
          return;
        }

        const dados = (await resposta.json()) as { locais: Sugestao[] };
        setSugestoes(dados.locais);
        if (dados.locais.length === 0) {
          setAvisoBusca('Nenhum endereço encontrado. Tente outro termo ou marque no mapa.');
        }
      } catch {
        // Falha na busca não bloqueia o cadastro (RNF015).
        setAvisoBusca('Busca indisponível no momento. Marque o ponto no mapa.');
      }
    });
  }

  function usarSugestao(sugestao: Sugestao): void {
    if (selecionado === null) return;
    alterarPonto(selecionado, {
      endereco: sugestao.nome,
      latitude: sugestao.latitude,
      longitude: sugestao.longitude,
    });
    setSugestoes([]);
    setTermoBusca('');
  }

  function salvar(): void {
    setErro(null);

    const semNome = pontos.findIndex((item) => item.nome.trim().length < 2);
    if (semNome >= 0) {
      setErro(`Informe o nome do ponto ${semNome + 1}.`);
      setSelecionado(semNome);
      return;
    }

    iniciarSalvamento(async () => {
      const resultado = await salvarPontosDaRota({
        rotaId,
        pontos: pontos.map((item) => ({
          nome: item.nome,
          endereco: item.endereco,
          latitude: item.latitude,
          longitude: item.longitude,
        })),
      });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-texto text-lg font-semibold">Pontos de parada</h2>
          <p className="text-texto-suave text-sm">
            Na ordem em que o motorista vai percorrer. Rota sem pontos também é válida.
          </p>
        </div>
        <Botao type="button" variante="secundaria" tamanho="compacto" onClick={adicionar}>
          <Plus aria-hidden className="size-4" />
          Adicionar ponto
        </Botao>
      </div>

      {erro ? <MensagemErro mensagem={erro} /> : null}

      {pontos.length === 0 ? (
        <p className="border-borda text-texto-suave rounded-[--radius-padrao] border border-dashed p-6 text-center text-sm">
          Nenhum ponto de parada. A corrida nesta rota será registrada apenas com início e fim.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {pontos.map((item, indice) => (
            <li
              key={indice}
              className={`flex items-center gap-2 rounded-[--radius-padrao] border p-2 ${
                selecionado === indice ? 'border-primaria bg-primaria-suave' : 'border-borda'
              }`}
            >
              <span className="bg-superficie text-texto-suave flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {indice + 1}
              </span>

              <button
                type="button"
                onClick={() => setSelecionado(indice)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="text-texto block truncate text-sm font-medium">
                  {item.nome || 'Ponto sem nome'}
                </span>
                <span className="text-texto-suave block truncate text-xs">
                  {item.latitude !== null && item.longitude !== null ? (
                    <>
                      <MapPin aria-hidden className="mr-1 inline size-3" />
                      {item.endereco || 'Coordenada definida'}
                    </>
                  ) : (
                    'Sem coordenada'
                  )}
                </span>
              </button>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0}
                  aria-label={`Mover ponto ${indice + 1} para cima`}
                  className="text-texto-suave hover:bg-superficie flex size-8 items-center justify-center rounded disabled:opacity-30"
                >
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === pontos.length - 1}
                  aria-label={`Mover ponto ${indice + 1} para baixo`}
                  className="text-texto-suave hover:bg-superficie flex size-8 items-center justify-center rounded disabled:opacity-30"
                >
                  <ArrowDown aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remover(indice)}
                  aria-label={`Remover ponto ${indice + 1}`}
                  className="text-erro hover:bg-erro-suave flex size-8 items-center justify-center rounded"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {ponto && selecionado !== null ? (
        <div className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
          <h3 className="text-texto text-sm font-semibold">Ponto {selecionado + 1}</h3>

          <CampoTexto
            rotulo="Nome do ponto"
            value={ponto.nome}
            onChange={(evento) => alterarPonto(selecionado, { nome: evento.target.value })}
            required
            maxLength={120}
            placeholder="Terminal Centro"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="busca-endereco" className="text-texto text-sm font-medium">
              Buscar endereço
            </label>
            <div className="flex gap-2">
              <input
                id="busca-endereco"
                type="search"
                value={termoBusca}
                onChange={(evento) => setTermoBusca(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    // Sem isto, Enter enviaria o formulário da rota.
                    evento.preventDefault();
                    buscarEndereco();
                  }
                }}
                placeholder="Av. Central, 100"
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] flex-1 rounded-[--radius-padrao] border px-3 text-base"
              />
              <Botao
                type="button"
                variante="secundaria"
                onClick={buscarEndereco}
                carregando={buscando}
                rotuloCarregando="Buscando…"
                disabled={termoBusca.trim().length < 3}
              >
                <Search aria-hidden className="size-4" />
                Buscar
              </Botao>
            </div>

            {avisoBusca ? <p className="text-texto-suave text-xs">{avisoBusca}</p> : null}

            {sugestoes.length > 0 ? (
              <ul className="border-borda flex flex-col rounded-[--radius-padrao] border">
                {sugestoes.map((sugestao) => (
                  <li key={`${sugestao.latitude},${sugestao.longitude}`}>
                    <button
                      type="button"
                      onClick={() => usarSugestao(sugestao)}
                      className="hover:bg-superficie w-full px-3 py-2 text-left text-sm"
                    >
                      {sugestao.nome}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <SeletorCoordenada
            latitude={ponto.latitude}
            longitude={ponto.longitude}
            aoSelecionar={(coordenada) => alterarPonto(selecionado, coordenada)}
          />

          <div className="grid grid-cols-2 gap-3">
            <CampoTexto
              rotulo="Latitude"
              value={ponto.latitude === null ? '' : String(ponto.latitude)}
              onChange={(evento) =>
                alterarPonto(selecionado, { latitude: interpretarNumero(evento.target.value) })
              }
              inputMode="decimal"
              placeholder="-23.5505"
            />
            <CampoTexto
              rotulo="Longitude"
              value={ponto.longitude === null ? '' : String(ponto.longitude)}
              onChange={(evento) =>
                alterarPonto(selecionado, { longitude: interpretarNumero(evento.target.value) })
              }
              inputMode="decimal"
              placeholder="-46.6333"
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={salvando}>
          Salvar pontos
        </Botao>
        {salvo ? (
          <span role="status" className="text-sucesso text-sm">
            Pontos salvos.
          </span>
        ) : null}
      </div>
    </div>
  );
}
