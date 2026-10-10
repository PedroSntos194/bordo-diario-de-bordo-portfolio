'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { ROTULO_DA_CATEGORIA } from '@/modulos/fechamento/fechamento.regras';
import { salvarContratoDaVan } from '@/modulos/veiculo/veiculo.acoes';
import { CATEGORIAS_DE_MEDICAO } from '@/modulos/veiculo/veiculo.schema';
import type { ContratoDaTela } from '@/modulos/veiculo/veiculo.servico';

const reais = (valor: number | null): string =>
  valor === null
    ? ''
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const soDinheiro = (texto: string): string => texto.replace(/[^\d,.]/g, '').slice(0, 13);

/**
 * Contrato da van com o cliente (pedido de 07/10): é dele que o boletim de
 * medição tira o valor do dia, do km excedido e do dia extra. Tudo opcional —
 * o que faltar aparece como pendência na tela do fechamento.
 */
export function FormularioContrato({ contrato }: { contrato: ContratoDaTela }) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const [cliente, setCliente] = useState(contrato.cliente ?? '');
  const [categoria, setCategoria] = useState<string>(contrato.categoriaMedicao ?? '');
  const [valorMensal, setValorMensal] = useState(reais(contrato.valorMensal));
  const [valorKm, setValorKm] = useState(reais(contrato.valorKmExcedido));
  const [valorDiaExtra, setValorDiaExtra] = useState(reais(contrato.valorDiaExtra));
  const [limiteKm, setLimiteKm] = useState(
    contrato.limiteKmDia === null ? '' : String(contrato.limiteKmDia),
  );
  const [origem, setOrigem] = useState(contrato.linhaOrigem ?? '');
  const [destino, setDestino] = useState(contrato.linhaDestino ?? '');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [aviso, setAviso] = useState<string | null>(null);

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});
    setAviso(null);

    iniciar(async () => {
      const resultado = await salvarContratoDaVan({
        id: contrato.id,
        cliente,
        categoriaMedicao: categoria,
        valorMensal,
        valorKmExcedido: valorKm,
        valorDiaExtra,
        limiteKmDia: limiteKm,
        linhaOrigem: origem,
        linhaDestino: destino,
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }
      setAviso('Contrato salvo. O próximo fechamento já usa estes valores.');
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-xl flex-col gap-4" aria-labelledby="titulo-contrato">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-contrato" className="text-texto text-lg font-semibold">
          Contrato com o cliente
        </h2>
        <p className="text-texto-suave text-sm">
          Usado no boletim de medição. O valor do dia é o mensal dividido pelos dias úteis
          configurados.
        </p>
      </div>

      <form onSubmit={tratarEnvio} className="flex flex-col gap-4" noValidate>
        {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}
        {aviso ? (
          <p
            role="status"
            className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
          >
            {aviso}
          </p>
        ) : null}

        <CampoTexto
          rotulo="Cliente"
          value={cliente}
          onChange={(evento) => setCliente(evento.target.value)}
          erro={errosDeCampo.cliente}
          disabled={salvando}
          maxLength={60}
          placeholder="Ex.: Consórcio da obra"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-categoria" className="text-texto text-sm font-medium">
            Categoria no boletim
          </label>
          <select
            id="campo-categoria"
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
            disabled={salvando}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="">Não informada</option>
            {CATEGORIAS_DE_MEDICAO.map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULO_DA_CATEGORIA[opcao]}
              </option>
            ))}
          </select>
          {errosDeCampo.categoriaMedicao ? (
            <p className="text-erro text-sm">{errosDeCampo.categoriaMedicao}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            rotulo="Valor mensal (R$)"
            value={valorMensal}
            onChange={(evento) => setValorMensal(soDinheiro(evento.target.value))}
            erro={errosDeCampo.valorMensal}
            disabled={salvando}
            inputMode="decimal"
            placeholder="0,00"
          />
          <CampoTexto
            rotulo="Dia extra (R$)"
            value={valorDiaExtra}
            onChange={(evento) => setValorDiaExtra(soDinheiro(evento.target.value))}
            erro={errosDeCampo.valorDiaExtra}
            disabled={salvando}
            inputMode="decimal"
            placeholder="0,00"
            ajuda="Sábado, domingo ou feriado."
          />
          <CampoTexto
            rotulo="Km excedido (R$ por km)"
            value={valorKm}
            onChange={(evento) => setValorKm(soDinheiro(evento.target.value))}
            erro={errosDeCampo.valorKmExcedido}
            disabled={salvando}
            inputMode="decimal"
            placeholder="0,00"
          />
          <CampoTexto
            rotulo="Km incluídos por dia"
            value={limiteKm}
            onChange={(evento) => setLimiteKm(evento.target.value.replace(/\D/g, '').slice(0, 4))}
            erro={errosDeCampo.limiteKmDia}
            disabled={salvando}
            inputMode="numeric"
            ajuda="Vazio usa o limite das configurações."
          />
          <CampoTexto
            rotulo="Linha — origem"
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value)}
            erro={errosDeCampo.linhaOrigem}
            disabled={salvando}
            maxLength={80}
          />
          <CampoTexto
            rotulo="Linha — destino"
            value={destino}
            onChange={(evento) => setDestino(evento.target.value)}
            erro={errosDeCampo.linhaDestino}
            disabled={salvando}
            maxLength={80}
          />
        </div>

        <div className="pt-1">
          <Botao type="submit" carregando={salvando}>
            Salvar contrato
          </Botao>
        </div>
      </form>
    </section>
  );
}
