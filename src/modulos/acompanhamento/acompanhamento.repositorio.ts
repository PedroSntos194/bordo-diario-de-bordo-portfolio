import type { ClientePrisma } from '@/lib/prisma';
import { comoDataIso } from '@/utilitarios/data';

/** Retrato mínimo: nenhum CPF, telefone, hash ou token sai desta consulta. */
export async function consultarMotoristas(cliente: ClientePrisma, dia: string) {
  const data = new Date(`${dia}T00:00:00Z`);
  const [usuarios, jornadas] = await Promise.all([
    cliente.usuario.findMany({
      where: { perfil: 'MOTORISTA', status: { not: 'EXCLUIDO' } },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        status: true,
        ultimoLoginEm: true,
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: true,
        bloqueadoAte: true,
        aceites: { select: { versaoTexto: true } },
        escalas: { where: { data }, select: { id: true } },
        folgas: { where: { data, ativa: true }, select: { id: true } },
        jornadas: {
          where: { status: { not: 'CANCELADA' } },
          orderBy: { iniciadaEm: 'asc' },
          take: 1,
          select: { id: true, iniciadaEm: true },
        },
        _count: {
          select: {
            jornadas: {
              where: {
                status: { not: 'CANCELADA' },
                corridas: { some: { status: 'ENCERRADA', encerradaEm: { not: null } } },
              },
            },
          },
        },
      },
    }),
    cliente.jornada.findMany({
      where: {
        motorista: { perfil: 'MOTORISTA', status: { not: 'EXCLUIDO' } },
        status: { not: 'CANCELADA' },
        OR: [{ data }, { data: { lt: data }, status: 'ABERTA' }],
      },
      orderBy: [{ data: 'desc' }, { iniciadaEm: 'desc' }],
      select: {
        id: true,
        motoristaId: true,
        data: true,
        status: true,
        iniciadaEm: true,
        encerradaEm: true,
        // A van do dia: o painel de presença diz "começou às 05:52 na ABC-1234".
        veiculo: { select: { placa: true } },
        corridas: { select: { status: true, encerradaEm: true } },
      },
    }),
  ]);

  return usuarios.map((usuario) => {
    const doMotorista = jornadas.filter((jornada) => jornada.motoristaId === usuario.id);
    const jornadaDoDia = doMotorista.find((jornada) => comoDataIso(jornada.data) === dia);
    const jornadaAnteriorAberta = doMotorista.find(
      (jornada) => comoDataIso(jornada.data) < dia && jornada.status === 'ABERTA',
    );
    return {
      id: usuario.id,
      nome: usuario.nome,
      status: usuario.status,
      ultimoLoginEm: usuario.ultimoLoginEm,
      deveTrocarSenha: usuario.deveTrocarSenha,
      senhaTemporariaExpiraEm: usuario.senhaTemporariaExpiraEm,
      bloqueadoAte: usuario.bloqueadoAte,
      versoesAceitas: usuario.aceites.map((aceite) => aceite.versaoTexto),
      escalado: usuario.escalas.length > 0,
      deFolga: usuario.folgas.length > 0,
      primeiraJornadaEm: usuario.jornadas[0]?.iniciadaEm ?? null,
      possuiCorridaConcluida: usuario._count.jornadas > 0,
      jornadaDoDia: jornadaDoDia ? { ...jornadaDoDia, data: comoDataIso(jornadaDoDia.data) } : null,
      jornadaAnteriorAberta: jornadaAnteriorAberta
        ? { id: jornadaAnteriorAberta.id, data: comoDataIso(jornadaAnteriorAberta.data) }
        : null,
    };
  });
}
