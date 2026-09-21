# 同步日志：统一写一份带时间戳的文本日志，并按行数截断，避免长期运行把文件撑爆。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:LogFilePath = $null
$script:MaxLogLines = 5000

function Initialize-SyncLog {
    param(
        [Parameter(Mandatory)][string]$Path,
        [int]$MaxLines = 5000
    )
    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $script:LogFilePath = $Path
    $script:MaxLogLines = $MaxLines
}

function Write-SyncLog {
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO',
        [string]$Scope = 'sync'
    )
    $line = '{0} [{1}] [{2}] {3}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Scope, $Message
    switch ($Level) {
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'WARN'  { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line }
    }
    if ($script:LogFilePath) {
        Add-Content -LiteralPath $script:LogFilePath -Value $line -Encoding UTF8
    }
}

function Compress-SyncLog {
    # 日志超过上限时只保留最近的部分，防止无限增长。
    if (-not $script:LogFilePath -or -not (Test-Path -LiteralPath $script:LogFilePath)) { return }
    $lines = @(Get-Content -LiteralPath $script:LogFilePath)
    if ($lines.Count -le $script:MaxLogLines) { return }
    $kept = $lines[($lines.Count - $script:MaxLogLines)..($lines.Count - 1)]
    Set-Content -LiteralPath $script:LogFilePath -Value $kept -Encoding UTF8
}

Export-ModuleMember -Function Initialize-SyncLog, Write-SyncLog, Compress-SyncLog
