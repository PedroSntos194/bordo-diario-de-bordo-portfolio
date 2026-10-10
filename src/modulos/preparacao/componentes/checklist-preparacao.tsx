import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { consultarPreparacao } from '@/modulos/preparacao/preparacao.servico';
import { formatarDataOperacional } from '@/utilitarios/data';

export async function ChecklistPreparacao({ data }: { data: string }) {
  const resultado = await consultarPreparacao({ data });
  if (!resultado.sucesso)
    return (
      <MensagemErro
        titulo="Não foi possível conferir os cadastros"
        mensagem={resultado.erro.mensagem}
      />
    );
  const dados = resultado.dados;
  const itens = [
    {
      titulo: 'Vans ativas',
      quantidade: dados.veiculos,
      href: '/admin/veiculos',
      acao: 'Cadastrar ou conferir vans',
      detalhe: 'Uma van ativa e disponível permite abrir o dia.',
    },
    {
      titulo: 'Motoristas ativos',
      quantidade: dados.motoristas,
      href: '/admin/usuarios?perfil=MOTORISTA',
      acao: 'Cadastrar ou conferir motoristas',
      detalhe: 'Entregue o acesso pessoal a cada motorista.',
    },
    {
      titulo: 'Rotas ativas',
      quantidade: dados.rotas,
      href: '/admin/rotas',
      acao: 'Cadastrar ou conferir rotas',
      detalhe: 'Rotas cadastradas facilitam o registro. Viagens avulsas continuam disponíveis.',
    },
    {
      titulo: 'Motoristas escalados',
      quantidade: dados.escalados,
      href: `/admin/escala?data=${dados.data}`,
      acao: 'Preparar escala e folgas',
      detalhe: 'Só motoristas escalados e sem folga entram na cobrança de falta de registro.',
    },
  ];
  return (
    <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
      <h2 className="text-texto text-lg font-semibold">Preparação da operação</h2>
      <p className="text-texto-suave text-sm">
        Confira os cadastros e a escala de {formatarDataOperacional(dados.data)}.
      </p>
      <ul className="divide-borda divide-y">
        {itens.map((item) => (
          <li key={item.titulo} className="flex items-start gap-3 py-3">
            {item.quantidade > 0 ? (
              <CheckCircle2 aria-hidden className="text-sucesso mt-1 size-5 shrink-0" />
            ) : (
              <Circle aria-hidden className="text-atencao mt-1 size-5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-texto text-sm font-medium">
                {item.titulo}: {item.quantidade}{' '}
                {item.quantidade === 0 ? '· falta preparar' : '· cadastrado'}
              </p>
              <p className="text-texto-suave text-xs">{item.detalhe}</p>
              <Link
                href={item.href}
                className="text-primaria mt-1 inline-flex min-h-[--spacing-toque] items-center text-sm underline"
              >
                {item.acao}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-texto-suave text-sm">
        {dados.semPrimeiroAcesso > 0
          ? `${dados.semPrimeiroAcesso} motorista(s) ainda precisam trocar a senha temporária. Confira se receberam o acesso.`
          : 'Nenhum motorista ativo tem troca de senha temporária pendente.'}
      </p>
    </section>
  );
}
