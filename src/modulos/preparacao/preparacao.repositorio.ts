import type { ClientePrisma } from '@/lib/prisma';
import { filtroMotoristaEscalado } from '@/modulos/escala/escala.repositorio';

export async function contarPreparacao(cliente: ClientePrisma, dataIso: string) {
  const [veiculos, motoristas, rotas, escalados, semPrimeiroAcesso] = await Promise.all([
    cliente.veiculo.count({ where: { status: 'ATIVO' } }),
    cliente.usuario.count({ where: { perfil: 'MOTORISTA', status: 'ATIVO' } }),
    cliente.rota.count({ where: { status: 'ATIVA' } }),
    cliente.usuario.count({ where: filtroMotoristaEscalado(dataIso) }),
    cliente.usuario.count({
      where: { perfil: 'MOTORISTA', status: 'ATIVO', deveTrocarSenha: true },
    }),
  ]);
  return { veiculos, motoristas, rotas, escalados, semPrimeiroAcesso };
}
