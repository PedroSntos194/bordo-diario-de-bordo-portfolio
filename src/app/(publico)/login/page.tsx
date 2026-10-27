import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Route, ShieldCheck, Smartphone } from 'lucide-react';
import { MarcaBordo } from '@/componentes/marca/marca-bordo';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { retornoEhSeguro } from '@/modulos/autenticacao/autenticacao.regras';
import { FormularioLogin } from '@/modulos/autenticacao/componentes/formulario-login';
import estilos from './login.module.css';

export const metadata: Metadata = { title: 'Entrar' };

/** T01 — Acesso à operação, com entrada para a apresentação pública do portfólio. */
export default async function PaginaDeLogin({
  searchParams,
}: {
  searchParams: Promise<{ retorno?: string }>;
}) {
  // Quem já tem sessão não precisa ver o login de novo.
  const usuario = await obterUsuarioDaSessao();
  if (usuario) redirect('/');

  const { retorno } = await searchParams;

  return (
    <main className={`${estilos.login} grid min-h-dvh lg:grid-cols-[1.05fr_1fr]`}>
      <section
        className={`${estilos.vitrine} relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16`}
        aria-label="Sobre o Bordo"
      >
        <div
          aria-hidden
          className={`${estilos.orbita} pointer-events-none absolute -right-48 -bottom-40 size-[620px] rounded-full border border-violet-300/25`}
        />
        <div
          aria-hidden
          className={`${estilos.orbitaInterna} pointer-events-none absolute -right-28 -bottom-20 size-[460px] rounded-full border border-violet-300/25`}
        />
        <Link
          href="/apresentacao"
          className={`${estilos.marca} relative flex w-fit items-center gap-3 rounded-lg`}
        >
          <MarcaBordo className="size-11" />
          <span className="text-2xl font-semibold tracking-tight">
            Bordo<span className="ml-1 text-violet-300">.</span>
          </span>
        </Link>

        <div className={`${estilos.mensagem} relative my-16 max-w-lg`}>
          <p className="mb-5 text-xs font-medium tracking-[0.18em] text-violet-200">
            DIÁRIO DE BORDO DIGITAL
          </p>
          <h2 className="text-5xl leading-[1.08] font-semibold tracking-[-0.045em] xl:text-6xl">
            Cada viagem conta.
            <br />
            <span className="text-violet-300">Cada registro também.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-violet-100/80">
            Do primeiro quilômetro ao fechamento do mês, sua operação no mesmo lugar.
          </p>
          <ul className="mt-9 flex flex-col gap-4 text-sm text-violet-100">
            <li className="flex items-center gap-3">
              <Smartphone aria-hidden className="size-5 text-violet-300" />
              Registro simples pelo celular
            </li>
            <li className="flex items-center gap-3">
              <Route aria-hidden className="size-5 text-violet-300" />
              Motoristas e gestão conectados
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck aria-hidden className="size-5 text-violet-300" />
              Histórico organizado e rastreável
            </li>
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-violet-200">
          <Check aria-hidden className="size-4" />
          Menos papel. Mais controle da operação.
        </p>
      </section>

      <section className={`${estilos.acesso} bg-fundo flex flex-col px-6 py-7 sm:px-10 lg:px-16`}>
        <Link
          href="/apresentacao"
          className="text-texto-suave flex min-h-11 w-fit items-center gap-2 rounded text-sm hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Conheça o projeto
        </Link>
        <div
          className={`${estilos.formulario} mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10`}
        >
          <header className="mb-8">
            <MarcaBordo className="mb-7 size-12 lg:hidden" />
            <p className="text-texto-suave mb-2 text-xs font-medium tracking-[0.12em]">
              BEM-VINDO AO BORDO
            </p>
            <h1 className="text-texto text-3xl font-semibold tracking-tight">Vamos começar?</h1>
            <p className="text-texto-suave mt-3 text-sm leading-relaxed">
              Entre com seu CPF e senha para acessar sua rotina.
            </p>
          </header>

          <FormularioLogin retorno={retornoEhSeguro(retorno) ? retorno : undefined} />

          <aside className="border-borda bg-superficie mt-8 rounded-xl border p-5">
            <p className="text-texto text-sm font-semibold">Quer explorar o projeto?</p>
            <p className="text-texto-suave mt-1 text-xs leading-relaxed">
              Conheça a solução e experimente uma demonstração com dados fictícios.
            </p>
            <Link
              href="/apresentacao#demonstracao"
              className="text-primaria mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
            >
              Explorar demonstração
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </aside>
        </div>
        <p className="text-texto-suave text-center text-xs">Bordo · Diário de bordo digital</p>
      </section>
    </main>
  );
}
