import type { Metadata } from 'next';
import Link from 'next/link';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';
import {
  AJUDAS_DA_ADMINISTRACAO,
  ROTEIRO_TREINAMENTO_ADMINISTRACAO,
  ROTINA_DIARIA_DA_ADMINISTRACAO,
} from '@/modulos/ajuda/ajuda-admin.regras';

export const metadata: Metadata = { title: 'Ajuda da administração' };

export default function PaginaAjudaDaAdministracao() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Ajuda da administração</h1>
        <p className="text-texto-suave mt-1 text-sm">
          Aprenda a acompanhar acessos, viagens e o fechamento do dia. Use a conferência diária
          durante a implantação.
        </p>
      </div>
      <Link
        href="/admin/motoristas"
        className="bg-primaria inline-flex min-h-[--spacing-toque] items-center justify-center self-start rounded-[--radius-padrao] px-4 text-sm font-medium text-white"
      >
        Abrir Situação dos motoristas
      </Link>
      <section aria-labelledby="treinamento-admin" className="flex flex-col gap-3">
        <h2 id="treinamento-admin" className="text-texto text-lg font-semibold">
          Treinamento de 15 minutos
        </h2>
        <p className="text-texto-suave text-sm">
          Faça a demonstração usando consultas e registros existentes. Altere senhas, escalas e
          viagens apenas quando houver uma necessidade real.
        </p>
        <ol className="flex flex-col gap-3">
          {ROTEIRO_TREINAMENTO_ADMINISTRACAO.map((etapa) => (
            <li key={etapa.tempo} className="border-borda rounded-[--radius-padrao] border p-4">
              <p className="text-primaria text-xs font-medium">{etapa.tempo}</p>
              <h3 className="text-texto mt-1 font-semibold">{etapa.titulo}</h3>
              <ul className="text-texto mt-2 list-disc space-y-2 pl-5 text-sm">
                {etapa.passos.map((passo) => (
                  <li key={passo}>{passo}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="conferencia-diaria" className="flex flex-col gap-3">
        <h2 id="conferencia-diaria" className="text-texto text-lg font-semibold">
          Rotina de conferência diária
        </h2>
        <p className="text-texto-suave text-sm">
          Confira a data em cada tela. Durante os primeiros dias, acompanhe a primeira utilização
          completa de cada motorista e anote as dúvidas para o próximo treinamento.
        </p>
        {ROTINA_DIARIA_DA_ADMINISTRACAO.map((momento) => (
          <div key={momento.titulo} className="border-borda rounded-[--radius-padrao] border p-4">
            <h3 className="text-texto font-semibold">{momento.titulo}</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
              {momento.passos.map((passo) => (
                <li key={passo.texto}>
                  <Link href={passo.href} className="text-primaria underline">
                    {passo.texto}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
      <section aria-labelledby="ajuda-por-tela" className="flex flex-col gap-2">
        <h2 id="ajuda-por-tela" className="text-texto text-lg font-semibold">
          Como usar cada tela
        </h2>
        {AJUDAS_DA_ADMINISTRACAO.map((ajuda) => (
          <AjudaNaTela key={ajuda.chave} titulo={ajuda.titulo} passos={[...ajuda.passos]} />
        ))}
      </section>
    </div>
  );
}
