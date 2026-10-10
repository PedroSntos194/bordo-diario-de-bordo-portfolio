'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Fuel } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { registrarAbastecimento } from '@/modulos/abastecimento/abastecimento.acoes';
import {
  ROTULO_DO_COMBUSTIVEL,
  TIPOS_DE_COMBUSTIVEL,
  unidadeDoCombustivel,
  type TipoDeCombustivel,
} from '@/modulos/abastecimento/abastecimento.regras';
import { formatarOdometro } from '@/utilitarios/numero';

/**
 * Registro de abastecimento (T-Abastecimento · US024 · RF021).
 *
 * O motorista está no posto, com a nota na mão. Os campos seguem a ordem em que
 * a informação aparece para ele: o painel da van (odômetro), a bomba (litros) e
 * a nota (valor). Posto é o último e é opcional — perguntar o nome do posto
 * antes dos números seria trocar a ordem do mundo real pela ordem do banco.
 */
interface Propriedades {
  placa: string;
  odometroAtual: number;
}

export function FormularioAbastecimento({ placa, odometroAtual }: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [odometro, setOdometro] = useState('');
  const [litros, setLitros] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<TipoDeCombustivel>('DIESEL');
  const [posto, setPosto] = useState('');
  const [tanqueCheio, setTanqueCheio] = useState<boolean | null>(null);

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [aviso, setAviso] = useState<string | null>(null);

  /** "58,4" e "58.4" chegam iguais ao servidor. */
  const comoNumero = (texto: string): string => texto.replace(',', '.');

  function enviar(): void {
    setErroGeral(null);
    setErrosDeCampo({});
    setAviso(null);
    if (tanqueCheio === null) {
      setErrosDeCampo({ tanqueCheio: 'Responda se completou o tanque.' });
      return;
    }

    iniciar(async () => {
      const resultado = await registrarAbastecimento({
        odometro,
        litros: comoNumero(litros),
        valorTotal: valor === '' ? null : comoNumero(valor),
        tipoCombustivel: tipo,
        posto,
        tanqueCheio,
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      setAviso('Abastecimento registrado.');
      setOdometro('');
      setLitros('');
      setValor('');
      setPosto('');
      setTanqueCheio(null);
      router.refresh();
    });
  }

  const unidade = unidadeDoCombustivel(tipo);

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar();
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}
      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      <div className="border-borda bg-superficie flex items-center gap-3 rounded-[--radius-padrao] border p-3">
        <Fuel aria-hidden className="text-texto-suave size-5 shrink-0" />
        <div>
          <p className="text-texto-suave text-xs">Van do seu dia</p>
          <p className="text-texto font-mono font-medium">{placa}</p>
        </div>
      </div>

      <CampoTexto
        rotulo="Odômetro do painel"
        value={odometro}
        onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        erro={errosDeCampo.odometro}
        disabled={enviando}
        required
        inputMode="numeric"
        className="text-2xl"
        placeholder="000000"
        ajuda="Número total do painel. Exemplo: 125.430 km → digite 125430."
        referencia={`Último valor registrado: ${formatarOdometro(odometroAtual)} km`}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-texto mb-2 text-sm font-medium">Combustível</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_DE_COMBUSTIVEL.map((opcao) => (
            <label
              key={opcao}
              className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-4 ${
                tipo === opcao ? 'border-primaria bg-primaria-suave' : 'border-borda'
              }`}
            >
              <input
                type="radio"
                name="combustivel"
                value={opcao}
                checked={tipo === opcao}
                onChange={() => setTipo(opcao)}
                disabled={enviando}
                className="size-4"
              />
              <span className="text-texto text-sm">{ROTULO_DO_COMBUSTIVEL[opcao]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <CampoTexto
        rotulo={`Quanto abasteceu (${unidade})`}
        value={litros}
        onChange={(evento) => setLitros(evento.target.value.replace(/[^\d,.]/g, '').slice(0, 7))}
        erro={errosDeCampo.litros}
        disabled={enviando}
        required
        inputMode="decimal"
        placeholder="0,00"
        referencia="Como está na bomba."
      />

      <fieldset className="flex flex-col gap-2" aria-describedby="ajuda-tanque-cheio">
        <legend className="text-texto mb-2 text-sm font-medium">Encheu o tanque? *</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { valor: true, rotulo: 'Sim, completei o tanque' },
            { valor: false, rotulo: 'Não, abasteci só uma parte' },
          ].map((opcao) => (
            <label
              key={String(opcao.valor)}
              className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-3 ${tanqueCheio === opcao.valor ? 'border-primaria bg-primaria-suave' : 'border-borda'}`}
            >
              <input
                type="radio"
                name="tanque-cheio"
                checked={tanqueCheio === opcao.valor}
                onChange={() => setTanqueCheio(opcao.valor)}
                disabled={enviando}
                required
                className="size-4"
              />
              <span className="text-texto text-sm">{opcao.rotulo}</span>
            </label>
          ))}
        </div>
        <p id="ajuda-tanque-cheio" className="text-texto-suave text-xs">
          Essa informação permite calcular o consumo corretamente.
        </p>
        {errosDeCampo.tanqueCheio ? (
          <p role="alert" className="text-erro text-xs">
            {errosDeCampo.tanqueCheio}
          </p>
        ) : null}
      </fieldset>

      <CampoTexto
        rotulo="Valor pago (R$)"
        value={valor}
        onChange={(evento) => setValor(evento.target.value.replace(/[^\d,.]/g, '').slice(0, 9))}
        erro={errosDeCampo.valorTotal}
        disabled={enviando}
        inputMode="decimal"
        placeholder="0,00"
        referencia="Opcional."
      />

      <CampoTexto
        rotulo="Posto"
        value={posto}
        onChange={(evento) => setPosto(evento.target.value)}
        erro={errosDeCampo.posto}
        disabled={enviando}
        placeholder="Nome do posto"
        referencia="Opcional."
      />

      <Botao
        type="submit"
        tamanho="grande"
        carregando={enviando}
        rotuloCarregando="Registrando…"
        disabled={odometro === '' || litros === '' || tanqueCheio === null}
      >
        Registrar abastecimento
      </Botao>
    </form>
  );
}
