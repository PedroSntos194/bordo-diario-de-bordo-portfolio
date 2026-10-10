import { History } from 'lucide-react';
import { historico } from '@/modulos/auditoria/auditoria.consulta';
import {
  ROTULO_DA_ACAO,
  compararValores,
  formatarValorDaTrilha,
  rotularCampo,
  type AcaoDaTrilha,
} from '@/modulos/auditoria/auditoria.regras';
import { formatarDataHora } from '@/utilitarios/data';

/**
 * Histórico de alterações de um registro (US041 · RF039 · RN026).
 *
 * Componente de servidor, para ser encaixado no detalhe de jornada, corrida,
 * usuário, veículo e rota — cinco telas, uma implementação. A alternativa seria
 * repetir a mesma consulta e a mesma marcação em cada uma, e vê-las divergirem
 * na primeira vez que alguém melhorasse só uma.
 *
 * Não recebe os dados por propriedade: consulta sozinho. Assim a tela que o usa
 * não precisa saber que a trilha existe, nem carregar dado que talvez ninguém
 * vá abrir.
 */
interface Propriedades {
  entidade: string;
  entidadeId: string;
  /** Título, para quando o histórico não é o único bloco da tela. */
  titulo?: string;
}

export async function HistoricoDoRegistro({
  entidade,
  entidadeId,
  titulo = 'Histórico de alterações',
}: Propriedades) {
  const resultado = await historico({ entidade, entidadeId });

  // Falha ao ler a trilha não derruba a tela do registro: o histórico é
  // complemento, e o dado principal continua acessível (RNF015).
  if (!resultado.sucesso) return null;

  const entradas = resultado.dados;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-texto flex items-center gap-2 text-sm font-semibold">
        <History aria-hidden className="text-texto-suave size-4" />
        {titulo}
      </h2>

      {entradas.length === 0 ? (
        <p className="border-borda text-texto-suave rounded-[--radius-padrao] border border-dashed p-3 text-sm">
          Nenhuma alteração desde a criação.
        </p>
      ) : (
        <ol className="border-borda flex flex-col gap-0 border-l pl-4">
          {entradas.map((entrada) => {
            const campos = compararValores(entrada.valorAnterior, entrada.valorNovo);

            return (
              <li key={entrada.id} className="relative py-3">
                <span
                  aria-hidden
                  className="bg-primaria absolute top-4 -left-[1.35rem] size-2 rounded-full"
                />

                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-texto text-sm font-medium">
                    {ROTULO_DA_ACAO[entrada.acao as AcaoDaTrilha] ?? entrada.acao}
                  </span>
                  <span className="text-texto-suave text-xs">
                    {entrada.usuario?.nome ?? 'Sistema'} · {formatarDataHora(entrada.ocorridoEm)}
                  </span>
                </div>

                {entrada.justificativa ? (
                  <p className="text-texto border-atencao/30 bg-atencao-suave mt-1.5 rounded-[--radius-padrao] border px-2 py-1 text-xs italic">
                    “{entrada.justificativa}”
                  </p>
                ) : null}

                {campos.length > 0 ? (
                  <dl className="mt-1.5 flex flex-col gap-0.5 text-xs">
                    {campos.map((campo) => (
                      <div key={campo.campo} className="flex flex-wrap gap-x-2">
                        <dt className="text-texto-suave">{rotularCampo(campo.campo)}:</dt>
                        <dd className="text-texto">
                          <span className="text-texto-suave line-through">
                            {formatarValorDaTrilha(campo.anterior)}
                          </span>
                          {' → '}
                          <strong className="font-medium">
                            {formatarValorDaTrilha(campo.novo)}
                          </strong>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
