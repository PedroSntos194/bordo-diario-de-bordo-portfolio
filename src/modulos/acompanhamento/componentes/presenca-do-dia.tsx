import Link from 'next/link';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type {
  EstadoDeAcesso,
  PresencaDoDia as Presenca,
  SituacaoDoMotorista,
} from '@/modulos/acompanhamento/acompanhamento.regras';
import { formatarDataOperacional, formatarHora } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/** As quatro situações, cada uma com a cor da barra, do ponto e da legenda. */
const COR = {
  comecou: 'bg-sucesso',
  naoComecou: 'bg-erro',
  semAcesso: 'bg-atencao',
  folga: 'bg-texto-suave/40',
} as const;

/** O que fazer, em poucas palavras, para cada acesso travado. O detalhe fica na tela Motoristas. */
const ACAO_DO_ACESSO: Record<EstadoDeAcesso, string> = {
  SENHA_EXPIRADA: 'gerar nova senha',
  BLOQUEIO_TEMPORARIO: 'aguardar ou gerar nova senha',
  NUNCA_ENTROU: 'acompanhar o primeiro acesso',
  TROCA_PENDENTE: 'trocar a senha ao entrar',
  PRIVACIDADE_PENDENTE: 'aceitar o aviso ao entrar',
  CONTA_INATIVA: 'conferir o cadastro',
  CONTA_BLOQUEADA: 'conferir o cadastro',
  PRONTO: '',
};

const plural = (quantidade: number, um: string, varios: string): string =>
  `${quantidade} ${quantidade === 1 ? um : varios}`;

function Ponto({ cor }: { cor: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', cor)} />;
}

/** Linha da lista: ponto, nome e, à direita, a situação em poucas palavras. */
function Linha({
  cor,
  nome,
  href,
  children,
}: {
  cor: string;
  nome: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-borda flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t py-2 first:border-t-0">
      <Ponto cor={cor} />
      <Link
        href={href}
        className="text-texto min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline"
      >
        {nome}
      </Link>
      {/* No celular, a situação desce para a linha de baixo: o nome não pode sumir. */}
      <span className="text-texto-suave basis-full pl-5 text-xs sm:basis-auto sm:pl-0 sm:text-right">
        {children}
      </span>
    </li>
  );
}

/** Grupo recolhido: só o título e a contagem, abre com um toque. Sem JavaScript. */
function Recolhido({
  titulo,
  quantidade,
  children,
}: {
  titulo: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  if (quantidade === 0) return null;
  return (
    <details className="group border-borda border-t">
      <summary className="text-texto-suave hover:text-texto flex min-h-[--spacing-toque] cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        <span className="flex-1">
          {titulo} ({quantidade})
        </span>
      </summary>
      <ul className="pb-2">{children}</ul>
    </details>
  );
}

function situacaoDeQuemComecou(motorista: SituacaoDoMotorista): string {
  const partes = [
    motorista.iniciouEm ? formatarHora(motorista.iniciouEm) : null,
    motorista.placaDoDia ? formatarPlaca(motorista.placaDoDia) : null,
  ];
  if (motorista.operacao === 'CORRIDA_EM_ANDAMENTO') partes.push('em corrida');
  else if (motorista.operacao === 'DIA_ENCERRADO') {
    partes.push(
      motorista.encerrouEm ? `encerrou ${formatarHora(motorista.encerrouEm)}` : 'encerrou',
    );
  }
  return partes.filter(Boolean).join(' · ');
}

/**
 * Quem foi trabalhar no dia (pedido do cliente de 07/10).
 *
 * Desenho escolhido pelo cliente (opção A): a frase de cima responde "quantos
 * foram trabalhar"; a barra mostra a proporção de relance; a lista traz só quem
 * precisa de atenção, e o resto fica recolhido — com 25 motoristas, a tela
 * continua curta. Cor nunca sozinha (RNF022): a legenda e cada linha dizem a
 * situação em texto. As regras estão em `separarPresencaDoDia`.
 */
export function PresencaDoDia({
  presenca,
  data,
  ehHoje,
  consultadoEm,
}: {
  presenca: Presenca;
  data: string;
  ehHoje: boolean;
  consultadoEm: Date;
}) {
  const quando = ehHoje ? 'hoje' : `em ${formatarDataOperacional(data)}`;
  const linkDoMotorista = (nome: string): string =>
    `/admin/motoristas?data=${data}&busca=${encodeURIComponent(nome)}`;

  // Sem escala, não há como saber quem deveria trabalhar: todo mundo que não
  // começou entra na atenção. Com escala, quem está fora dela fica recolhido.
  const naoComecaramNaAtencao = presenca.naoComecaram.filter(
    (motorista) => motorista.escalado || !presenca.temEscala,
  );
  const foraDaEscala = presenca.naoComecaram.filter(
    (motorista) => !motorista.escalado && presenca.temEscala,
  );
  const atencao = naoComecaramNaAtencao.length + presenca.semAcesso.length;

  // A barra conta quem o dia esperava. Quem está fora da escala e não começou
  // não é falta: fica recolhido, fora da barra, para a conta bater com a lista.
  const segmentos = [
    { chave: 'comecou', quantidade: presenca.comecaram.length, cor: COR.comecou },
    { chave: 'nao', quantidade: naoComecaramNaAtencao.length, cor: COR.naoComecou },
    { chave: 'acesso', quantidade: presenca.semAcesso.length, cor: COR.semAcesso },
    { chave: 'folga', quantidade: presenca.deFolga.length, cor: COR.folga },
  ].filter((segmento) => segmento.quantidade > 0);

  const legenda = [
    plural(presenca.comecaram.length, 'começou', 'começaram'),
    plural(naoComecaramNaAtencao.length, 'não começou', 'não começaram'),
    plural(presenca.semAcesso.length, 'não consegue entrar', 'não conseguem entrar'),
    `${presenca.deFolga.length} de folga`,
  ];

  return (
    <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-texto font-semibold">Quem foi trabalhar {quando}</h2>
        <div className="flex items-baseline gap-3 text-xs">
          {ehHoje ? (
            <span className="text-texto-suave">atualizado {formatarHora(consultadoEm)}</span>
          ) : null}
          <Link href={`/admin/motoristas?data=${data}`} className="text-primaria underline">
            Ver situação completa
          </Link>
        </div>
      </div>

      <p className="text-texto-suave">
        <span className="text-texto text-3xl font-semibold">{presenca.comecaram.length}</span>{' '}
        {presenca.temEscala
          ? `de ${plural(presenca.esperados, 'escalado', 'escalados')} ${
              presenca.comecaram.length === 1 ? 'começou' : 'começaram'
            } o dia`
          : `${presenca.comecaram.length === 1 ? 'motorista começou' : 'motoristas começaram'} o dia`}
      </p>

      <div
        role="img"
        aria-label={legenda.join(', ')}
        className="bg-borda flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        {segmentos.map((segmento) => (
          <div
            key={segmento.chave}
            className={segmento.cor}
            style={{ flexGrow: segmento.quantidade }}
          />
        ))}
      </div>

      <ul className="text-texto-suave flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <Ponto cor={COR.comecou} />
          {legenda[0]}
        </li>
        <li className="flex items-center gap-1.5">
          <Ponto cor={COR.naoComecou} />
          {legenda[1]}
        </li>
        <li className="flex items-center gap-1.5">
          <Ponto cor={COR.semAcesso} />
          {legenda[2]}
        </li>
        <li className="flex items-center gap-1.5">
          <Ponto cor={COR.folga} />
          {legenda[3]}
        </li>
      </ul>

      {!presenca.temEscala ? (
        <p className="text-texto-suave text-xs">
          Sem escala cadastrada para {ehHoje ? 'hoje' : formatarDataOperacional(data)}: o painel não
          sabe quem deveria trabalhar e mostra todos os motoristas ativos.{' '}
          <Link href={`/admin/escala?data=${data}`} className="text-primaria underline">
            Cadastrar a escala
          </Link>
        </p>
      ) : null}

      <div className="flex flex-col">
        <h3 className="text-texto-suave mt-1 text-xs font-medium">Precisam de atenção</h3>
        {atencao === 0 ? (
          <p className="text-sucesso flex items-center gap-2 py-2 text-sm">
            <CheckCircle2 aria-hidden className="size-4" />
            Ninguém precisa de atenção {ehHoje ? 'agora' : 'neste dia'}.
          </p>
        ) : (
          <ul>
            {naoComecaramNaAtencao.map((motorista) => (
              <Linha
                key={motorista.id}
                cor={COR.naoComecou}
                nome={motorista.nome}
                href={linkDoMotorista(motorista.nome)}
              >
                {/* Só hoje: o sistema guarda apenas o último login. */}
                {!ehHoje
                  ? 'não registrou o dia'
                  : motorista.entrouNoDia && motorista.ultimoLoginEm
                    ? `entrou ${formatarHora(motorista.ultimoLoginEm)}, não iniciou o dia`
                    : 'não entrou no app hoje'}
              </Linha>
            ))}
            {presenca.semAcesso.map((motorista) => (
              <Linha
                key={motorista.id}
                cor={COR.semAcesso}
                nome={motorista.nome}
                href={linkDoMotorista(motorista.nome)}
              >
                <span className="text-atencao">{motorista.acessoDescricao.toLowerCase()}</span>
                {ACAO_DO_ACESSO[motorista.acesso] ? ` · ${ACAO_DO_ACESSO[motorista.acesso]}` : ''}
              </Linha>
            ))}
          </ul>
        )}
      </div>

      <div className="-mb-2 flex flex-col">
        <Recolhido titulo="Começaram" quantidade={presenca.comecaram.length}>
          {presenca.comecaram.map((motorista) => (
            <Linha
              key={motorista.id}
              cor={COR.comecou}
              nome={motorista.nome}
              href={
                motorista.jornadaId
                  ? `/admin/jornadas/${motorista.jornadaId}`
                  : linkDoMotorista(motorista.nome)
              }
            >
              {situacaoDeQuemComecou(motorista)}
            </Linha>
          ))}
        </Recolhido>
        <Recolhido titulo="Fora da escala, sem iniciar" quantidade={foraDaEscala.length}>
          {foraDaEscala.map((motorista) => (
            <Linha
              key={motorista.id}
              cor={COR.folga}
              nome={motorista.nome}
              href={linkDoMotorista(motorista.nome)}
            >
              {ehHoje && motorista.entrouNoDia && motorista.ultimoLoginEm
                ? `entrou ${formatarHora(motorista.ultimoLoginEm)}`
                : 'não escalado'}
            </Linha>
          ))}
        </Recolhido>
        <Recolhido titulo="De folga" quantidade={presenca.deFolga.length}>
          {presenca.deFolga.map((motorista) => (
            <Linha
              key={motorista.id}
              cor={COR.folga}
              nome={motorista.nome}
              href={linkDoMotorista(motorista.nome)}
            >
              folga registrada
            </Linha>
          ))}
        </Recolhido>
      </div>
    </section>
  );
}
