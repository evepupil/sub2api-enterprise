<#
.SYNOPSIS
    把远端 sub2api 数据库定时同步到本机，每个来源只保留本次和上次两份。

.DESCRIPTION
    每个来源的流程固定四步：远端导出 -> 下载 -> 校验 -> 轮转。
    校验不通过就保持旧快照不动，宁可这一轮没有新备份，也不能把已有的好备份弄丢。
    多个来源互不影响，其中一个失败不会中断其他来源。

.EXAMPLE
    pwsh -File sync-db.ps1
    pwsh -File sync-db.ps1 -Only box
#>
[CmdletBinding()]
param(
    [string]$ConfigPath,
    [string[]]$Only,
    [int]$Retries = 4
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'lib\Log.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Config.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Remote.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Snapshot.psm1') -Force

# 远端导出脚本。用占位符而不是字符串插值，避免 PowerShell 变量和 bash 变量混在一起。
$remoteDumpTemplate = @'
set -uo pipefail
NAME="__NAME__"
CONTAINER="__CONTAINER__"
DB_USER="__DB_USER__"
DB_NAME="__DB_NAME__"
WORK="/tmp/sub2api-db-sync/${NAME}"

rm -rf "$WORK"
mkdir -p "$WORK"

DUMP="$WORK/${DB_NAME}.dump"
# 优先用 zstd 压缩（更小更快）；老版本 pg_dump 不支持就退回默认压缩。
if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --compress=zstd:6 > "$DUMP" 2>"$WORK/dump.err"; then
  if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DUMP" 2>"$WORK/dump.err"; then
    echo "DUMP_FAILED=1"
    cat "$WORK/dump.err" >&2
    exit 1
  fi
fi

if [ ! -s "$DUMP" ]; then
  echo "DUMP_EMPTY=1"
  exit 1
fi

echo "WORKDIR=$WORK"
echo "DUMP_NAME=${DB_NAME}.dump"
echo "DUMP_BYTES=$(stat -c %s "$DUMP")"
echo "DUMP_SHA=$(sha256sum "$DUMP" | cut -d" " -f1)"

# 余额明细单独导一份 CSV，不用还原整个库就能直接看用户余额。
# 只取余额相关字段，不导出密码哈希、TOTP 密钥这类敏感列。
CSV="$WORK/users-balance.csv"
BALANCE_SQL="SELECT id, username, email, status, balance, frozen_balance, total_recharged, updated_at FROM users ORDER BY id"
if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --csv -c "$BALANCE_SQL" > "$CSV" 2>"$WORK/csv.err" && [ -s "$CSV" ]; then
  echo "CSV_NAME=users-balance.csv"
  echo "CSV_BYTES=$(stat -c %s "$CSV")"
  echo "CSV_SHA=$(sha256sum "$CSV" | cut -d" " -f1)"
else
  rm -f "$CSV"
  echo "CSV_SKIPPED=1"
fi

runquery() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null | tr -d "[:space:]"
}
echo "USERS=$(runquery "SELECT count(*) FROM users")"
echo "BALANCE_TOTAL=$(runquery "SELECT COALESCE(SUM(balance), 0) FROM users")"
echo "DB_SIZE=$(runquery "SELECT pg_size_pretty(pg_database_size(current_database()))")"
echo "OK=1"
'@

function ConvertFrom-RemoteOutput {
    # 远端按 KEY=VALUE 逐行输出，这里转成哈希表。
    param([Parameter(Mandatory)][string]$Text)
    $result = @{}
    foreach ($line in ($Text -split "`n")) {
        $trimmed = $line.Trim()
        if ($trimmed -match '^([A-Z_]+)=(.*)$') { $result[$Matches[1]] = $Matches[2] }
    }
    return $result
}

function Sync-OneSource {
    param(
        [Parameter(Mandatory)][hashtable]$Source,
        [Parameter(Mandatory)][string]$DestinationRoot,
        [Parameter(Mandatory)][int]$Retain,
        [Parameter(Mandatory)][int]$Retries
    )

    $name = [string]$Source['name']
    $paths = Get-SnapshotPath -Root $DestinationRoot -SourceName $name
    $remoteWork = $null

    Write-SyncLog -Scope $name -Message "开始同步（$(Get-SshTarget -Source $Source)）"
    try {
        $remoteScript = $remoteDumpTemplate `
            -replace '__NAME__', $name `
            -replace '__CONTAINER__', [string]$Source['containerName'] `
            -replace '__DB_USER__', [string]$Source['databaseUser'] `
            -replace '__DB_NAME__', [string]$Source['databaseName']

        $output = Invoke-RemoteBash -Source $Source -Script $remoteScript -Retries $Retries
        $info = ConvertFrom-RemoteOutput -Text $output
        if (-not $info.ContainsKey('OK')) { throw "远端导出未正常结束：$output" }

        $remoteWork = $info['WORKDIR']
        $dumpBytes = [int64]$info['DUMP_BYTES']
        Write-SyncLog -Scope $name -Message "远端导出完成：$([math]::Round($dumpBytes / 1MB, 1)) MB，库大小 $($info['DB_SIZE'])，用户 $($info['USERS']) 个，余额合计 $($info['BALANCE_TOTAL'])"

        $staging = Reset-StagingDirectory -Path $paths.Staging

        $dumpLocal = Join-Path $staging $info['DUMP_NAME']
        Copy-RemoteFile -Source $Source -RemotePath "$remoteWork/$($info['DUMP_NAME'])" -LocalPath $dumpLocal -Retries $Retries
        if (-not (Test-FileChecksum -Path $dumpLocal -ExpectedSha256 $info['DUMP_SHA'])) {
            throw "数据库导出文件校验不通过，本次不轮转，保留原有备份"
        }
        Write-SyncLog -Scope $name -Message "数据库文件下载并校验通过"

        if ($info.ContainsKey('CSV_NAME')) {
            $csvLocal = Join-Path $staging $info['CSV_NAME']
            Copy-RemoteFile -Source $Source -RemotePath "$remoteWork/$($info['CSV_NAME'])" -LocalPath $csvLocal -Retries $Retries
            if (-not (Test-FileChecksum -Path $csvLocal -ExpectedSha256 $info['CSV_SHA'])) {
                Remove-Item -LiteralPath $csvLocal -Force
                Write-SyncLog -Level 'WARN' -Scope $name -Message "余额明细校验不通过，本次快照只保留数据库文件"
            }
        } else {
            Write-SyncLog -Level 'WARN' -Scope $name -Message "余额明细导出失败，本次快照只保留数据库文件"
        }

        $meta = [ordered]@{
            source       = $name
            sshHost      = [string]$Source['sshHost']
            database     = [string]$Source['databaseName']
            capturedAt   = (Get-Date).ToString('o')
            dumpFile     = $info['DUMP_NAME']
            dumpBytes    = $dumpBytes
            dumpSha256   = $info['DUMP_SHA']
            databaseSize = $info['DB_SIZE']
            userCount    = $info['USERS']
            balanceTotal = $info['BALANCE_TOTAL']
        }
        $meta | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $staging 'meta.json') -Encoding UTF8

        $current = Complete-SnapshotRotation -Root $DestinationRoot -SourceName $name -Retain $Retain
        Write-SyncLog -Scope $name -Message "同步完成：$current"
        return $true
    }
    catch {
        Write-SyncLog -Level 'ERROR' -Scope $name -Message "同步失败：$($_.Exception.Message)"
        if (Test-Path -LiteralPath $paths.Staging) { Remove-Item -LiteralPath $paths.Staging -Recurse -Force }
        return $false
    }
    finally {
        # 远端临时文件无论成败都要清掉，避免撑满磁盘。
        if ($remoteWork) {
            try { Invoke-RemoteBash -Source $Source -Script "rm -rf '$remoteWork'" -Retries 2 -TimeoutSeconds 60 | Out-Null }
            catch { Write-SyncLog -Level 'WARN' -Scope $name -Message "远端临时目录清理失败，下轮会自动重建：$remoteWork" }
        }
    }
}

$config = Import-SyncConfig -Path $ConfigPath
$destinationRoot = [string]$config['destinationRoot']
if (-not (Test-Path -LiteralPath $destinationRoot)) {
    New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
}
Initialize-SyncLog -Path (Join-Path $destinationRoot 'sync.log')

# 上一轮还没跑完就直接跳过这一轮，避免两个进程同时动同一批目录。
$mutex = New-Object System.Threading.Mutex($false, 'Global\Sub2ApiDbSync')
if (-not $mutex.WaitOne(0)) {
    Write-SyncLog -Level 'WARN' -Message '上一轮同步仍在进行，本轮跳过'
    exit 0
}

try {
    $sources = @($config['sources'] | Where-Object { $_['enabled'] })
    if ($Only) {
        $sources = @($sources | Where-Object { $Only -contains $_['name'] })
        if ($sources.Count -eq 0) { throw "没有匹配的同步来源：$($Only -join ', ')" }
    }

    $failed = @()
    foreach ($source in $sources) {
        if (-not (Sync-OneSource -Source $source -DestinationRoot $destinationRoot -Retain $config['retainSnapshots'] -Retries $Retries)) {
            $failed += [string]$source['name']
        }
    }

    if ($failed.Count -gt 0) {
        Write-SyncLog -Level 'ERROR' -Message "本轮有来源失败：$($failed -join ', ')"
        exit 1
    }
    Write-SyncLog -Message "本轮全部完成：$(($sources | ForEach-Object { $_['name'] }) -join ', ')"
    exit 0
}
finally {
    Compress-SyncLog
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
