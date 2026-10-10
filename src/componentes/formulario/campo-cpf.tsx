'use client';

import type { ChangeEvent } from 'react';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { aplicarMascaraCpf } from '@/utilitarios/cpf';

/**
 * Campo de CPF com máscara progressiva.
 *
 * `inputMode="numeric"` abre o teclado numérico no celular — o motorista digita
 * isso de pé, na porta da van, e o teclado alfabético é um obstáculo real.
 *
 * O valor segue para o servidor com máscara; a normalização acontece no schema
 * Zod, do lado do servidor, que é onde ela precisa ser confiável.
 */
interface PropriedadesCampoCpf {
  nome: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  erro?: string;
  autoFocus?: boolean;
  desabilitado?: boolean;
}

export function CampoCpf({
  nome,
  valor,
  aoAlterar,
  erro,
  autoFocus,
  desabilitado,
}: PropriedadesCampoCpf) {
  function tratarMudanca(evento: ChangeEvent<HTMLInputElement>): void {
    aoAlterar(aplicarMascaraCpf(evento.target.value));
  }

  return (
    <CampoTexto
      name={nome}
      rotulo="CPF"
      value={valor}
      onChange={tratarMudanca}
      erro={erro}
      required
      autoFocus={autoFocus}
      disabled={desabilitado}
      inputMode="numeric"
      autoComplete="username"
      placeholder="000.000.000-00"
      maxLength={14}
    />
  );
}
