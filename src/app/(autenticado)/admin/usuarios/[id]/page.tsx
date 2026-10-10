import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { EtiquetaDeStatus } from '@/componentes/ui/etiqueta';
import { FormularioUsuario } from '@/modulos/usuario/componentes/formulario-usuario';
import { obter } from '@/modulos/usuario/usuario.servico';
import { CodigoErro } from '@/lib/erros';
import { formatarDataHora } from '@/utilitarios/data';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { HistoricoDoRegistro } from '@/modulos/auditoria/componentes/historico-do-registro';

export const metadata: Metadata = { title: 'Editar usuário' };

/** T20 — Edição de usuário (doc 10 · US005). */
export default async function PaginaEditarUsuario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await obter({ id });

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const usuario = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/usuarios" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para usuários
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-texto text-2xl font-semibold">{usuario.nome}</h1>
          <EtiquetaDeStatus status={usuario.status} />
        </div>

        <p className="text-texto-suave text-sm">
          Cadastrado em {formatarDataHora(usuario.criadoEm)}
          {usuario.ultimoLoginEm
            ? ` · último acesso em ${formatarDataHora(usuario.ultimoLoginEm)}`
            : ' · nunca acessou'}
          {usuario.deveTrocarSenha ? ' · senha temporária pendente de troca' : ''}
        </p>
      </div>

      <FormularioUsuario
        podeEditarCpf={usuario.podeEditarCpf}
        valoresIniciais={{
          id: usuario.id,
          nome: usuario.nome,
          cpf: usuario.cpf,
          telefone: usuario.telefone,
          perfil: usuario.perfil,
          matricula: usuario.matricula ?? '',
          email: usuario.email ?? '',
          cnhNumero: usuario.cnhNumero ?? '',
          cnhCategoria: usuario.cnhCategoria ?? '',
          // O input `type="date"` exige AAAA-MM-DD.
          cnhValidade: usuario.cnhValidade ? usuario.cnhValidade.toISOString().slice(0, 10) : '',
        }}
      />

      <HistoricoDoRegistro entidade="usuario" entidadeId={id} />
    </div>
  );
}
