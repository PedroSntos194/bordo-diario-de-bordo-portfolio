'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { mudarStatusVeiculo } from '@/modulos/veiculo/veiculo.acoes';
import type { Veiculo } from '@/modulos/veiculo/veiculo.repositorio';
import { formatarPlaca } from '@/utilitarios/placa';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarDataHora } from '@/utilitarios/data';

/** Listagem de veículos (T21 · US011). Tabela no desktop, cartões no celular. */

const STATUS = {
  ATIVO: { rotulo: 'Ativo', tom: 'sucesso' as const },
  MANUTENCAO: { rotulo: 'Em manutenção', tom: 'atencao' as const },
  INATIVO: { rotulo: 'Inativo', tom: 'neutro' as const },
};

export function TabelaVeiculos({
  veiculos,
  destacadoId,
}: {
  veiculos: Veiculo[];
  destacadoId?: string;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [alvo, setAlvo] = useState<{ veiculo: Veiculo; novoStatus: Veiculo['status'] } | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);

  function confirmar(): void {
    if (!alvo) return;
    setErro(null);

    iniciar(async () => {
      const resultado = await mudarStatusVeiculo({ id: alvo.veiculo.id, status: alvo.novoStatus });
      setAlvo(null);

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      <div className="border-borda hidden overflow-hidden rounded-[--radius-padrao] border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Veículos cadastrados</caption>
          <thead className="bg-superficie border-borda border-b">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Placa
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Modelo
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Lugares
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Odômetro
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((veiculo) => (
              <tr
                key={veiculo.id}
                className={`border-borda border-b last:border-0 ${veiculo.id === destacadoId ? 'bg-sucesso-suave' : ''}`}
              >
                <td className="text-texto px-4 py-3 font-mono font-medium">
                  {formatarPlaca(veiculo.placa)}
                  <span className="text-texto-suave mt-1 block font-sans text-xs font-normal">
                    {formatarDataHora(veiculo.criadoEm)} ·{' '}
                    {veiculo.nomeCriador ?? 'Autor não informado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {veiculo.modelo}
                  {veiculo.marca ? (
                    <span className="text-texto-suave block text-xs">{veiculo.marca}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">{veiculo.capacidadePassageiros}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {formatarOdometro(veiculo.odometroAtual)} km
                </td>
                <td className="px-4 py-3">
                  <Etiqueta tom={STATUS[veiculo.status].tom}>
                    {STATUS[veiculo.status].rotulo}
                  </Etiqueta>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/veiculos/${veiculo.id}`}
                      aria-label={`Editar ${veiculo.placa}`}
                      className="text-texto-suave hover:bg-superficie flex size-9 items-center justify-center rounded-[--radius-padrao]"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Link>
                    <SeletorDeStatus veiculo={veiculo} aoEscolher={setAlvo} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {veiculos.map((veiculo) => (
          <li
            key={veiculo.id}
            className={`border-borda flex flex-col gap-2 rounded-[--radius-padrao] border p-3 ${veiculo.id === destacadoId ? 'bg-sucesso-suave' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-texto font-mono font-medium">{formatarPlaca(veiculo.placa)}</p>
                <p className="text-texto-suave text-sm">{veiculo.modelo}</p>
              </div>
              <Etiqueta tom={STATUS[veiculo.status].tom}>{STATUS[veiculo.status].rotulo}</Etiqueta>
            </div>
            <p className="text-texto-suave text-xs">
              {veiculo.capacidadePassageiros} lugares · {formatarOdometro(veiculo.odometroAtual)} km
            </p>
            <p className="text-texto-suave text-xs">
              Cadastrada em {formatarDataHora(veiculo.criadoEm)} ·{' '}
              {veiculo.nomeCriador ?? 'Autor não informado'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/veiculos/${veiculo.id}`}
                className="text-primaria min-h-[--spacing-toque] text-sm font-medium"
              >
                Editar
              </Link>
              <SeletorDeStatus veiculo={veiculo} aoEscolher={setAlvo} />
            </div>
          </li>
        ))}
      </ul>

      {alvo ? (
        <ModalConfirmacao
          aberto
          titulo="Alterar status do veículo"
          descricao={
            <>
              A van <strong className="text-texto">{formatarPlaca(alvo.veiculo.placa)}</strong>{' '}
              passará para <strong className="text-texto">{STATUS[alvo.novoStatus].rotulo}</strong>.
              {alvo.novoStatus !== 'ATIVO'
                ? ' Ela deixará de aparecer para os motoristas ao abrir a jornada.'
                : ' Ela voltará a aparecer na abertura de jornada.'}
            </>
          }
          rotuloConfirmar="Alterar status"
          processando={processando}
          aoConfirmar={confirmar}
          aoCancelar={() => setAlvo(null)}
        />
      ) : null}
    </div>
  );
}

function SeletorDeStatus({
  veiculo,
  aoEscolher,
}: {
  veiculo: Veiculo;
  aoEscolher: (alvo: { veiculo: Veiculo; novoStatus: Veiculo['status'] }) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="sr-only">Status de {veiculo.placa}</span>
      <select
        value={veiculo.status}
        onChange={(evento) =>
          aoEscolher({ veiculo, novoStatus: evento.target.value as Veiculo['status'] })
        }
        className="border-borda bg-fundo text-texto min-h-9 rounded-[--radius-padrao] border px-2 text-sm"
      >
        <option value="ATIVO">Ativo</option>
        <option value="MANUTENCAO">Em manutenção</option>
        <option value="INATIVO">Inativo</option>
      </select>
    </label>
  );
}
