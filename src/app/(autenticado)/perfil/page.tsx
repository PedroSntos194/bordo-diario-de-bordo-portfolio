import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SeletorDeTema } from '@/componentes/layout/seletor-de-tema';
import { COOKIE_DO_TEMA, lerTema } from '@/utilitarios/tema';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { meuPerfil } from '@/modulos/usuario/usuario.servico';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { EtiquetaDeStatus } from '@/componentes/ui/etiqueta';
import { FormularioTrocaSenha } from '@/modulos/autenticacao/componentes/formulario-troca-senha';
import { formatarCpf } from '@/utilitarios/cpf';
import { formatarTelefone } from '@/utilitarios/telefone';
import { formatarData, formatarDataHora } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Meu perfil' };

/**
 * T13 — Meu perfil (doc 10 · US009).
 *
 * O CPF aparece completo aqui, e não mascarado: o titular tem direito de ver o
 * próprio dado (RN029, RNF008). O mascaramento existe para listagens, onde os
 * dados são de terceiros.
 */
export default async function PaginaPerfil() {
  const sessao = await obterUsuarioDaSessao();
  if (!sessao) redirect('/login');
  // Mesmas pendências dos layouts das áreas: esta tela fica fora deles.
  if (sessao.deveTrocarSenha) redirect('/trocar-senha');
  if (!sessao.aceitouPrivacidade) redirect('/privacidade/aceite');

  const resultado = await meuPerfil();

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const perfil = resultado.dados;
  const voltar = perfil.perfil === 'ADMIN' ? '/admin' : '/app';
  const tema = lerTema((await cookies()).get(COOKIE_DO_TEMA)?.value);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-2">
        <Link href={voltar} className="text-texto-suave text-sm">
          ← Voltar
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-texto text-2xl font-semibold">Meu perfil</h1>
          <EtiquetaDeStatus status={perfil.status} />
        </div>
      </div>

      <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <h2 className="text-texto text-sm font-semibold">Meus dados</h2>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Dado rotulo="Nome" valor={perfil.nome} />
          <Dado rotulo="CPF" valor={formatarCpf(perfil.cpf)} />
          <Dado rotulo="Telefone" valor={formatarTelefone(perfil.telefone)} />
          <Dado rotulo="Perfil" valor={perfil.perfil === 'ADMIN' ? 'Administrador' : 'Motorista'} />
          {perfil.matricula ? <Dado rotulo="Matrícula" valor={perfil.matricula} /> : null}
          {perfil.email ? <Dado rotulo="E-mail" valor={perfil.email} /> : null}
          {perfil.cnhNumero ? (
            <Dado
              rotulo="CNH"
              valor={`${perfil.cnhNumero}${perfil.cnhCategoria ? ` · ${perfil.cnhCategoria}` : ''}${
                perfil.cnhValidade ? ` · válida até ${formatarData(perfil.cnhValidade)}` : ''
              }`}
            />
          ) : null}
          <Dado
            rotulo="Último acesso"
            valor={perfil.ultimoLoginEm ? formatarDataHora(perfil.ultimoLoginEm) : '—'}
          />
        </dl>

        <p className="text-texto-suave text-xs">
          Encontrou algo errado? Procure o administrador — toda correção fica registrada.
        </p>
      </section>

      <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
        <div>
          <h2 className="text-texto text-sm font-semibold">Trocar minha senha</h2>
          <p className="text-texto-suave text-xs">
            Ao trocar, as sessões abertas em outros aparelhos serão encerradas.
          </p>
        </div>

        <FormularioTrocaSenha primeiroAcesso={false} destino="/perfil" />
      </section>

      <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
        <div>
          <h2 className="text-texto text-sm font-semibold">Aparência da tela</h2>
          <p className="text-texto-suave text-xs">
            No sol, a tela clara costuma ser mais fácil de ler. Vale só para este aparelho.
          </p>
        </div>

        <SeletorDeTema inicial={tema} />
      </section>

      <p className="text-texto-suave text-center text-xs">
        <Link href="/privacidade/aceite" className="underline">
          Aviso de privacidade
        </Link>
      </p>
    </main>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-texto-suave text-xs">{rotulo}</dt>
      <dd className="text-texto">{valor}</dd>
    </div>
  );
}
