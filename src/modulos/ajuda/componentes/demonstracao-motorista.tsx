'use client';

import Link from 'next/link';
import { useReducer, useRef } from 'react';
import { Botao } from '@/componentes/ui/botao';
import {
  ETAPAS_DO_TREINAMENTO,
  avancarDemonstracao,
  demonstracaoInicial,
  etapaFoiPraticada,
  type AcaoDaDemonstracao,
} from '@/modulos/ajuda/treinamento.regras';

export function DemonstracaoMotorista() {
  const [estado, executar] = useReducer(avancarDemonstracao, undefined, demonstracaoInicial);
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const praticada = etapaFoiPraticada(estado);

  function navegar(acao: AcaoDaDemonstracao) {
    executar(acao);
    // As etapas são trocadas manualmente; o foco ajuda a encontrar o novo conteúdo.
    requestAnimationFrame(() => tituloEtapa.current?.focus());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-atencao/40 bg-atencao-suave rounded-[--radius-padrao] border p-3">
        <p className="text-texto font-semibold">Demonstração: nada é enviado</p>
        <p className="text-texto mt-1 text-sm">
          Os dados abaixo são fictícios. Você não precisa informar CPF nem senha. Use o celular com
          a van parada.
        </p>
      </div>
      <ol aria-label="Etapas da demonstração" className="grid grid-cols-2 gap-2 text-xs">
        {ETAPAS_DO_TREINAMENTO.map((titulo, indice) => (
          <li
            key={titulo}
            aria-current={indice === estado.etapa ? 'step' : undefined}
            className={`rounded-[--radius-padrao] border p-2 ${indice === estado.etapa ? 'border-primaria bg-primaria-suave text-primaria font-semibold' : 'border-borda text-texto-suave'}`}
          >
            {indice + 1}. {titulo}
          </li>
        ))}
      </ol>
      <section
        aria-labelledby="titulo-etapa"
        className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4"
      >
        <p className="text-texto-suave text-xs">Etapa {estado.etapa + 1} de 4 · cenário fictício</p>
        <h2
          id="titulo-etapa"
          ref={tituloEtapa}
          tabIndex={-1}
          className="text-texto text-lg font-semibold"
        >
          {ETAPAS_DO_TREINAMENTO[estado.etapa]}
        </h2>
        {estado.etapa === 0 ? (
          <>
            <p className="text-texto text-sm">
              No acesso real, entre com seu CPF e sua senha. Ao receber uma senha temporária, o
              aplicativo pede uma nova senha pessoal e a aceitação do aviso de privacidade.
            </p>
            <p className="text-texto-suave text-sm">
              Se a senha temporária venceu, peça uma nova à administração. Se aparecer um bloqueio
              temporário, aguarde o horário informado antes de tentar novamente.
            </p>
            <div className="bg-superficie rounded-[--radius-padrao] p-3 text-sm">
              <p className="text-texto font-medium">Motorista de exemplo</p>
              <p className="text-texto-suave">CPF e senha não são usados nesta demonstração.</p>
            </div>
            <Botao type="button" onClick={() => executar('ENTRAR')} disabled={estado.entrou}>
              Simular entrada
            </Botao>
            {estado.entrou ? (
              <Confirmacao texto="Entrada simulada. A tela Meu dia foi aberta." />
            ) : null}
          </>
        ) : null}
        {estado.etapa === 1 ? (
          <>
            <p className="text-texto text-sm">
              Confira a placa da van e copie a quilometragem total do painel, sem pontos. A van
              sugerida pela escala precisa ser conferida.
            </p>
            <DadosDeExemplo
              dados={[
                ['Van fictícia', 'ABC1D23'],
                ['Odômetro inicial', '125430 km'],
              ]}
            />
            <Botao
              type="button"
              onClick={() => executar('INICIAR_DIA')}
              disabled={estado.diaIniciado}
            >
              Iniciar meu dia · exemplo
            </Botao>
            {estado.diaIniciado ? <Confirmacao texto="Dia em andamento · exemplo." /> : null}
          </>
        ) : null}
        {estado.etapa === 2 ? (
          <>
            <p className="text-texto text-sm">
              Escolha a rota e confira a origem e o destino. Durante a viagem, marque as paradas
              usando Cheguei e Saí, quando disponíveis.
            </p>
            <DadosDeExemplo
              dados={[['Rota fictícia', 'Garagem de exemplo → Destino de exemplo']]}
            />
            {estado.corrida === 'NAO_INICIADA' ? (
              <Botao type="button" onClick={() => executar('INICIAR_CORRIDA')}>
                Iniciar corrida · exemplo
              </Botao>
            ) : null}
            {estado.corrida === 'EM_ANDAMENTO' ? (
              <>
                <Confirmacao texto="Corrida em andamento · exemplo." />
                <p className="text-texto text-sm">
                  Neste exemplo, a van já chegou ao destino. Para encerrar, copie o odômetro total
                  agora e informe a quantidade real de passageiros.
                </p>
                <DadosDeExemplo
                  dados={[
                    ['Odômetro no fim da corrida', '125462 km'],
                    ['Passageiros', '8'],
                  ]}
                />
                <Botao type="button" onClick={() => executar('ENCERRAR_CORRIDA')}>
                  Encerrar corrida · exemplo
                </Botao>
              </>
            ) : null}
            {estado.corrida === 'ENCERRADA' ? (
              <Confirmacao texto="Corrida encerrada · exemplo: 32 km e 8 passageiros." />
            ) : null}
            <p className="text-texto-suave text-sm">
              No trabalho real, espere a confirmação antes de iniciar outra corrida. A quilometragem
              vem do painel da van; o GPS guarda posições quando disponível.
            </p>
          </>
        ) : null}
        {estado.etapa === 3 ? (
          <>
            <p className="text-texto text-sm">
              Depois da última corrida, confira as viagens, copie o odômetro total ao terminar o
              trabalho e toque em Encerrar meu dia. Confira os totais e confirme.
            </p>
            <DadosDeExemplo
              dados={[
                ['Corridas encerradas', '1'],
                ['Odômetro final', '125462 km'],
                ['Distância do dia', '32 km'],
              ]}
            />
            <Botao
              type="button"
              onClick={() => executar('ENCERRAR_DIA')}
              disabled={estado.diaEncerrado}
            >
              Encerrar meu dia · exemplo
            </Botao>
            {estado.diaEncerrado ? (
              <Confirmacao texto="Dia encerrado · demonstração concluída. Nenhum registro foi enviado." />
            ) : null}
            <p className="text-texto-suave text-sm">
              Sair do aplicativo não fecha o dia. No uso real, espere aparecer Dia encerrado. Se a
              empresa pedir o resumo por WhatsApp, confirme Já enviei somente depois de enviar.
            </p>
          </>
        ) : null}
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Botao
          type="button"
          variante="secundaria"
          disabled={estado.etapa === 0}
          onClick={() => navegar('ANTERIOR')}
        >
          Anterior
        </Botao>
        {estado.etapa < 3 ? (
          <Botao type="button" disabled={!praticada} onClick={() => navegar('PROXIMO')}>
            Próximo
          </Botao>
        ) : (
          <Botao type="button" variante="secundaria" onClick={() => navegar('REFAZER')}>
            Refazer
          </Botao>
        )}
      </div>
      {estado.etapa < 3 && !praticada ? (
        <p className="text-texto-suave text-center text-xs">
          Pratique com o botão do exemplo para liberar Próximo.
        </p>
      ) : null}
      <Link
        href="/app"
        className="text-primaria flex min-h-[--spacing-toque] items-center justify-center text-sm font-medium underline"
      >
        {estado.diaEncerrado ? 'Voltar a Meu dia' : 'Sair da demonstração e voltar a Meu dia'}
      </Link>
      <Link
        href="/app/ajuda"
        className="text-primaria flex min-h-[--spacing-toque] items-center justify-center text-sm underline"
      >
        Abrir ajuda
      </Link>
    </div>
  );
}

function DadosDeExemplo({ dados }: { dados: [string, string][] }) {
  return (
    <dl className="bg-superficie flex flex-col gap-2 rounded-[--radius-padrao] p-3 text-sm">
      {dados.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt className="text-texto-suave">{rotulo}</dt>
          <dd className="text-texto font-medium">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Confirmacao({ texto }: { texto: string }) {
  return (
    <p
      role="status"
      className="bg-sucesso-suave text-texto rounded-[--radius-padrao] p-3 text-sm font-medium"
    >
      {texto}
    </p>
  );
}
