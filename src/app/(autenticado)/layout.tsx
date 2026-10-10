import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { RelatorDeErros } from '@/modulos/suporte/componentes/relator-de-erros';

/**
 * Segunda camada de proteção (doc 13 · RF041).
 *
 * O `middleware.ts` roda no Edge e só consegue ver se o cookie existe. **Aqui**
 * a sessão é validada de verdade contra o banco: token existente, não expirado
 * e usuário ainda ATIVO. É o que faz o bloqueio de um motorista surtir efeito
 * imediato (RN006), mesmo com o cookie ainda no navegador dele.
 *
 * Este layout exige apenas sessão. As pendências de troca de senha e de aceite
 * de privacidade são verificadas nos layouts de cada área — se fossem checadas
 * aqui, as próprias telas de resolver essas pendências entrariam em laço de
 * redirecionamento.
 *
 * O relator de erros do aparelho também mora aqui: vale para as duas áreas e
 * para as telas de pendência, e só existe onde há sessão para dizer de quem é o
 * aparelho.
 */
export default async function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) redirect('/login');

  return (
    <>
      <RelatorDeErros versao={env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null} />
      {children}
    </>
  );
}
