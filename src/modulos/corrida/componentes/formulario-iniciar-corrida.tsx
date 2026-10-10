'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import type { ErrosDeCampo } from '@/lib/erros';
import { iniciarCorrida } from '@/modulos/corrida/corrida.acoes';
import { capturarLocalizacao, explicarFalha } from '@/modulos/localizacao/localizacao';
import { ROTULO_TURNO } from '@/modulos/rota/rota.schema';

/**
 * Início da corrida (T06 · US018 · RF015, RF016).
 *
 * Uma rota selecionada e um toque — é a interação mais frequente do sistema, e
 * a que mais precisa ser rápida. A captura de GPS acontece **junto** com o
 * envio, não antes: pedir a permissão numa etapa separada acrescentaria um
 * toque a uma tela que precisa ter um só.
 */
export interface RotaSelecionavel {
  id: string;
  codigo: string;
  nome: string;
  origem: string;
  destino: string;
  turno: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
}

export function FormularioIniciarCorrida({
  rotas,
  rotasEscaladas = [],
}: {
  rotas: RotaSelecionavel[];
  /** Rotas planejadas para hoje (US014 · RF013). */
  rotasEscaladas?: string[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const escaladas = new Set(rotasEscaladas);

  const [busca, setBusca] = useState('');
  /**
   * Uma rota escalada e só uma já vem marcada: é o caso comum de quem faz um
   * roteiro fixo, e economiza o toque. Com duas ou mais, escolher por ele seria
   * palpite — o sistema não sabe qual vem primeiro no dia.
   */
  const [rotaId, setRotaId] = useState<string | null>(
    rotasEscaladas.length === 1 ? (rotasEscaladas[0] ?? null) : null,
  );
  const [avulsa, setAvulsa] = useState(rotas.length === 0);
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  const termo = busca.trim().toLowerCase();
  const rotasFiltradas = (
    termo.length === 0
      ? rotas
      : rotas.filter((rota) =>
          `${rota.codigo} ${rota.nome} ${rota.origem} ${rota.destino}`
            .toLowerCase()
            .includes(termo),
        )
  )
    // As escaladas sobem para o topo. Numa lista de trinta rotas, quem tem duas
    // planejadas não deveria precisar procurá-las.
    .slice()
    .sort((uma, outra) => Number(escaladas.has(outra.id)) - Number(escaladas.has(uma.id)));

  function enviar(): void {
    setErroGeral(null);
    setErrosDeCampo({});
    setAvisoGps(null);

    iniciar(async () => {
      // Falta de GPS nunca impede o registro (RN022): o resultado da captura é
      // opcional, e a corrida segue marcada como "sem localização".
      const captura = await capturarLocalizacao();
      if (captura.situacao !== 'CAPTURADA') setAvisoGps(explicarFalha(captura.situacao));

      const resultado = await iniciarCorrida({
        ...(avulsa ? { origemDescricao: origem, destinoDescricao: destino } : { rotaId }),
        ...(captura.situacao === 'CAPTURADA' ? { localizacao: captura.localizacao } : {}),
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      router.replace(`/app/corrida/${resultado.dados.id}`);
      router.refresh();
    });
  }

  const podeEnviar = avulsa ? origem.trim() !== '' && destino.trim() !== '' : rotaId !== null;

  return (
    <div className="flex flex-col gap-5">
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}
      {avisoGps ? (
        <p className="border-borda bg-superficie text-texto-suave rounded-[--radius-padrao] border p-3 text-sm">
          {avisoGps}
        </p>
      ) : null}

      {!avulsa ? (
        <>
          {rotas.length > 3 ? (
            <div className="relative">
              <Search
                aria-hidden
                className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar rota"
                aria-label="Buscar rota"
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] w-full rounded-[--radius-padrao] border py-2 pr-3 pl-9 text-base"
              />
            </div>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-texto mb-2 text-sm font-medium">
              Qual rota você vai fazer?
            </legend>

            {rotasFiltradas.map((rota) => (
              <label
                key={rota.id}
                className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-3 rounded-[--radius-padrao] border p-3 ${
                  rotaId === rota.id ? 'border-primaria bg-primaria-suave' : 'border-borda'
                }`}
              >
                <input
                  type="radio"
                  name="rota"
                  value={rota.id}
                  checked={rotaId === rota.id}
                  onChange={() => setRotaId(rota.id)}
                  disabled={enviando}
                  className="size-5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-texto block font-medium">{rota.nome}</span>
                  <span className="text-texto-suave block truncate text-xs">
                    {rota.origem} → {rota.destino}
                  </span>
                </span>
                {escaladas.has(rota.id) ? <Etiqueta tom="info">Escalada</Etiqueta> : null}
                <Etiqueta>{ROTULO_TURNO[rota.turno]}</Etiqueta>
              </label>
            ))}

            {rotasFiltradas.length === 0 ? (
              <p className="text-texto-suave py-4 text-center text-sm">
                Nenhuma rota encontrada para “{busca}”.
              </p>
            ) : null}
          </fieldset>

          <button
            type="button"
            onClick={() => setAvulsa(true)}
            disabled={enviando}
            className="text-primaria min-h-[--spacing-toque] text-sm font-medium underline"
          >
            A rota de hoje não está na lista
          </button>
        </>
      ) : (
        <>
          <div className="border-borda bg-superficie flex items-start gap-2 rounded-[--radius-padrao] border p-3">
            <MapPin aria-hidden className="text-texto-suave mt-0.5 size-4 shrink-0" />
            <p className="text-texto-suave text-sm">
              Corrida avulsa: informe de onde saiu e para onde vai.
            </p>
          </div>

          <CampoTexto
            rotulo="Saindo de"
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value)}
            erro={errosDeCampo.origemDescricao}
            disabled={enviando}
            required
            maxLength={160}
            placeholder="Terminal Centro"
          />

          <CampoTexto
            rotulo="Indo para"
            value={destino}
            onChange={(evento) => setDestino(evento.target.value)}
            erro={errosDeCampo.destinoDescricao}
            disabled={enviando}
            required
            maxLength={160}
            placeholder="Planta Industrial"
          />

          {rotas.length > 0 ? (
            <button
              type="button"
              onClick={() => setAvulsa(false)}
              disabled={enviando}
              className="text-primaria min-h-[--spacing-toque] text-sm font-medium underline"
            >
              Escolher uma rota cadastrada
            </button>
          ) : null}
        </>
      )}

      <Botao
        type="button"
        tamanho="grande"
        onClick={enviar}
        carregando={enviando}
        rotuloCarregando="Iniciando…"
        disabled={!podeEnviar}
      >
        Iniciar corrida
      </Botao>

      <p className="text-texto-suave text-center text-xs">
        O horário é registrado automaticamente. Permita a localização para guardar a posição; mesmo
        sem GPS, a corrida será registrada.
      </p>
    </div>
  );
}
