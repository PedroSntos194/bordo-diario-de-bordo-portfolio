import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  Layers3,
  Route,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { MarcaBordo } from '@/componentes/marca/marca-bordo';
import { DemonstracaoPortfolio } from '@/modulos/apresentacao/componentes/demonstracao-portfolio';
import { RevelarAoRolar } from '@/modulos/apresentacao/componentes/revelar-ao-rolar';
import estilos from './apresentacao.module.css';

export const metadata: Metadata = {
  title: 'Da estrada à gestão',
  description:
    'Conheça o Bordo: diário de bordo digital para frotas de vans. Uma experiência para o motorista e uma visão clara da operação para a gestão.',
};

const desafios = [
  {
    numero: '01',
    antes: 'Anotações espalhadas',
    depois: 'Uma operação conectada.',
    descricao:
      'Jornadas, corridas e ocorrências reunidas no mesmo lugar, do celular ao escritório.',
    icone: Route,
  },
  {
    numero: '02',
    antes: 'Informação de memória',
    depois: 'Registro no momento certo.',
    descricao:
      'Horários e localização capturados pelo aparelho. O motorista confirma o que precisa de atenção humana.',
    icone: Smartphone,
  },
  {
    numero: '03',
    antes: 'Redigitação no fim do mês',
    depois: 'Dados prontos para conferir.',
    descricao:
      'O que acontece na estrada alimenta o acompanhamento diário, o fechamento e as planilhas.',
    icone: FileSpreadsheet,
  },
];

const fundamentos = [
  {
    icone: Layers3,
    titulo: 'Arquitetura modular',
    descricao:
      'Regras de negócio, casos de uso, validação e acesso a dados separados por domínio. Uma base organizada para evoluir.',
    detalhe: 'Next.js · React · TypeScript',
  },
  {
    icone: WifiOff,
    titulo: 'Preparado para ficar sem sinal',
    descricao:
      'Uma fila local guarda as ações. A sincronização idempotente evita registros duplicados quando a conexão volta.',
    detalhe: 'PWA · fila offline · sincronização',
  },
  {
    icone: ShieldCheck,
    titulo: 'Alterações com histórico',
    descricao:
      'Sessão, permissão e validação precedem as gravações. A auditoria registra os valores anteriores e os novos.',
    detalhe: 'Autorização · transações · auditoria',
  },
  {
    icone: ClipboardCheck,
    titulo: 'Regras que sustentam o fechamento',
    descricao:
      'Hora extra, quilômetros excedentes e medição por contrato seguem regras explícitas e geram planilhas para conferência.',
    detalhe: 'PostgreSQL · Prisma · ExcelJS',
  },
];

export default function PaginaDeApresentacao() {
  const apenasPortfolio = process.env.BORDO_APRESENTACAO_PUBLICA === 'true';

  return (
    <RevelarAoRolar className={estilos.pagina}>
      <a className={estilos.pularConteudo} href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className={estilos.cabecalho}>
        <div className={estilos.cabecalhoInterno}>
          <Link
            href="/apresentacao"
            className={estilos.marca}
            aria-label="Bordo, início da apresentação"
          >
            <MarcaBordo className={estilos.simbolo} />
            <span>
              bordo<span className={estilos.ponto}>.</span>
            </span>
          </Link>

          <nav className={estilos.navegacao} aria-label="Navegação da apresentação">
            <a href="#solucao">A solução</a>
            <a href="#demonstracao">Demonstração</a>
            <a href="#engenharia">Engenharia</a>
          </nav>

          <Link
            className={estilos.entrar}
            href={
              apenasPortfolio
                ? 'https://github.com/PedroSntos194/bordo-diario-de-bordo-portfolio'
                : '/login'
            }
            target={apenasPortfolio ? '_blank' : undefined}
            rel={apenasPortfolio ? 'noreferrer' : undefined}
          >
            {apenasPortfolio ? 'Ver código' : 'Entrar no sistema'}{' '}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="conteudo">
        <section
          className={`${estilos.container} ${estilos.hero}`}
          aria-labelledby="titulo-principal"
        >
          <div className={estilos.heroTexto}>
            <p className={estilos.selo}>
              <span /> Diário de bordo digital
            </p>
            <h1 id="titulo-principal">
              Menos papel.
              <br />
              Mais controle
              <br />
              da <span>operação.</span>
            </h1>
            <p className={estilos.heroDescricao}>
              A rotina de uma frota de vans merece um caminho mais simples. O Bordo conecta o que o
              motorista registra na estrada ao que a gestão precisa acompanhar.
            </p>
            <div className={estilos.heroAcoes}>
              <a className={estilos.botaoPrimario} href="#demonstracao">
                Explorar a demonstração <ArrowUpRight size={19} aria-hidden="true" />
              </a>
              <a className={estilos.linkTexto} href="#solucao">
                Conhecer o projeto <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <p className={estilos.notaHero}>
              Projeto de portfólio · Dados de demonstração fictícios
            </p>
          </div>

          <div className={estilos.heroVisual}>
            <div className={estilos.visualTopo}>
              <span className={estilos.indicador}>
                <span /> Da estrada ao escritório
              </span>
              <span className={estilos.visualIndice}>BORDO / VISÃO GERAL</span>
            </div>
            <figure className={estilos.painel}>
              <div className={estilos.barraJanela} aria-hidden="true">
                <span className={estilos.pontosJanela}>
                  <i />
                  <i />
                  <i />
                </span>
                <span>bordo / painel da operação</span>
                <ShieldCheck size={14} />
              </div>
              <Image
                src="/apresentacao/admin-painel.png"
                alt="Tela real do Bordo: painel administrativo com jornadas, corridas e situação dos motoristas. Todos os dados exibidos são fictícios."
                width={2160}
                height={1350}
                sizes="(max-width: 900px) 92vw, 54vw"
                priority
                className={estilos.capturaPainel}
              />
              <figcaption>
                Interface real do sistema · Operação fictícia para apresentação
              </figcaption>
            </figure>
            <div className={estilos.visualRodape}>
              <span>
                <Check size={15} aria-hidden="true" /> Registro pelo celular
              </span>
              <span>
                <Check size={15} aria-hidden="true" /> Visão para a gestão
              </span>
              <span>
                <Check size={15} aria-hidden="true" /> Fechamento do mês
              </span>
            </div>
          </div>
        </section>

        <div className={estilos.faixaContexto}>
          <div className={estilos.container} data-revelar>
            <p>
              Um fluxo completo.
              <br />
              <strong>Do primeiro registro à última conferência.</strong>
            </p>
            <div className={estilos.fluxoContexto} aria-label="Fluxo da operação">
              <span>Motorista</span>
              <ArrowRight size={19} aria-hidden="true" />
              <span>Operação</span>
              <ArrowRight size={19} aria-hidden="true" />
              <span>Gestão</span>
            </div>
          </div>
        </div>

        <section
          id="solucao"
          className={`${estilos.container} ${estilos.secao}`}
          aria-labelledby="titulo-solucao"
        >
          <div className={estilos.introSecao} data-revelar>
            <div>
              <p className={estilos.sobretitulo}>01 / O ponto de partida</p>
              <h2 id="titulo-solucao">
                A estrada já tem desafios.
                <br />O registro não precisa ser um.
              </h2>
            </div>
            <p>
              Uma folha esquecida, um horário impreciso, uma planilha para redigitar. O projeto
              nasceu dessa rotina e de uma decisão: registrar precisa dar menos trabalho.
            </p>
          </div>
          <div className={estilos.desafios}>
            {desafios.map(({ numero, antes, depois, descricao, icone: Icone }, indice) => (
              <article
                className={estilos.desafio}
                key={numero}
                data-revelar
                data-revelar-atraso={indice * 90}
              >
                <div className={estilos.desafioTopo}>
                  <Icone size={23} aria-hidden="true" />
                  <span>{numero}</span>
                </div>
                <p className={estilos.antes}>{antes}</p>
                <h3>{depois}</h3>
                <p>{descricao}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="demonstracao"
          className={estilos.secaoDemo}
          aria-labelledby="titulo-demonstracao"
        >
          <div className={estilos.container}>
            <div className={estilos.introSecao} data-revelar>
              <div>
                <p className={estilos.sobretitulo}>02 / Experimente o fluxo</p>
                <h2 id="titulo-demonstracao">Veja o dia acontecer.</h2>
              </div>
              <p>
                Explore uma simulação interativa da rotina. Os dados são fictícios e as ações desta
                demonstração não alteram a operação do sistema.
              </p>
            </div>
            <DemonstracaoPortfolio />
          </div>
        </section>

        <section
          className={`${estilos.container} ${estilos.secao}`}
          aria-labelledby="titulo-rotina"
        >
          <div className={estilos.introSecao} data-revelar>
            <div>
              <p className={estilos.sobretitulo}>03 / Duas perspectivas, a mesma operação</p>
              <h2 id="titulo-rotina">
                Simples na estrada.
                <br />
                Claro no escritório.
              </h2>
            </div>
            <p>
              Cada pessoa encontra o que precisa para trabalhar. Os registros acompanham o dia e
              chegam à gestão com contexto.
            </p>
          </div>

          <div className={estilos.rotinaGrade}>
            <article className={estilos.rotinaMotorista} data-revelar>
              <div className={estilos.rotinaTexto}>
                <span className={estilos.rotulo}>
                  <Smartphone size={16} aria-hidden="true" /> Para quem está ao volante
                </span>
                <h3>
                  O dia na palma
                  <br />
                  da mão.
                </h3>
                <p>Um aplicativo instalável, pensado para acompanhar a rotina do motorista.</p>
                <ul className={estilos.listaBeneficios}>
                  <li>
                    <Check size={17} aria-hidden="true" /> Abrir a jornada e conferir a van
                  </li>
                  <li>
                    <Check size={17} aria-hidden="true" /> Registrar corridas e paradas
                  </li>
                  <li>
                    <Check size={17} aria-hidden="true" /> Informar despesas e ocorrências
                  </li>
                  <li>
                    <Check size={17} aria-hidden="true" /> Consultar o próprio histórico
                  </li>
                </ul>
              </div>
              <figure className={estilos.telefone}>
                <div className={estilos.telefoneTela}>
                  <Image
                    src="/apresentacao/motorista-meu-dia.png"
                    alt="Tela real do motorista com sua van, jornada e corrida em andamento. Os dados são fictícios."
                    width={780}
                    height={2272}
                    sizes="(max-width: 600px) 220px, 240px"
                  />
                </div>
                <figcaption>Tela real · Dados fictícios</figcaption>
              </figure>
            </article>

            <article className={estilos.rotinaGestao} data-revelar data-revelar-atraso="100">
              <span className={estilos.rotulo}>
                <ClipboardCheck size={16} aria-hidden="true" /> Para quem coordena a frota
              </span>
              <h3>
                Contexto para
                <br />
                tomar decisões.
              </h3>
              <p>
                Acompanhe a operação e transforme os registros do dia em informação para o
                fechamento.
              </p>
              <ol className={estilos.etapasGestao}>
                <li>
                  <span>01</span>
                  <div>
                    <h4>Acompanhar</h4>
                    <p>Jornadas abertas, motoristas e corridas em andamento.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h4>Conferir</h4>
                    <p>Quilometragem, ocorrências e pendências do dia.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h4>Fechar e exportar</h4>
                    <p>Hora extra, km excedente e medição por contrato em planilhas.</p>
                  </div>
                </li>
              </ol>
            </article>
          </div>
        </section>

        <section
          id="engenharia"
          className={estilos.secaoEngenharia}
          aria-labelledby="titulo-engenharia"
        >
          <div className={estilos.container}>
            <div className={estilos.introSecao} data-revelar>
              <div>
                <p className={estilos.sobretitulo}>04 / Por trás da experiência</p>
                <h2 id="titulo-engenharia">
                  Software pensado
                  <br />
                  para a rotina real.
                </h2>
              </div>
              <p>
                A interface é só uma parte. Consistência dos dados, rastreabilidade e regras de
                negócio dão sustentação ao que acontece na tela.
              </p>
            </div>
            <div className={estilos.fundamentos}>
              {fundamentos.map(({ icone: Icone, titulo, descricao, detalhe }, indice) => (
                <article
                  className={estilos.fundamento}
                  key={titulo}
                  data-revelar
                  data-revelar-atraso={indice * 80}
                >
                  <Icone size={25} aria-hidden="true" />
                  <h3>{titulo}</h3>
                  <p>{descricao}</p>
                  <span>{detalhe}</span>
                </article>
              ))}
            </div>
            <p className={estilos.notaEngenharia}>
              Da regra de negócio ao registro no banco, cada etapa tem um propósito.
            </p>
          </div>
        </section>

        <section
          className={`${estilos.container} ${estilos.encerramento}`}
          aria-labelledby="titulo-encerramento"
          data-revelar
        >
          <MarcaBordo className={estilos.marcaFinal} />
          <p className={estilos.sobretitulo}>Bordo · Diário de bordo digital</p>
          <h2 id="titulo-encerramento">
            Cada viagem conta.
            <br />
            Cada registro também.
          </h2>
          <p>Uma experiência conectada, da estrada à gestão.</p>
          <a className={estilos.botaoPrimario} href="#demonstracao">
            Explorar a demonstração <ArrowUpRight size={19} aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className={estilos.rodape}>
        <div className={estilos.container}>
          <Link href="/apresentacao" className={estilos.marca}>
            <MarcaBordo className={estilos.simbolo} />
            <span>
              bordo<span className={estilos.ponto}>.</span>
            </span>
          </Link>
          <p>Projeto de portfólio. Nomes, rotas, placas e números apresentados são fictícios.</p>
          <a href="#conteudo">
            Voltar ao início <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </RevelarAoRolar>
  );
}
