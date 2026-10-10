import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { BarraSuperior } from '@/componentes/layout/barra-superior';
import { SeletorDeTema } from '@/componentes/layout/seletor-de-tema';
import { BotaoAlgoDeuErrado } from '@/modulos/suporte/componentes/botao-algo-deu-errado';
import { contatoDoSuporte } from '@/modulos/suporte/suporte.servico';
import { COOKIE_DO_TEMA, lerTema } from '@/utilitarios/tema';
import { ConviteDeInstalacao } from '@/offline/convite-de-instalacao';
import { IndicadorDeSincronizacao } from '@/offline/indicador-sincronizacao';
import { RegistrarServiceWorker } from '@/offline/registrar-service-worker';
import { AjudaDoMotorista } from '@/modulos/ajuda/componentes/ajuda-do-motorista';
import { NavegacaoMotorista } from '@/modulos/ajuda/componentes/navegacao-motorista';
import { ConviteTreinamentoMotorista } from '@/modulos/ajuda/componentes/convite-treinamento-motorista';

/**
 * Área do motorista (doc 10 · T04 em diante).
 *
 * O administrador também entra aqui — ele precisa conseguir ver e conferir a
 * tela que o motorista usa (matriz do doc 08).
 *
 * As pendências são checadas nesta ordem e nesta camada, e não no layout
 * autenticado, para que `/trocar-senha` e `/privacidade/aceite` continuem
 * acessíveis sem laço de redirecionamento.
 *
 * O service worker e o indicador de sincronização vivem **aqui**, e não no
 * layout raiz (US025): o modo sem conexão é necessidade de campo. Guardar as
 * telas administrativas no disco do navegador levaria dado da frota inteira
 * para onde ele não precisa estar (RN029), e o administrador trabalha sentado,
 * com rede.
 */
export default async function LayoutMotorista({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) redirect('/login');
  if (usuario.deveTrocarSenha) redirect('/trocar-senha');
  if (!usuario.aceitouPrivacidade) redirect('/privacidade/aceite');

  const [contato, tema] = await Promise.all([
    contatoDoSuporte(),
    cookies().then((lista) => lerTema(lista.get(COOKIE_DO_TEMA)?.value)),
  ]);
  const telefoneDoSuporte = contato.sucesso ? (contato.dados?.telefone ?? null) : null;
  const versao = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

  return (
    <div className="flex min-h-dvh flex-col">
      <RegistrarServiceWorker />

      <BarraSuperior
        nome={usuario.nome}
        papel={usuario.perfil === 'ADMIN' ? 'Administrador' : 'Motorista'}
        mostrarData
      />

      {/*
        Faixa permanente com o estado da sincronização. Ocupa uma linha inteira
        de propósito: "um indicador permanente mostra o estado" é critério de
        aceitação da US025, e escondê-lo dentro da barra superior o transformaria
        em detalhe que ninguém procura.
      */}
      <div className="border-borda bg-fundo border-b">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
          <IndicadorDeSincronizacao />
          {/*
            Ajuda e tema ficam nesta faixa, sempre à vista: é para cá que o
            motorista olha quando algo não sai como esperado, e a troca de tela
            clara/escura precisa caber num toque, no sol.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BotaoAlgoDeuErrado nome={usuario.nome} telefone={telefoneDoSuporte} versao={versao} />
            <SeletorDeTema inicial={tema} variante="alternar" />
            <a href="/app/sem-conexao" className="text-texto-suave text-xs underline">
              Modo sem conexão
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <NavegacaoMotorista />
        <AjudaDoMotorista />
        <ConviteTreinamentoMotorista usuarioId={usuario.id} />
        {children}

        {/*
          Convite para instalar na tela inicial (US045). Fica no fim da página e
          some sozinho quando já está instalado ou quando o motorista dispensa —
          um modal aqui atravessaria o caminho entre ele e "iniciar meu dia".
        */}
        <ConviteDeInstalacao />
      </main>
    </div>
  );
}
