'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CloudOff, MapPin, PlayCircle, StopCircle, Sunrise, Sunset } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { capturarLocalizacao } from '@/modulos/localizacao/localizacao';
import { TIPOS_MANUAIS } from '@/modulos/evento/evento.regras';
import {
  ROTULO_DA_OPERACAO,
  estadoLocal,
  type TipoDeOperacao,
} from '@/modulos/sincronizacao/sincronizacao.regras';
import { registrarOffline, useOffline } from '@/offline/use-offline';
import { formatarHora } from '@/utilitarios/data';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Modo sem conexão (US025 · RF022 · RN025).
 *
 * ## Por que uma tela separada, e não as telas de sempre
 *
 * As telas do motorista são renderizadas no servidor com o estado atual do dia.
 * Sem rede, o que o cache guardou é o estado da **última vez** — e apresentar
 * isso como se fosse o agora seria mentir sobre um registro operacional. Esta
 * tela não finge: ela diz que está sem conexão, mostra o que está guardado no
 * aparelho e oferece exatamente as quatro ações que o critério de aceitação
 * exige.
 *
 * ## O estado vem do aparelho
 *
 * O que aparece aqui é o retrato do dia guardado localmente **mais** a fila de
 * operações ainda não enviadas — combinados por `estadoLocal`, que é função
 * pura e testada. Sem essa combinação, o motorista que abriu o dia sem sinal
 * veria "você ainda não iniciou seu dia" e abriria de novo, criando duas
 * jornadas das quais uma seria recusada na sincronização.
 *
 * As regras continuam sendo as do servidor: uma corrida por vez (RN014), uma
 * jornada por dia (RN012). Aqui elas são apenas **antecipadas** para evitar o
 * conflito, nunca substituídas — quem decide de verdade é o caso de uso, na
 * hora de sincronizar.
 */
export function ModoSemConexao() {
  const { online, retrato, pendentes, conflitos, sincronizando, sincronizar, suportado } =
    useOffline();

  const [acao, setAcao] = useState<TipoDeOperacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const estado = useMemo(() => estadoLocal(retrato, pendentes), [retrato, pendentes]);

  async function registrar(
    tipo: TipoDeOperacao,
    dados: Record<string, unknown>,
    comLocalizacao: boolean,
  ): Promise<void> {
    let localizacao: Record<string, unknown> | undefined;

    if (comLocalizacao) {
      // RN022 — falta de GPS nunca bloqueia o registro. Sem rede a coordenada é
      // ainda mais valiosa (é o único vestígio de onde a corrida passou), mas
      // continua sendo complemento.
      const captura = await capturarLocalizacao();
      if (captura.situacao === 'CAPTURADA') localizacao = { ...captura.localizacao };
    }

    await registrarOffline({ tipo, dados: { ...dados, ...(localizacao ? { localizacao } : {}) } });

    setAcao(null);
    setAviso(
      `${ROTULO_DA_OPERACAO[tipo]} guardado no aparelho. Vai subir sozinho quando o sinal voltar.`,
    );
  }

  if (!suportado) {
    return (
      <div className="border-erro/30 bg-erro-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-4">
        <p className="text-texto font-medium">Este navegador não guarda registros offline</p>
        <p className="text-texto-suave text-sm">
          Sem armazenamento local não dá para prometer que o registro não se perde — e prometer e
          perder é pior do que avisar. Procure um sinal de internet para registrar, ou anote no
          papel e lance depois.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`flex items-start gap-3 rounded-[--radius-padrao] border p-3 ${
          online ? 'border-borda bg-superficie' : 'border-atencao/30 bg-atencao-suave'
        }`}
      >
        <CloudOff aria-hidden className="text-atencao mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-texto text-sm font-medium">
            {online ? 'Modo sem conexão' : 'Você está sem conexão'}
          </p>
          <p className="text-texto-suave text-sm">
            {online
              ? 'Você pode usar esta tela a qualquer momento. Tudo o que registrar aqui é guardado no aparelho e enviado em seguida.'
              : 'Registre normalmente. O que você marcar fica guardado no aparelho e sobe sozinho quando o sinal voltar.'}
          </p>
          {retrato ? (
            <p className="text-texto-suave mt-1 text-xs">
              Dados do dia guardados às {formatarHora(new Date(retrato.atualizadoEm))}.
            </p>
          ) : (
            <p className="text-erro mt-1 text-xs">
              Este aparelho ainda não guardou os dados do dia. Abra o aplicativo uma vez com
              internet.
            </p>
          )}
        </div>
      </div>

      {conflitos.length > 0 ? (
        <div
          role="alert"
          className="border-erro/30 bg-erro-suave flex items-center gap-3 rounded-[--radius-padrao] border p-3"
        >
          <p className="text-texto flex-1 text-sm">
            {conflitos.length === 1
              ? '1 registro não foi aceito pelo servidor.'
              : `${conflitos.length} registros não foram aceitos pelo servidor.`}
          </p>
          <Link
            href="/app/pendencias-de-envio"
            className="text-primaria shrink-0 text-sm font-medium underline"
          >
            Resolver
          </Link>
        </div>
      ) : null}

      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-texto-suave text-xs">Seu dia, segundo este aparelho</p>
            <p className="text-texto text-lg font-semibold">
              {estado.temJornada
                ? `Van ${estado.placaDaJornada ? formatarPlaca(estado.placaDaJornada) : '—'}`
                : 'Dia não iniciado'}
            </p>
          </div>
          <Etiqueta tom={estado.temJornada ? 'andamento' : 'neutro'}>
            {estado.temJornada ? 'Dia aberto' : 'Sem jornada'}
          </Etiqueta>
        </div>

        {estado.corrida ? (
          <p className="text-texto border-andamento border-l-4 pl-3 text-sm">
            Corrida em andamento: <strong>{estado.corrida.descricao}</strong>
          </p>
        ) : null}
      </section>

      {/*
        Uma ação principal por estado, como em `/app` (doc 11). A diferença é
        que aqui o estado vem do aparelho, e é por isso que ele precisa ser
        calculado pela fila — e não pelo que o servidor sabia da última vez.
      */}
      <div className="flex flex-col gap-3">
        {!estado.temJornada ? (
          <BotaoDeAcao
            Icone={Sunrise}
            rotulo="Iniciar meu dia"
            ativo={acao === 'ABRIR_JORNADA'}
            aoTocar={() => setAcao(acao === 'ABRIR_JORNADA' ? null : 'ABRIR_JORNADA')}
          />
        ) : estado.corrida ? (
          <>
            <BotaoDeAcao
              Icone={StopCircle}
              rotulo="Encerrar corrida"
              ativo={acao === 'ENCERRAR_CORRIDA'}
              aoTocar={() => setAcao(acao === 'ENCERRAR_CORRIDA' ? null : 'ENCERRAR_CORRIDA')}
            />
            <BotaoDeAcao
              Icone={MapPin}
              rotulo="Registrar parada"
              secundario
              ativo={acao === 'REGISTRAR_EVENTO'}
              aoTocar={() => setAcao(acao === 'REGISTRAR_EVENTO' ? null : 'REGISTRAR_EVENTO')}
            />
            <p className="text-texto-suave text-xs">
              Enquanto esta corrida estiver aberta, não dá para iniciar outra nem encerrar o dia.
            </p>
          </>
        ) : (
          <>
            <BotaoDeAcao
              Icone={PlayCircle}
              rotulo="Iniciar corrida"
              ativo={acao === 'INICIAR_CORRIDA'}
              aoTocar={() => setAcao(acao === 'INICIAR_CORRIDA' ? null : 'INICIAR_CORRIDA')}
            />
            <BotaoDeAcao
              Icone={Sunset}
              rotulo="Encerrar meu dia"
              secundario
              ativo={acao === 'ENCERRAR_JORNADA'}
              aoTocar={() => setAcao(acao === 'ENCERRAR_JORNADA' ? null : 'ENCERRAR_JORNADA')}
            />
          </>
        )}
      </div>

      {acao === 'ABRIR_JORNADA' ? (
        <FormularioAbrir
          veiculos={retrato?.veiculos ?? []}
          aoRegistrar={(dados) => registrar('ABRIR_JORNADA', dados, false)}
        />
      ) : null}

      {acao === 'INICIAR_CORRIDA' ? (
        <FormularioIniciarCorrida
          rotas={retrato?.rotas ?? []}
          aoRegistrar={(dados) => registrar('INICIAR_CORRIDA', dados, true)}
        />
      ) : null}

      {acao === 'REGISTRAR_EVENTO' && estado.corrida ? (
        <FormularioParada
          aoRegistrar={(dados) =>
            registrar(
              'REGISTRAR_EVENTO',
              {
                ...dados,
                corridaId: estado.corrida?.id ?? undefined,
                corridaClientUuid: estado.corrida?.clientUuid ?? undefined,
              },
              true,
            )
          }
        />
      ) : null}

      {acao === 'ENCERRAR_CORRIDA' && estado.corrida ? (
        <FormularioEncerrarCorrida
          aoRegistrar={(dados) =>
            registrar(
              'ENCERRAR_CORRIDA',
              {
                ...dados,
                corridaId: estado.corrida?.id ?? undefined,
                corridaClientUuid: estado.corrida?.clientUuid ?? undefined,
              },
              true,
            )
          }
        />
      ) : null}

      {acao === 'ENCERRAR_JORNADA' ? (
        <FormularioEncerrarDia
          aoRegistrar={(dados) => registrar('ENCERRAR_JORNADA', dados, false)}
        />
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-texto text-sm font-semibold">
            Guardado no aparelho ({pendentes.length})
          </h2>
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            onClick={sincronizar}
            carregando={sincronizando}
            rotuloCarregando="Enviando…"
            disabled={!online || pendentes.length === 0}
          >
            Enviar agora
          </Botao>
        </div>

        {pendentes.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Nada esperando envio. Tudo o que você registrou já está no servidor.
          </p>
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {pendentes.map((operacao) => (
              <li key={operacao.clientUuid} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-texto flex-1">{ROTULO_DA_OPERACAO[operacao.tipo]}</span>
                <span className="text-texto-suave text-xs">
                  {formatarHora(new Date(operacao.ocorridoEm))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/app"
        className="border-borda text-texto flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border px-6 text-sm font-medium"
      >
        Voltar para o aplicativo
      </Link>
    </div>
  );
}

// ------------------------------------------------------------ formulários

function BotaoDeAcao({
  Icone,
  rotulo,
  ativo,
  secundario = false,
  aoTocar,
}: {
  Icone: typeof MapPin;
  rotulo: string;
  ativo: boolean;
  secundario?: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-expanded={ativo}
      className={`flex min-h-[--spacing-toque] items-center justify-center gap-2 rounded-[--radius-padrao] px-6 py-3 font-medium ${
        secundario ? 'border-borda text-texto border' : 'bg-primaria text-lg text-white'
      }`}
    >
      <Icone aria-hidden className="size-5" />
      {ativo ? `${rotulo} — fechar` : rotulo}
    </button>
  );
}

function Caixa({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-primaria/30 bg-primaria-suave/30 flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
      {children}
    </div>
  );
}

function FormularioAbrir({
  veiculos,
  aoRegistrar,
}: {
  veiculos: { id: string; placa: string; modelo: string; odometroAtual: number }[];
  aoRegistrar: (dados: Record<string, unknown>) => Promise<void>;
}) {
  const [veiculoId, setVeiculoId] = useState(veiculos.length === 1 ? (veiculos[0]?.id ?? '') : '');
  const [odometro, setOdometro] = useState('');

  const selecionado = veiculos.find((veiculo) => veiculo.id === veiculoId);

  if (veiculos.length === 0) {
    return (
      <Caixa>
        <p className="text-texto text-sm">
          Este aparelho não guardou a lista de vans. Abra o aplicativo uma vez com internet para
          conseguir iniciar o dia sem sinal.
        </p>
      </Caixa>
    );
  }

  return (
    <Caixa>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-texto mb-2 text-sm font-medium">Qual van?</legend>
        {veiculos.map((veiculo) => (
          <label
            key={veiculo.id}
            className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-3 rounded-[--radius-padrao] border p-3 ${
              veiculoId === veiculo.id ? 'border-primaria bg-primaria-suave' : 'border-borda'
            }`}
          >
            <input
              type="radio"
              name="veiculo-offline"
              value={veiculo.id}
              checked={veiculoId === veiculo.id}
              onChange={() => setVeiculoId(veiculo.id)}
              className="size-5"
            />
            <span className="min-w-0 flex-1">
              <span className="text-texto block font-mono font-medium">
                {formatarPlaca(veiculo.placa)}
              </span>
              <span className="text-texto-suave block truncate text-xs">{veiculo.modelo}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <CampoTexto
        rotulo="Odômetro do painel"
        value={odometro}
        onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        inputMode="numeric"
        className="text-2xl"
        placeholder="000000"
        referencia={
          selecionado
            ? `Último valor guardado: ${formatarOdometro(selecionado.odometroAtual)} km`
            : 'Selecione a van.'
        }
      />

      <Botao
        type="button"
        tamanho="grande"
        disabled={veiculoId === '' || odometro === ''}
        onClick={() =>
          void aoRegistrar({
            veiculoId,
            odometroInicial: Number(odometro),
            // A divergência de odômetro não tem como ser confirmada sem rede: o
            // servidor é quem conhece o último valor real. Confirmar aqui evita
            // que o dia inteiro trave num conflito na hora de subir — e o valor
            // digitado fica na auditoria, como qualquer outro.
            confirmaDivergencia: true,
            placa: selecionado?.placa ?? null,
          })
        }
      >
        Guardar início do dia
      </Botao>
    </Caixa>
  );
}

function FormularioIniciarCorrida({
  rotas,
  aoRegistrar,
}: {
  rotas: { id: string; codigo: string; nome: string }[];
  aoRegistrar: (dados: Record<string, unknown>) => Promise<void>;
}) {
  const [rotaId, setRotaId] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');

  const rota = rotas.find((item) => item.id === rotaId);
  const valido = rotaId !== '' || (origem.trim() !== '' && destino.trim() !== '');

  return (
    <Caixa>
      <div className="flex flex-col gap-2">
        <label htmlFor="rota-offline" className="text-texto text-sm font-medium">
          Rota cadastrada
        </label>
        <select
          id="rota-offline"
          value={rotaId}
          onChange={(evento) => setRotaId(evento.target.value)}
          className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
        >
          <option value="">Sem rota — informar origem e destino</option>
          {rotas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.codigo} · {item.nome}
            </option>
          ))}
        </select>
      </div>

      {rotaId === '' ? (
        <>
          <CampoTexto
            rotulo="De onde"
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value)}
            placeholder="Terminal, garagem…"
          />
          <CampoTexto
            rotulo="Para onde"
            value={destino}
            onChange={(evento) => setDestino(evento.target.value)}
            placeholder="Fábrica, portaria…"
          />
        </>
      ) : null}

      <Botao
        type="button"
        tamanho="grande"
        disabled={!valido}
        onClick={() =>
          void aoRegistrar({
            ...(rotaId ? { rotaId } : { origemDescricao: origem, destinoDescricao: destino }),
            descricao: rota ? rota.nome : `${origem} → ${destino}`,
          })
        }
      >
        Guardar início da corrida
      </Botao>
    </Caixa>
  );
}

function FormularioParada({
  aoRegistrar,
}: {
  aoRegistrar: (dados: Record<string, unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<(typeof TIPOS_MANUAIS)[number]>('CHEGADA');
  const [descricao, setDescricao] = useState('');

  const ROTULOS: Record<(typeof TIPOS_MANUAIS)[number], string> = {
    CHEGADA: 'Cheguei',
    SAIDA: 'Saí',
    EMBARQUE: 'Embarque',
    DESEMBARQUE: 'Desembarque',
  };

  return (
    <Caixa>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-texto mb-2 text-sm font-medium">O que aconteceu?</legend>
        {TIPOS_MANUAIS.map((opcao) => (
          <label
            key={opcao}
            className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-4 ${
              tipo === opcao ? 'border-primaria bg-primaria-suave' : 'border-borda'
            }`}
          >
            <input
              type="radio"
              name="tipo-parada"
              value={opcao}
              checked={tipo === opcao}
              onChange={() => setTipo(opcao)}
              className="size-4"
            />
            <span className="text-texto text-sm">{ROTULOS[opcao]}</span>
          </label>
        ))}
      </fieldset>

      {/*
        Sem rede não dá para escolher o ponto cadastrado da rota: o vínculo é
        feito por identificador, e o aparelho não guarda os pontos. O nome
        digitado cumpre a exigência de identificar a parada.
      */}
      <CampoTexto
        rotulo="Onde"
        value={descricao}
        onChange={(evento) => setDescricao(evento.target.value)}
        placeholder="Nome do ponto"
        referencia="Sem conexão a parada é identificada pelo nome, não pelo ponto cadastrado."
      />

      <Botao
        type="button"
        tamanho="grande"
        disabled={descricao.trim() === ''}
        onClick={() => void aoRegistrar({ tipo, descricao: descricao.trim() })}
      >
        Guardar parada
      </Botao>
    </Caixa>
  );
}

function FormularioEncerrarCorrida({
  aoRegistrar,
}: {
  aoRegistrar: (dados: Record<string, unknown>) => Promise<void>;
}) {
  const [odometro, setOdometro] = useState('');
  const [passageiros, setPassageiros] = useState('');

  return (
    <Caixa>
      <CampoTexto
        rotulo="Odômetro do painel agora"
        value={odometro}
        onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        inputMode="numeric"
        className="text-2xl"
        placeholder="000000"
      />

      <CampoTexto
        rotulo="Passageiros"
        value={passageiros}
        onChange={(evento) => setPassageiros(evento.target.value.replace(/\D/g, '').slice(0, 3))}
        inputMode="numeric"
        placeholder="0"
        referencia="Opcional."
      />

      <Botao
        type="button"
        tamanho="grande"
        disabled={odometro === ''}
        onClick={() =>
          void aoRegistrar({
            odometroFinal: Number(odometro),
            quantidadePassageiros: passageiros === '' ? null : Number(passageiros),
            // Sem rede não há como o motorista confirmar excesso de passageiros:
            // ele não sabe a capacidade cadastrada da van. Confirmar aqui evita
            // travar o registro num conflito que só apareceria horas depois.
            confirmaExcessoPassageiros: true,
          })
        }
      >
        Guardar fim da corrida
      </Botao>
    </Caixa>
  );
}

function FormularioEncerrarDia({
  aoRegistrar,
}: {
  aoRegistrar: (dados: Record<string, unknown>) => Promise<void>;
}) {
  const [odometro, setOdometro] = useState('');
  const [observacoes, setObservacoes] = useState('');

  return (
    <Caixa>
      <CampoTexto
        rotulo="Odômetro final do painel"
        value={odometro}
        onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        inputMode="numeric"
        className="text-2xl"
        placeholder="000000"
      />

      <CampoTexto
        rotulo="Observações"
        value={observacoes}
        onChange={(evento) => setObservacoes(evento.target.value)}
        placeholder="Algo a registrar sobre o dia?"
        referencia="Opcional."
      />

      <Botao
        type="button"
        tamanho="grande"
        disabled={odometro === ''}
        onClick={() =>
          void aoRegistrar({
            odometroFinal: Number(odometro),
            observacoes: observacoes.trim() || undefined,
          })
        }
      >
        Guardar fim do dia
      </Botao>
    </Caixa>
  );
}
