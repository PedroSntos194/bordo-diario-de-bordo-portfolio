'use client';

import { useReducer } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bus,
  Check,
  CheckCircle2,
  Circle,
  Gauge,
  Navigation,
  RotateCcw,
  Signal,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MarcaBordo } from '@/componentes/marca/marca-bordo';
import {
  apresentacaoInicial,
  ETAPAS_DA_APRESENTACAO,
  simularOperacao,
  type EtapaDaApresentacao,
} from '../apresentacao.regras';
import estilos from './demonstracao-portfolio.module.css';

const CENAS = {
  PRONTO: {
    titulo: 'Tudo pronto para sair?',
    descricao: 'Confira a van e o odômetro para começar a jornada.',
    acao: 'Abrir meu dia',
    status: 'Aguardando início',
    retorno: 'Comece abrindo o dia no celular. O painel acompanha cada registro enviado.',
  },
  DIA_ABERTO: {
    titulo: 'Seu dia começou.',
    descricao: 'Van conferida. Agora é só iniciar a primeira corrida.',
    acao: 'Iniciar corrida',
    status: 'Dia aberto',
    retorno: 'Dia aberto às 06:00. Próximo passo: iniciar a corrida da linha Centro → Terminal.',
  },
  EM_CORRIDA: {
    titulo: 'Boa viagem, Helena.',
    descricao: 'Centro → Terminal. Registre a chegada ao concluir o percurso.',
    acao: 'Encerrar corrida',
    status: 'Em corrida',
    retorno: 'Corrida iniciada às 06:10, com 12 passageiros. Encerre para conferir os totais.',
  },
  CORRIDA_ENCERRADA: {
    titulo: 'Mais uma viagem registrada.',
    descricao: '32 km percorridos. No fim do expediente, encerre a jornada.',
    acao: 'Encerrar meu dia',
    status: 'Corrida encerrada',
    retorno: 'Corrida encerrada às 07:00. Odômetro final: 125.462 km. Agora encerre o dia.',
  },
  DIA_ENCERRADO: {
    titulo: 'Dia encerrado. Tudo certo.',
    descricao: 'Jornada e corrida registradas, com os totais prontos para conferência.',
    acao: 'Recomeçar demonstração',
    status: 'Dia encerrado',
    retorno:
      'Fluxo concluído! Os registros chegaram ao painel. Você pode recomeçar a demonstração.',
  },
} as const;

const EVENTOS = [
  {
    etapa: 'DIA_ABERTO',
    hora: '06:00',
    titulo: 'Jornada aberta',
    detalhe: 'Van BRD-2A14 · 125.430 km',
  },
  {
    etapa: 'EM_CORRIDA',
    hora: '06:10',
    titulo: 'Corrida iniciada',
    detalhe: 'Centro → Terminal · 12 passageiros',
  },
  {
    etapa: 'CORRIDA_ENCERRADA',
    hora: '07:00',
    titulo: 'Corrida encerrada',
    detalhe: '125.462 km · 32 km percorridos',
  },
  {
    etapa: 'DIA_ENCERRADO',
    hora: '07:10',
    titulo: 'Jornada encerrada',
    detalhe: 'Registros disponíveis para conferência',
  },
] satisfies { etapa: EtapaDaApresentacao; hora: string; titulo: string; detalhe: string }[];

export function DemonstracaoPortfolio() {
  const [estado, executar] = useReducer(simularOperacao, undefined, apresentacaoInicial);
  const cena = CENAS[estado.etapa];
  const indice = ETAPAS_DA_APRESENTACAO.indexOf(estado.etapa);
  const indiceEnviado = ETAPAS_DA_APRESENTACAO.indexOf(estado.etapaSincronizada);
  const concluida = estado.etapa === 'DIA_ENCERRADO';
  const precisaSincronizar = concluida && estado.pendencias > 0;
  const fila = `${estado.pendencias} ${estado.pendencias === 1 ? 'registro aguardando' : 'registros aguardando'} conexão`;

  return (
    <div className={estilos.demo}>
      <div className={estilos.controles}>
        <p>
          <span className={estilos.marcador} /> Simulação interativa · dados fictícios
        </p>
        <div className={estilos.acoes}>
          <button
            type="button"
            aria-pressed={!estado.online}
            onClick={() => executar('ALTERNAR_CONEXAO')}
            className={estilos.botaoSinal}
          >
            {estado.online ? <WifiOff size={16} aria-hidden /> : <Wifi size={16} aria-hidden />}
            {estado.online ? 'Simular falta de sinal' : 'Restaurar conexão'}
          </button>
          <button type="button" onClick={() => executar('REINICIAR')} className={estilos.reiniciar}>
            <RotateCcw size={15} aria-hidden /> Reiniciar
          </button>
        </div>
      </div>

      <div className={estilos.cenario}>
        <div className={estilos.ladoMotorista}>
          <p className={estilos.legenda}>01 / NO CELULAR DO MOTORISTA</p>
          <div className={estilos.celular}>
            <div className={estilos.barraCelular}>
              <span>{['06:00', '06:00', '06:10', '07:00', '07:10'][indice]} · exemplo</span>
              <Signal size={15} aria-hidden />
            </div>
            <div className={estilos.marca}>
              <MarcaBordo className="size-8" />
              <strong>Bordo</strong>
              <span>Meu dia</span>
            </div>
            <div className={estilos.telaCelular}>
              <div className={estado.online ? estilos.conectado : estilos.semSinal}>
                {estado.online ? <Wifi size={13} aria-hidden /> : <WifiOff size={13} aria-hidden />}
                {estado.online ? 'Conectado · exemplo' : 'Sem sinal · exemplo'}
              </div>
              <p className={estilos.saudacao}>HELENA COSTA</p>
              <div key={estado.etapa} className={estilos.cena}>
                <h3>{cena.titulo}</h3>
                <p className={estilos.descricao}>{cena.descricao}</p>
              </div>
              <div className={estilos.cartaoVan}>
                <div className={estilos.iconeVan}>
                  <Bus size={24} aria-hidden />
                </div>
                <div>
                  <strong>Van 01</strong>
                  <span>BRD-2A14 · 16 lugares</span>
                </div>
                <CheckCircle2 size={17} aria-hidden />
              </div>
              <dl className={estilos.numerosCelular}>
                <div>
                  <dt>Odômetro</dt>
                  <dd>
                    <span key={indice >= 3 ? 'final' : 'inicial'} className={estilos.numero}>
                      {indice >= 3 ? '125.462' : '125.430'}
                    </span>{' '}
                    <small>km</small>
                  </dd>
                </div>
                <div>
                  <dt>Corridas</dt>
                  <dd>
                    <span key={indice >= 3 ? 'encerrada' : 'aguardando'} className={estilos.numero}>
                      {indice >= 3 ? '01' : '00'}
                    </span>{' '}
                    <small>encerradas</small>
                  </dd>
                </div>
              </dl>
              {estado.etapa === 'EM_CORRIDA' ? (
                <div className={estilos.viagem}>
                  <Navigation size={16} aria-hidden />
                  <div>
                    <strong>Centro → Terminal</strong>
                    <span>Em andamento · 12 passageiros</span>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className={estilos.botaoPrincipal}
                onClick={() =>
                  executar(
                    precisaSincronizar ? 'ALTERNAR_CONEXAO' : concluida ? 'REINICIAR' : 'AVANCAR',
                  )
                }
              >
                {precisaSincronizar ? 'Restaurar conexão e enviar' : cena.acao}
                {concluida ? (
                  <RotateCcw size={17} aria-hidden />
                ) : (
                  <ArrowRight size={17} aria-hidden />
                )}
              </button>
              <p className={estilos.fila}>
                {estado.pendencias > 0 ? fila : 'Nenhum registro real será criado.'}
              </p>
              <p className={estilos.resumoMobile}>
                {estado.pendencias > 0
                  ? `No celular: ${fila}. O painel aguarda o envio.`
                  : `No painel: ${CENAS[estado.etapaSincronizada].status.toLowerCase()} · ${indiceEnviado >= 3 ? '32' : '0'} km registrados.`}
              </p>
            </div>
          </div>
        </div>

        <div className={estilos.conector} aria-hidden>
          <ArrowRight size={24} />
          <ArrowDown size={24} />
          {estado.online && indiceEnviado > 0 ? (
            <span key={indiceEnviado} className={estilos.fluxo} />
          ) : null}
        </div>

        <div className={estilos.painel}>
          <div className={estilos.cabecalhoPainel}>
            <div>
              <p className={estilos.legenda}>02 / NA ADMINISTRAÇÃO</p>
              <h3>A operação, em uma tela.</h3>
            </div>
            <span className={estilos.selo}>EXEMPLO</span>
          </div>
          <p className={estilos.descricao}>Veja como o registro do motorista chega à gestão.</p>
          <dl className={estilos.indicadores}>
            <div>
              <Users size={17} aria-hidden />
              <dt>Jornadas abertas</dt>
              <dd>
                <span
                  key={indiceEnviado > 0 && indiceEnviado < 4 ? 'aberta' : 'fechada'}
                  className={estilos.numero}
                >
                  {indiceEnviado > 0 && indiceEnviado < 4 ? '01' : '00'}
                </span>
              </dd>
            </div>
            <div>
              <Navigation size={17} aria-hidden />
              <dt>Corridas em andamento</dt>
              <dd>
                <span
                  key={indiceEnviado === 2 ? 'em-corrida' : 'parada'}
                  className={estilos.numero}
                >
                  {indiceEnviado === 2 ? '01' : '00'}
                </span>
              </dd>
            </div>
            <div>
              <Gauge size={17} aria-hidden />
              <dt>Km registrados</dt>
              <dd>
                <span
                  key={indiceEnviado >= 3 ? 'registrados' : 'aguardando'}
                  className={estilos.numero}
                >
                  {indiceEnviado >= 3 ? '32' : '0'}
                </span>
              </dd>
            </div>
          </dl>
          <div className={estilos.motorista}>
            <span className={estilos.avatar} aria-hidden>
              HC
            </span>
            <div>
              <strong>Helena Costa</strong>
              <span>Van 01 · BRD-2A14</span>
            </div>
            <span className={estilos.status}>{CENAS[estado.etapaSincronizada].status}</span>
          </div>
          <ol className={estilos.eventos} aria-label="Registros recebidos pela administração">
            {EVENTOS.map((evento, posicao) => {
              const recebido = posicao < indiceEnviado;
              return (
                <li key={evento.etapa} className={recebido ? estilos.recebido : estilos.aguardando}>
                  <span className={estilos.iconeEvento}>
                    {recebido ? <Check size={14} aria-hidden /> : <Circle size={10} aria-hidden />}
                  </span>
                  <div className={estilos.conteudoEvento}>
                    <strong>{evento.titulo}</strong>
                    <span>{recebido ? evento.detalhe : 'Aguardando registro'}</span>
                  </div>
                  <span className={estilos.hora}>{recebido ? evento.hora : '—'}</span>
                </li>
              );
            })}
          </ol>
          <p className={estilos.notaPainel}>
            {estado.online
              ? 'Conexão simulada ativa: os dois lados acompanham a mesma jornada.'
              : `Painel aguardando a volta do sinal. ${estado.pendencias > 0 ? fila + '.' : 'Continue a rotina no celular.'}`}
          </p>
        </div>
      </div>

      <div className={estilos.orientacao} role="status" aria-live="polite" aria-atomic="true">
        <span className={estilos.passo}>{indice}/4</span>
        <p>
          {precisaSincronizar
            ? 'Dia encerrado no celular. Restaure a conexão para os registros chegarem ao painel.'
            : cena.retorno}
          {!estado.online ? ' Os registros ficam na fila simulada até restaurar a conexão.' : ''}
        </p>
      </div>
      <p className={estilos.nota}>
        Esta demonstração usa apenas a memória desta página. A fila offline real do aplicativo usa
        armazenamento local e sincronização com o servidor.
      </p>
    </div>
  );
}
