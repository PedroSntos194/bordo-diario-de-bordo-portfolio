import type { Metadata } from 'next';
import { ModoSemConexao } from '@/modulos/sincronizacao/componentes/modo-sem-conexao';

export const metadata: Metadata = { title: 'Sem conexão' };

/**
 * Modo sem conexão (US025 · RF022).
 *
 * A página é uma casca: **todo** o conteúdo vem de um Client Component que lê o
 * aparelho, e isso é intencional. Esta é a única tela do sistema que precisa
 * renderizar com o servidor inalcançável — se ela dependesse de qualquer dado
 * vindo do servidor na renderização, seria a primeira a falhar exatamente
 * quando é a única que importa.
 *
 * É também a tela que o service worker guarda e serve como queda para toda
 * navegação de `/app` sem rede.
 */
export default function PaginaSemConexao() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Modo sem conexão</h1>
        <p className="text-texto-suave text-sm">
          Registre agora; o envio acontece quando o sinal voltar.
        </p>
      </div>

      <ModoSemConexao />
    </div>
  );
}
