'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { cn } from '@/lib/cn';
import type { ErrosDeCampo } from '@/lib/erros';
import { registrarPedagio } from '@/modulos/pedagio/pedagio.acoes';
import {
  FORMAS_DE_PAGAMENTO,
  ROTULO_DA_FORMA,
  type FormaDePagamento,
} from '@/modulos/pedagio/pedagio.regras';

/**
 * Registro de pedágio no celular (pedido do cliente de 07/10).
 *
 * Três toques: valor, como pagou, registrar. A praça é opcional — ajuda a
 * conferir o recibo, mas não pode virar motivo para o motorista desistir.
 */
export function FormularioPedagio({ placa }: { placa: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [valor, setValor] = useState('');
  const [praca, setPraca] = useState('');
  const [forma, setForma] = useState<FormaDePagamento>('DINHEIRO');
  const [erro, setErro] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [aviso, setAviso] = useState<string | null>(null);

  function registrar(evento: React.FormEvent): void {
    evento.preventDefault();
    setErro(null);
    setErrosDeCampo({});
    setAviso(null);

    iniciar(async () => {
      const resultado = await registrarPedagio({ valor, praca, formaPagamento: forma });
      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        setErro(resultado.erro.mensagem);
        return;
      }
      setValor('');
      setPraca('');
      setAviso('Pedágio registrado.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={registrar} className="flex flex-col gap-4" noValidate>
      <p className="text-texto-suave text-sm">Van {placa}</p>

      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      <CampoTexto
        rotulo="Valor pago (R$)"
        value={valor}
        onChange={(evento) => setValor(evento.target.value.replace(/[^\d,.]/g, '').slice(0, 7))}
        erro={errosDeCampo.valor}
        inputMode="decimal"
        placeholder="0,00"
        required
        disabled={enviando}
      />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-texto mb-1.5 text-sm font-medium">Como pagou</legend>
        <div className="grid grid-cols-3 gap-2">
          {FORMAS_DE_PAGAMENTO.map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={forma === opcao}
              onClick={() => setForma(opcao)}
              disabled={enviando}
              className={cn(
                'min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-sm',
                forma === opcao
                  ? 'border-primaria bg-primaria-suave text-texto font-medium'
                  : 'border-borda text-texto-suave',
              )}
            >
              {ROTULO_DA_FORMA[opcao]}
            </button>
          ))}
        </div>
      </fieldset>

      <CampoTexto
        rotulo="Praça (opcional)"
        value={praca}
        onChange={(evento) => setPraca(evento.target.value)}
        erro={errosDeCampo.praca}
        maxLength={120}
        placeholder="Ex.: Arujá"
        disabled={enviando}
      />

      <Botao type="submit" carregando={enviando} disabled={valor === ''}>
        Registrar pedágio
      </Botao>
    </form>
  );
}
