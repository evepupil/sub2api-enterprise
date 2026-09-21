# 快照目录管理：每个来源各自一套目录，只保留「本次」和「上次」。
# 关键约束：新快照必须先完整落到暂存目录并通过校验，才允许顶掉旧快照，
# 否则一次半截的传输就会把唯一一份好备份冲掉。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-SnapshotSlotName {
    # 按保留份数生成槽位名：2 份就是 current / previous，更多份往后排。
    param([Parameter(Mandatory)][int]$Retain)
    if ($Retain -lt 1) { throw "保留份数至少为 1，当前是 $Retain" }
    $names = @('current')
    if ($Retain -ge 2) { $names += 'previous' }
    for ($i = 3; $i -le $Retain; $i++) { $names += "previous-$($i - 1)" }
    return $names
}

function Get-SnapshotPath {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$SourceName
    )
    $base = Join-Path $Root $SourceName
    return @{
        Base     = $base
        Current  = Join-Path $base 'current'
        Previous = Join-Path $base 'previous'
        Staging  = Join-Path $base '.staging'
    }
}

function Reset-StagingDirectory {
    # 暂存目录每轮重建，避免上一轮失败留下的半截文件混进这一轮。
    param([Parameter(Mandatory)][string]$Path)
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Recurse -Force }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    return $Path
}

function Test-FileChecksum {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$ExpectedSha256
    )
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    return ($actual -ieq $ExpectedSha256.Trim())
}

function Complete-SnapshotRotation {
    <#
        把暂存目录提升为最新快照，旧的依次后移，超出保留份数的删掉。
        暂存目录为空时直接报错，不做任何轮转。
    #>
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$SourceName,
        [int]$Retain = 2
    )

    $paths = Get-SnapshotPath -Root $Root -SourceName $SourceName
    if (-not (Test-Path -LiteralPath $paths.Staging)) { throw "暂存目录不存在，拒绝轮转：$($paths.Staging)" }
    if (@(Get-ChildItem -LiteralPath $paths.Staging -File).Count -eq 0) { throw "暂存目录是空的，拒绝轮转：$($paths.Staging)" }

    $slots = Get-SnapshotSlotName -Retain $Retain
    $slotPaths = @($slots | ForEach-Object { Join-Path $paths.Base $_ })

    $oldest = $slotPaths[-1]
    if ($slotPaths.Count -gt 1 -and (Test-Path -LiteralPath $oldest)) {
        Remove-Item -LiteralPath $oldest -Recurse -Force
    }
    for ($i = $slotPaths.Count - 1; $i -ge 1; $i--) {
        $from = $slotPaths[$i - 1]
        $to = $slotPaths[$i]
        if (Test-Path -LiteralPath $from) { Move-Item -LiteralPath $from -Destination $to }
    }
    if ($slotPaths.Count -eq 1 -and (Test-Path -LiteralPath $slotPaths[0])) {
        Remove-Item -LiteralPath $slotPaths[0] -Recurse -Force
    }
    Move-Item -LiteralPath $paths.Staging -Destination $paths.Current
    return $paths.Current
}

Export-ModuleMember -Function Get-SnapshotSlotName, Get-SnapshotPath, Reset-StagingDirectory, Test-FileChecksum, Complete-SnapshotRotation
