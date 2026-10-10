import type { Metadata } from 'next';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';
import { AJUDAS_DO_MOTORISTA } from '@/modulos/ajuda/ajuda.regras';

export const metadata: Metadata = { title: 'Ajuda do motorista' };

export default function PaginaAjuda() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-texto text-2xl font-semibold">Ajuda do motorista</h1>
      <p className="text-texto-suave text-sm">
        Escolha o que precisa fazer. Use o celular com a van parada.
      </p>
      {AJUDAS_DO_MOTORISTA.map((ajuda) => (
        <div key={ajuda.chave} id={ajuda.chave} className="scroll-mt-4">
          <AjudaNaTela titulo={ajuda.titulo} passos={[...ajuda.passos]} />
        </div>
      ))}
    </div>
  );
}
