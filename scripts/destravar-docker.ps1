<#
.SYNOPSIS
  Destrava o Docker Desktop quando ele se recusa a subir por sockets órfãos.

.DESCRIPTION
  Sintoma: o Docker Desktop abre, mostra "An unexpected error occurred" com as
  opções Quit e "Reset to factory defaults", e o `docker info` responde

      failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine

  No log (`%LOCALAPPDATA%\Docker\log\host\monitor.log`) aparece algo como

      initializing Ingest server: ... remove .../sailor-ingest.sock:
      The file cannot be accessed by the system

  Causa: ao ser encerrado sem desligar direito — máquina suspensa, processo
  morto — o Docker deixa para trás arquivos de socket AF_UNIX que são
  **reparse points** cujo objeto de trás já não existe. O Windows não consegue
  abri-los nem apagá-los, nem com o prefixo de caminho estendido `\\?\`, e o
  Docker trava tentando removê-los na subida.

  Não adianta "Reset to factory defaults": isso apaga imagens e volumes e não
  toca no problema.

  Solução: **renomear os diretórios que os contêm**. Renomear funciona onde
  apagar não funciona, e o Docker recria tudo limpo na próxima subida. Os
  diretórios antigos ficam com sufixo `.orfao-<carimbo>` e somem sozinhos num
  reinício do Windows.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\destravar-docker.ps1
#>

$ErrorActionPreference = 'Stop'

Write-Host '==> Encerrando processos do Docker' -ForegroundColor Cyan
Get-Process '*docker*' -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "    $($_.Name) (PID $($_.Id))"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 5

$carimbo = Get-Date -Format yyyyMMddHHmmss
$diretorios = @(
  "$env:LOCALAPPDATA\Docker\run",
  "$env:LOCALAPPDATA\docker-secrets-engine"
)

Write-Host '==> Afastando sockets órfãos' -ForegroundColor Cyan
foreach ($d in $diretorios) {
  if (-not (Test-Path $d)) {
    Write-Host "    (não existe) $d"
    continue
  }
  try {
    Rename-Item -LiteralPath $d -NewName "$(Split-Path $d -Leaf).orfao-$carimbo" -ErrorAction Stop
    Write-Host "    renomeado: $(Split-Path $d -Leaf)" -ForegroundColor Green
  } catch {
    Write-Host "    FALHOU: $d - $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host '==> Subindo o Docker Desktop' -ForegroundColor Cyan
Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

Write-Host '==> Aguardando o daemon (até 5 min)' -ForegroundColor Cyan
$limite = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $limite) {
  docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host '    daemon pronto' -ForegroundColor Green
    docker version --format 'cliente {{.Client.Version}} - servidor {{.Server.Version}}'
    exit 0
  }
  Start-Sleep -Seconds 5
}

Write-Host '    daemon não respondeu em 5 min.' -ForegroundColor Red
Write-Host '    Veja o erro atual com:' -ForegroundColor Yellow
Write-Host '      Get-Content "$env:LOCALAPPDATA\Docker\log\host\monitor.log" -Tail 200 |' -ForegroundColor Yellow
Write-Host '        Select-String "GET /error" | Select-Object -Last 1' -ForegroundColor Yellow
exit 1
