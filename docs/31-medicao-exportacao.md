# 31 · Medição da exportação e download em fluxo · 02/10/2026

O gerador real de planilhas foi exercitado com páginas de 1.000 corridas
sintéticas. Os nomes, trajetos, datas e observações variam, com identificadores
únicos `BENCH-000001` até `BENCH-200000`, para evitar uma compressão
artificialmente favorável. Nenhum registro foi inserido no banco de produção.

## Resultado local

| Linhas | Geração | Tamanho do XLSX | Pico de RSS |
| ---: | ---: | ---: | ---: |
| 5.001 | 346 ms | 561.608 bytes | 125 MiB |
| 50.000 | 2,52 s | 5.580.111 bytes | 275 MiB |
| 200.000 | 13,89 s | 22.256.120 bytes | 409 MiB |

São medições na máquina do desenvolvedor, com Node 24. Os arquivos foram
reabertos em fluxo: duas abas, cabeçalhos, todas as marcas em sequência,
datas e números com os tipos corretos, km e SHA-256 conferidos. Os dados vêm
de um iterador sintético, com uma passagem pelo I/O entre páginas.

Esse ensaio mede a montagem do XLSX, CPU, memória e arquivo temporário.
Leitura das páginas no Neon, fila, `after()`, gravação no R2 e latência de
download precisam de medições próprias em ambiente isolado completo.

## Download e duração das funções

O conjunto de 50.000 linhas já supera 4,5 MB. A rota antiga de download
devolvia o corpo inteiro com `content-length`. A
[documentação da Vercel](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
orienta usar resposta em fluxo para arquivos acima do limite de corpo.

A rota `/api/arquivos/{id}/download` agora envia blocos de 64 KiB, depois
da mesma autorização, com cache privado e sem uma segunda cópia completa
do arquivo. O teste de download confere o SHA-256 de mais de 6 MiB,
incluindo um buffer com deslocamento, e preserva a recusa sem sessão.

As rotas de exportação e cron declaram `maxDuration = 300`.
O [Next 15 documenta](https://nextjs.org/docs/15/app/api-reference/functions/after)
que `after()` usa a duração máxima da rota que o chamou. A fila pode concluir
várias tarefas numa passagem; o tempo do gerador isolado não representa
todo esse lote.

## Medição na Vercel

A branch temporária `codex/medicao-exportacao`, commit `aa258a1`, cria um
preview em `gru1` com o mesmo gerador e colunas do produto. A configuração
usa somente valores fictícios, banco em loopback inacessível, storage local
temporário e cron desativado. A rota de benchmark recusa qualquer ambiente
diferente de `preview` e não será incorporada à branch `main`.

O deploy foi concluído pela Vercel. A chamada automática exigiu a sessão da
conta; Pedro abriu o preview autenticado e forneceu o JSON retornado pela
função. O resultado confirma o commit e o ambiente do ensaio:

| Linhas | Geração | Tamanho do XLSX | Pico de RSS | Node |
| ---: | ---: | ---: | ---: | --- |
| 200.000 | 20,10283 s | 22.256.121 bytes | 414,18 MiB | v24.21.0 |

Foram 200 páginas de 1.000 linhas, todas geradas. CPU: 19,91 s de usuário e
0,84 s de sistema, com 425 amostras de memória. SHA-256 da geração que
respondeu com métricas:

`566cc3c8bf75d3f4fbe83aa268c7f244fddab4e9ec596f1650205340fdc38e76`

O gerador inclui a data/hora de criação do XLSX: uma segunda chamada pode
produzir bytes e hash diferentes. A conferência do download precisa usar
as métricas da própria resposta, ou validar diretamente todas as linhas,
tipos e integridade ZIP do arquivo recebido.

O download em fluxo foi confirmado separadamente: Pedro baixou o arquivo
do preview no navegador autenticado, e a cópia recebida foi conferida
localmente em 02/10/2026. Foram 200.000 registros distintos e em sequência,
dois nomes de abas e todos os cabeçalhos corretos, datas e números tipados e
todos os km conferidos. A integridade CRC de todas as dez entradas do ZIP
também passou. Tamanho recebido: 22.256.121 bytes. SHA-256 do download:

`02f295ab9d7e70979f31dc4b972e19d5cab5fe1d16a0c938c8b925245c261ed7`

Preview preparado:

<https://bordo-exemplo.vercel.app/api/benchmark-exportacao?linhas=200000&modo=metricas>

A rota aceita 5.001, 50.000 ou 200.000 linhas. `modo=metricas` devolve JSON
com duração, CPU, memória, tamanho e hash; `modo=download` entrega o XLSX
em fluxo com as métricas no cabeçalho `x-benchmark-metricas`.
`modo=download-original` reproduz a resposta antiga para comparar a entrega.

Depois de concluir o ensaio, registrar os resultados aqui e remover a branch
temporária e seu preview. O benchmark não fornece um link público para
planilhas reais e não muda o acesso aos arquivos operacionais.
