import type { ClientePrisma } from '@/lib/prisma';
import type { EstadoDeTentativas } from '@/modulos/usuario/usuario.regras';

/**
 * Acesso a dados de usuário.
 *
 * Regra do projeto (doc 00 · §5): este é um dos poucos arquivos autorizados a
 * chamar o Prisma. Nenhuma tela, ação ou serviço toca no banco diretamente.
 *
 * Todas as funções recebem o cliente por parâmetro para poderem participar da
 * transação aberta em `acao-segura.ts`.
 */

/** Campos mínimos para decidir um login — nada além do necessário. */
export async function buscarPorCpfParaLogin(cliente: ClientePrisma, cpf: string) {
  return cliente.usuario.findFirst({
    where: { cpf, status: { not: 'EXCLUIDO' } },
    select: {
      id: true,
      nome: true,
      cpf: true,
      perfil: true,
      status: true,
      senhaHash: true,
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: true,
      tentativasLogin: true,
      bloqueadoAte: true,
      aceites: { select: { versaoTexto: true } },
    },
  });
}

export type UsuarioDeLogin = NonNullable<Awaited<ReturnType<typeof buscarPorCpfParaLogin>>>;

/**
 * Persiste o contador de tentativas após uma falha (RN003).
 *
 * Chamado **fora** de transação de propósito: a falha de login termina com uma
 * exceção, e uma transação desfeita levaria o contador junto — o bloqueio
 * nunca aconteceria.
 */
export async function registrarFalhaDeLogin(
  cliente: ClientePrisma,
  usuarioId: string,
  estado: EstadoDeTentativas,
): Promise<void> {
  await cliente.usuario.update({
    where: { id: usuarioId },
    data: {
      tentativasLogin: estado.tentativasLogin,
      bloqueadoAte: estado.bloqueadoAte,
    },
  });
}

export async function registrarLoginBemSucedido(
  cliente: ClientePrisma,
  usuarioId: string,
  agora: Date,
): Promise<void> {
  await cliente.usuario.update({
    where: { id: usuarioId },
    data: { tentativasLogin: 0, bloqueadoAte: null, ultimoLoginEm: agora },
  });
}

/** Dados necessários para validar a política de senha (RN004). */
export async function buscarParaTrocaDeSenha(cliente: ClientePrisma, usuarioId: string) {
  return cliente.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      cpf: true,
      matricula: true,
      senhaHash: true,
      deveTrocarSenha: true,
    },
  });
}

export async function atualizarSenha(
  cliente: ClientePrisma,
  usuarioId: string,
  senhaHash: string,
): Promise<void> {
  await cliente.usuario.update({
    where: { id: usuarioId },
    data: {
      senhaHash,
      deveTrocarSenha: false,
      senhaTemporariaExpiraEm: null,
      tentativasLogin: 0,
      bloqueadoAte: null,
      atualizadoPor: usuarioId,
    },
  });
}

/** Usado por RN010 — impedir a remoção do último administrador. */
export async function contarAdministradoresAtivos(cliente: ClientePrisma): Promise<number> {
  return cliente.usuario.count({ where: { perfil: 'ADMIN', status: 'ATIVO' } });
}

// ---------------------------------------------------------------- listagem

/** Colunas exibidas na listagem (T19). O hash de senha nunca entra aqui. */
const CAMPOS_DE_LISTAGEM = {
  id: true,
  nome: true,
  cpf: true,
  telefone: true,
  matricula: true,
  perfil: true,
  status: true,
  ultimoLoginEm: true,
  criadoEm: true,
} as const;

export type UsuarioDaListagem = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  matricula: string | null;
  perfil: 'ADMIN' | 'MOTORISTA';
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO' | 'EXCLUIDO';
  ultimoLoginEm: Date | null;
  criadoEm: Date;
};

export interface FiltrosDeUsuario {
  busca?: string | undefined;
  perfil?: 'ADMIN' | 'MOTORISTA' | undefined;
  status?: 'ATIVO' | 'INATIVO' | 'BLOQUEADO' | 'EXCLUIDO' | undefined;
  ordenar: 'nome' | 'criadoEm' | 'ultimoLoginEm';
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

function montarFiltro(filtros: FiltrosDeUsuario) {
  const busca = filtros.busca?.trim();

  return {
    // Excluídos só aparecem quando pedidos explicitamente: a exclusão é lógica,
    // mas para o administrador ela precisa se comportar como exclusão (RN006).
    ...(filtros.status ? { status: filtros.status } : { status: { not: 'EXCLUIDO' as const } }),
    ...(filtros.perfil ? { perfil: filtros.perfil } : {}),
    ...(busca && busca.length >= 2
      ? {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' as const } },
            // A busca por CPF aceita o que a pessoa digitou, com ou sem máscara.
            { cpf: { contains: busca.replace(/\D/g, '') } },
            { matricula: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export async function listarUsuarios(
  cliente: ClientePrisma,
  filtros: FiltrosDeUsuario,
): Promise<{ usuarios: UsuarioDaListagem[]; total: number }> {
  const where = montarFiltro(filtros);

  const [usuarios, total] = await Promise.all([
    cliente.usuario.findMany({
      where,
      select: CAMPOS_DE_LISTAGEM,
      orderBy: { [filtros.ordenar]: filtros.direcao },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.usuario.count({ where }),
  ]);

  return { usuarios, total };
}

/** Total de usuários não excluídos — distingue "sem cadastro" de "sem resultado". */
export async function contarUsuarios(cliente: ClientePrisma): Promise<number> {
  return cliente.usuario.count({ where: { status: { not: 'EXCLUIDO' } } });
}

// ------------------------------------------------------------------- CRUD

export async function buscarPorId(cliente: ClientePrisma, id: string) {
  return cliente.usuario.findUnique({
    where: { id },
    select: {
      ...CAMPOS_DE_LISTAGEM,
      email: true,
      cnhNumero: true,
      cnhCategoria: true,
      cnhValidade: true,
      deveTrocarSenha: true,
      excluidoEm: true,
    },
  });
}

export type UsuarioDetalhado = NonNullable<Awaited<ReturnType<typeof buscarPorId>>>;

/**
 * Existe outro usuário não excluído com este CPF?
 *
 * A verificação serve para a mensagem amigável; a garantia real é o índice
 * único parcial `usuario_cpf_ativo_unico` (RN002), que é o que segura duas
 * requisições simultâneas.
 */
export async function existeOutroComCpf(
  cliente: ClientePrisma,
  cpf: string,
  ignorarId?: string,
): Promise<boolean> {
  const encontrado = await cliente.usuario.findFirst({
    where: {
      cpf,
      status: { not: 'EXCLUIDO' },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: { id: true },
  });

  return encontrado !== null;
}

export interface DadosDeCriacao {
  nome: string;
  cpf: string;
  telefone: string;
  perfil: 'ADMIN' | 'MOTORISTA';
  matricula: string | null;
  email: string | null;
  cnhNumero: string | null;
  cnhCategoria: string | null;
  cnhValidade: Date | null;
  senhaHash: string;
  senhaTemporariaExpiraEm: Date;
  criadoPor: string;
}

export async function criarUsuario(cliente: ClientePrisma, dados: DadosDeCriacao) {
  return cliente.usuario.create({
    data: { ...dados, deveTrocarSenha: true, status: 'ATIVO' },
    select: CAMPOS_DE_LISTAGEM,
  });
}

export interface DadosDeEdicao {
  nome: string;
  cpf?: string;
  telefone: string;
  perfil: 'ADMIN' | 'MOTORISTA';
  matricula: string | null;
  email: string | null;
  cnhNumero: string | null;
  cnhCategoria: string | null;
  cnhValidade: Date | null;
  atualizadoPor: string;
}

export async function atualizarUsuario(cliente: ClientePrisma, id: string, dados: DadosDeEdicao) {
  return cliente.usuario.update({
    where: { id },
    data: dados,
    select: CAMPOS_DE_LISTAGEM,
  });
}

export async function alterarStatus(
  cliente: ClientePrisma,
  id: string,
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO' | 'EXCLUIDO',
  atualizadoPor: string,
): Promise<void> {
  await cliente.usuario.update({
    where: { id },
    data: {
      status,
      excluidoEm: status === 'EXCLUIDO' ? new Date() : null,
      // Reativar precisa limpar o bloqueio por tentativas, senão a pessoa volta
      // ao sistema e continua barrada por um contador antigo (RN003).
      ...(status === 'ATIVO' ? { tentativasLogin: 0, bloqueadoAte: null } : {}),
      atualizadoPor,
    },
  });
}

export async function definirSenhaTemporaria(
  cliente: ClientePrisma,
  id: string,
  senhaHash: string,
  expiraEm: Date,
  atualizadoPor: string,
): Promise<void> {
  await cliente.usuario.update({
    where: { id },
    data: {
      senhaHash,
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: expiraEm,
      tentativasLogin: 0,
      bloqueadoAte: null,
      atualizadoPor,
    },
  });
}

/**
 * O usuário já tem registros operacionais?
 *
 * Define duas coisas: se o CPF ainda pode ser corrigido (US005) e se a exclusão
 * pode ser física — que nunca é, quando há histórico com a autoria dele.
 */
export async function possuiRegistrosOperacionais(
  cliente: ClientePrisma,
  id: string,
): Promise<boolean> {
  const jornadas = await cliente.jornada.count({ where: { motoristaId: id } });
  return jornadas > 0;
}

/** Dados exibidos em "Meu perfil" (US009). */
export async function buscarPerfil(cliente: ClientePrisma, id: string) {
  return cliente.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      cpf: true,
      telefone: true,
      email: true,
      matricula: true,
      perfil: true,
      status: true,
      ultimoLoginEm: true,
      criadoEm: true,
      cnhNumero: true,
      cnhCategoria: true,
      cnhValidade: true,
    },
  });
}

/**
 * Quais destes CPFs e matrículas já existem (US015).
 *
 * Uma consulta para o lote inteiro, e não `existeOutroComCpf` numa laço: com
 * sessenta linhas seriam sessenta idas ao banco dentro da mesma transação.
 *
 * A verificação **precede** as inserções por um motivo que não é de
 * desempenho: no PostgreSQL, um erro dentro da transação a deixa abortada, e
 * qualquer comando seguinte falha. Tentar inserir e capturar a violação levaria
 * junto todas as linhas boas — o oposto exato da RN032.
 */
export async function chavesJaCadastradas(
  cliente: ClientePrisma,
  cpfs: string[],
  matriculas: string[],
): Promise<{ cpfs: Set<string>; matriculas: Set<string> }> {
  const encontrados = await cliente.usuario.findMany({
    where: {
      status: { not: 'EXCLUIDO' },
      OR: [
        ...(cpfs.length > 0 ? [{ cpf: { in: cpfs } }] : []),
        ...(matriculas.length > 0 ? [{ matricula: { in: matriculas } }] : []),
      ],
    },
    select: { cpf: true, matricula: true },
  });

  return {
    cpfs: new Set(encontrados.map((usuario) => usuario.cpf)),
    matriculas: new Set(
      encontrados
        .map((usuario) => usuario.matricula)
        .filter((matricula): matricula is string => matricula !== null),
    ),
  };
}
