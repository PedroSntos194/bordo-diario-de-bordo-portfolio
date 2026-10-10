'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type SyntheticEvent } from 'react';
import { MoreVertical, Pencil } from 'lucide-react';
import { EtiquetaDeStatus } from '@/componentes/ui/etiqueta';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalSenhaTemporaria } from '@/modulos/usuario/componentes/modal-senha-temporaria';
import { mudarStatusUsuario, redefinirSenhaUsuario } from '@/modulos/usuario/usuario.acoes';
import type { UsuarioDaListagem } from '@/modulos/usuario/usuario.repositorio';
import { mascararCpf } from '@/utilitarios/cpf';
import { formatarTelefone } from '@/utilitarios/telefone';
import { formatarDataHora } from '@/utilitarios/data';

/**
 * Listagem de usuários (T19 · US006, US007, US008).
 *
 * No desktop é tabela; abaixo de 768 px vira cartões — tabela de 6 colunas em
 * tela de celular obriga a rolagem horizontal, que o doc 11 proíbe.
 *
 * O CPF aparece mascarado (RN029). O valor completo só na tela de detalhe.
 */

type AcaoPendente = {
  tipo: 'BLOQUEAR' | 'DESATIVAR' | 'EXCLUIR' | 'REATIVAR' | 'REDEFINIR';
  usuario: UsuarioDaListagem;
} | null;

const TEXTOS_DE_CONFIRMACAO = {
  BLOQUEAR: {
    titulo: 'Bloquear usuário',
    verbo: 'Bloquear',
    consequencia: 'perderá o acesso imediatamente e as sessões abertas serão encerradas.',
    destrutiva: false,
    status: 'BLOQUEADO' as const,
  },
  DESATIVAR: {
    titulo: 'Desativar usuário',
    verbo: 'Desativar',
    consequencia:
      'deixará de acessar o sistema, mas continuará aparecendo nos registros históricos.',
    destrutiva: false,
    status: 'INATIVO' as const,
  },
  EXCLUIR: {
    titulo: 'Excluir usuário',
    verbo: 'Excluir usuário',
    consequencia:
      'sairá das listagens e perderá o acesso. Os registros de jornada dele continuam preservados, com o nome mantido.',
    destrutiva: true,
    status: 'EXCLUIDO' as const,
  },
  REATIVAR: {
    titulo: 'Reativar usuário',
    verbo: 'Reativar',
    consequencia: 'voltará a acessar o sistema com a senha atual.',
    destrutiva: false,
    status: 'ATIVO' as const,
  },
} as const;

export function TabelaUsuarios({ usuarios }: { usuarios: UsuarioDaListagem[] }) {
  const router = useRouter();
  const [processando, iniciarProcessamento] = useTransition();

  const [acao, setAcao] = useState<AcaoPendente>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  function confirmar(): void {
    if (!acao) return;
    setErro(null);

    iniciarProcessamento(async () => {
      if (acao.tipo === 'REDEFINIR') {
        const resultado = await redefinirSenhaUsuario({ id: acao.usuario.id });
        setAcao(null);

        if (!resultado.sucesso) {
          setErro(resultado.erro.mensagem);
          return;
        }
        setSenhaGerada({
          nome: acao.usuario.nome,
          senha: resultado.dados.senhaTemporaria,
        });
        return;
      }

      const resultado = await mudarStatusUsuario({
        id: acao.usuario.id,
        status: TEXTOS_DE_CONFIRMACAO[acao.tipo].status,
      });
      setAcao(null);

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      router.refresh();
    });
  }

  const confirmacao = acao && acao.tipo !== 'REDEFINIR' ? TEXTOS_DE_CONFIRMACAO[acao.tipo] : null;

  return (
    <div className="flex flex-col gap-4">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      {/* Desktop */}
      <div className="border-borda hidden overflow-hidden rounded-[--radius-padrao] border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Usuários cadastrados</caption>
          <thead className="bg-superficie border-borda border-b">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Nome
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                CPF
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Perfil
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Último acesso
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-borda border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="text-texto font-medium">{usuario.nome}</span>
                  {usuario.matricula ? (
                    <span className="text-texto-suave block text-xs">
                      Matrícula {usuario.matricula}
                    </span>
                  ) : null}
                </td>
                <td className="text-texto-suave px-4 py-3 font-mono text-xs">
                  {mascararCpf(usuario.cpf)}
                </td>
                <td className="px-4 py-3">
                  {usuario.perfil === 'ADMIN' ? 'Administrador' : 'Motorista'}
                </td>
                <td className="px-4 py-3">
                  <EtiquetaDeStatus status={usuario.status} />
                </td>
                <td className="text-texto-suave px-4 py-3 text-xs">
                  {usuario.ultimoLoginEm ? formatarDataHora(usuario.ultimoLoginEm) : 'Nunca'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/usuarios/${usuario.id}`}
                      aria-label={`Editar ${usuario.nome}`}
                      className="text-texto-suave hover:bg-superficie flex size-9 items-center justify-center rounded-[--radius-padrao]"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Link>
                    <MenuDeAcoes usuario={usuario} aoEscolher={setAcao} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular e tablet */}
      <ul className="flex flex-col gap-3 md:hidden">
        {usuarios.map((usuario) => (
          <li
            key={usuario.id}
            className="border-borda flex flex-col gap-2 rounded-[--radius-padrao] border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-texto truncate font-medium">{usuario.nome}</p>
                <p className="text-texto-suave font-mono text-xs">{mascararCpf(usuario.cpf)}</p>
              </div>
              <EtiquetaDeStatus status={usuario.status} />
            </div>

            <p className="text-texto-suave text-xs">
              {usuario.perfil === 'ADMIN' ? 'Administrador' : 'Motorista'} ·{' '}
              {formatarTelefone(usuario.telefone)}
            </p>

            <p className="text-texto-suave text-xs">
              Último acesso:{' '}
              {usuario.ultimoLoginEm ? formatarDataHora(usuario.ultimoLoginEm) : 'Nunca'}
            </p>

            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/usuarios/${usuario.id}`}
                className="text-primaria min-h-[--spacing-toque] text-sm font-medium"
              >
                Editar
              </Link>
              <MenuDeAcoes usuario={usuario} aoEscolher={setAcao} />
            </div>
          </li>
        ))}
      </ul>

      {confirmacao ? (
        <ModalConfirmacao
          aberto
          titulo={confirmacao.titulo}
          descricao={
            <>
              <strong className="text-texto">{acao?.usuario.nome}</strong>{' '}
              {confirmacao.consequencia}
            </>
          }
          rotuloConfirmar={confirmacao.verbo}
          destrutiva={confirmacao.destrutiva}
          processando={processando}
          aoConfirmar={confirmar}
          aoCancelar={() => setAcao(null)}
        />
      ) : null}

      {acao?.tipo === 'REDEFINIR' ? (
        <ModalConfirmacao
          aberto
          titulo="Redefinir senha"
          descricao={
            <>
              Será gerada uma nova senha temporária para{' '}
              <strong className="text-texto">{acao.usuario.nome}</strong>. A senha atual deixará de
              funcionar e as sessões abertas serão encerradas.
            </>
          }
          rotuloConfirmar="Gerar nova senha"
          processando={processando}
          aoConfirmar={confirmar}
          aoCancelar={() => setAcao(null)}
        />
      ) : null}

      <ModalSenhaTemporaria
        aberto={senhaGerada !== null}
        nomeDoUsuario={senhaGerada?.nome ?? ''}
        senha={senhaGerada?.senha ?? ''}
        aoFechar={() => {
          setSenhaGerada(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/** Folga entre o botão e o menu, e entre o menu e a borda da janela. */
const FOLGA_DO_MENU = 4;

/**
 * Menu de ações por linha.
 *
 * Feito com `<details>` nativo: teclado, `Esc` e leitor de tela funcionam sem
 * nenhuma reimplementação de foco.
 *
 * O menu é **fixo na janela**, não absoluto na linha. A tabela fica numa caixa
 * com `overflow-hidden` para os cantos arredondados, e um menu absoluto era
 * cortado por ela: na primeira linha só se viam duas das quatro ações, e na
 * última o menu inteiro sumia. Fixo, ele escapa do recorte; a posição sai do
 * botão na hora de abrir, para cima quando não cabe embaixo. Rolar a página
 * fecha o menu — um menu fixo ficaria parado enquanto a linha sai de baixo dele.
 */
function MenuDeAcoes({
  usuario,
  aoEscolher,
}: {
  usuario: UsuarioDaListagem;
  aoEscolher: (acao: AcaoPendente) => void;
}) {
  const inativo = usuario.status !== 'ATIVO';
  const excluido = usuario.status === 'EXCLUIDO';

  const detalhes = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ top: number; right: number } | null>(null);

  function aoAlternar(evento: SyntheticEvent<HTMLDetailsElement>): void {
    const altura = menu.current?.offsetHeight ?? 0;
    if (!evento.currentTarget.open || altura === 0) {
      setPosicao(null);
      return;
    }

    const botao = evento.currentTarget.getBoundingClientRect();
    const cabeEmbaixo = botao.bottom + FOLGA_DO_MENU + altura <= window.innerHeight;
    setPosicao({
      top: cabeEmbaixo
        ? botao.bottom + FOLGA_DO_MENU
        : Math.max(FOLGA_DO_MENU, botao.top - FOLGA_DO_MENU - altura),
      right: window.innerWidth - botao.right,
    });
  }

  useEffect(() => {
    if (!posicao) return;

    function fechar(): void {
      if (detalhes.current) detalhes.current.open = false;
    }

    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [posicao]);

  function escolher(tipo: NonNullable<AcaoPendente>['tipo']): void {
    aoEscolher({ tipo, usuario });
    // Fecha o menu depois da escolha.
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((elemento) => {
      elemento.open = false;
    });
  }

  return (
    <details ref={detalhes} onToggle={aoAlternar}>
      <summary
        aria-label={`Mais ações para ${usuario.nome}`}
        className="text-texto-suave hover:bg-superficie flex size-9 cursor-pointer list-none items-center justify-center rounded-[--radius-padrao]"
      >
        <MoreVertical aria-hidden className="size-4" />
      </summary>

      <div
        ref={menu}
        style={posicao ?? undefined}
        className={`border-borda bg-fundo fixed z-50 flex w-52 flex-col rounded-[--radius-padrao] border py-1 shadow-lg ${posicao ? '' : 'invisible'}`}
      >
        {!excluido ? (
          <button
            type="button"
            onClick={() => escolher('REDEFINIR')}
            className="hover:bg-superficie px-3 py-2 text-left text-sm"
          >
            Redefinir senha
          </button>
        ) : null}

        {inativo ? (
          <button
            type="button"
            onClick={() => escolher('REATIVAR')}
            className="hover:bg-superficie px-3 py-2 text-left text-sm"
          >
            Reativar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => escolher('BLOQUEAR')}
              className="hover:bg-superficie px-3 py-2 text-left text-sm"
            >
              Bloquear
            </button>
            <button
              type="button"
              onClick={() => escolher('DESATIVAR')}
              className="hover:bg-superficie px-3 py-2 text-left text-sm"
            >
              Desativar
            </button>
          </>
        )}

        {!excluido ? (
          <button
            type="button"
            onClick={() => escolher('EXCLUIR')}
            className="text-erro hover:bg-erro-suave px-3 py-2 text-left text-sm"
          >
            Excluir
          </button>
        ) : null}
      </div>
    </details>
  );
}
