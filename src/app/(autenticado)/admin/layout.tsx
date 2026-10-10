import { redirect } from 'next/navigation';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { BarraSuperior } from '@/componentes/layout/barra-superior';
import { MenuLateral } from '@/componentes/layout/menu-lateral';
import { AjudaDaAdministracao } from '@/modulos/ajuda/componentes/ajuda-da-administracao';

/**
 * Área administrativa (doc 10 · T14 em diante · RF041).
 *
 * Motorista que chegar aqui vai para `/403`, não para a própria área: um
 * redirecionamento silencioso deixaria a pessoa achando que clicou errado. A
 * tela de acesso negado diz o que aconteceu e oferece o caminho de volta.
 *
 * O menu lateral é fixo no desktop e vira gaveta abaixo de 1024 px (doc 11).
 */
export default async function LayoutAdministrativo({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) redirect('/login');
  if (usuario.deveTrocarSenha) redirect('/trocar-senha');
  if (!usuario.aceitouPrivacidade) redirect('/privacidade/aceite');
  if (usuario.perfil !== 'ADMIN') redirect('/403');

  return (
    <div data-layout-administrativo className="flex min-h-dvh flex-col">
      <BarraSuperior nome={usuario.nome} papel="Administrador" mostrarData />

      <div data-conteudo-administrativo className="flex flex-1">
        <aside data-nao-imprimir className="border-borda hidden w-56 shrink-0 border-r lg:block">
          <MenuLateral />
        </aside>

        <div data-pagina-administrativa className="min-w-0 flex-1">
          {/* Abaixo de 1024 px o menu aparece recolhido, sem ocupar a largura útil. */}
          <details data-nao-imprimir className="border-borda border-b lg:hidden">
            <summary className="text-texto min-h-[--spacing-toque] cursor-pointer px-4 py-3 text-sm font-medium">
              Menu
            </summary>
            <MenuLateral />
          </details>

          <main
            data-area-administrativa
            className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6"
          >
            <AjudaDaAdministracao />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
