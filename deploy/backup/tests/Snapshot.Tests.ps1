<#
    快照轮转的单元测试。轮转是这套脚本里唯一会删除已有备份的逻辑，
    出错的代价是丢掉唯一一份好备份，所以单独覆盖。
    直接运行：pwsh -File tests\Snapshot.Tests.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\lib\Snapshot.psm1') -Force

$script:Passed = 0
$script:Failed = 0

function Assert-Equal {
    param($Expected, $Actual, [string]$Because)
    $expectedText = ($Expected | Out-String).Trim()
    $actualText = ($Actual | Out-String).Trim()
    if ($expectedText -eq $actualText) {
        $script:Passed++
        Write-Host "  通过: $Because" -ForegroundColor Green
    } else {
        $script:Failed++
        Write-Host "  失败: $Because" -ForegroundColor Red
        Write-Host "        期望 [$expectedText] 实际 [$actualText]" -ForegroundColor Red
    }
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Because)
    try {
        & $Action
        $script:Failed++
        Write-Host "  失败: $Because（期望抛错但没有）" -ForegroundColor Red
    } catch {
        $script:Passed++
        Write-Host "  通过: $Because" -ForegroundColor Green
    }
}

function New-TestRoot {
    $path = Join-Path ([IO.Path]::GetTempPath()) ("snapshot-test-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}

function New-StagedSnapshot {
    # 造一份带内容的暂存快照，内容用于确认轮转后拿到的是正确那一份。
    param([string]$Root, [string]$SourceName, [string]$Marker)
    $paths = Get-SnapshotPath -Root $Root -SourceName $SourceName
    Reset-StagingDirectory -Path $paths.Staging | Out-Null
    Set-Content -LiteralPath (Join-Path $paths.Staging 'db.dump') -Value $Marker -Encoding UTF8
    return $paths
}

Write-Host "槽位命名"
Assert-Equal -Expected @('current') -Actual (Get-SnapshotSlotName -Retain 1) -Because '保留 1 份时只有 current'
Assert-Equal -Expected @('current', 'previous') -Actual (Get-SnapshotSlotName -Retain 2) -Because '保留 2 份时是 current 和 previous'
Assert-Equal -Expected @('current', 'previous', 'previous-2') -Actual (Get-SnapshotSlotName -Retain 3) -Because '保留 3 份时往后排 previous-2'
Assert-Throws -Action { Get-SnapshotSlotName -Retain 0 } -Because '保留份数为 0 时报错'

Write-Host "轮转：保留本次和上次"
$root = New-TestRoot
try {
    $paths = New-StagedSnapshot -Root $root -SourceName 'demo' -Marker 'first'
    Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 | Out-Null
    Assert-Equal -Expected 'first' -Actual (Get-Content -LiteralPath (Join-Path $paths.Current 'db.dump')) -Because '第一轮后 current 是第一份'
    Assert-Equal -Expected $false -Actual (Test-Path -LiteralPath $paths.Previous) -Because '第一轮后还没有 previous'

    New-StagedSnapshot -Root $root -SourceName 'demo' -Marker 'second' | Out-Null
    Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 | Out-Null
    Assert-Equal -Expected 'second' -Actual (Get-Content -LiteralPath (Join-Path $paths.Current 'db.dump')) -Because '第二轮后 current 是第二份'
    Assert-Equal -Expected 'first' -Actual (Get-Content -LiteralPath (Join-Path $paths.Previous 'db.dump')) -Because '第二轮后 previous 是第一份'

    New-StagedSnapshot -Root $root -SourceName 'demo' -Marker 'third' | Out-Null
    Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 | Out-Null
    Assert-Equal -Expected 'third' -Actual (Get-Content -LiteralPath (Join-Path $paths.Current 'db.dump')) -Because '第三轮后 current 是第三份'
    Assert-Equal -Expected 'second' -Actual (Get-Content -LiteralPath (Join-Path $paths.Previous 'db.dump')) -Because '第三轮后 previous 是第二份'
    Assert-Equal -Expected 2 -Actual (@(Get-ChildItem -LiteralPath $paths.Base -Directory).Count) -Because '始终只有两个快照目录'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}

Write-Host "轮转的安全闸门"
$root = New-TestRoot
try {
    Assert-Throws -Action { Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 } -Because '没有暂存目录时拒绝轮转'

    $paths = Get-SnapshotPath -Root $root -SourceName 'demo'
    Reset-StagingDirectory -Path $paths.Staging | Out-Null
    Assert-Throws -Action { Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 } -Because '暂存目录为空时拒绝轮转'

    New-StagedSnapshot -Root $root -SourceName 'demo' -Marker 'good' | Out-Null
    Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 | Out-Null
    Reset-StagingDirectory -Path $paths.Staging | Out-Null
    try { Complete-SnapshotRotation -Root $root -SourceName 'demo' -Retain 2 | Out-Null } catch { }
    Assert-Equal -Expected 'good' -Actual (Get-Content -LiteralPath (Join-Path $paths.Current 'db.dump')) -Because '空暂存轮转失败后已有快照原样保留'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}

Write-Host "文件校验"
$root = New-TestRoot
try {
    $file = Join-Path $root 'sample.bin'
    Set-Content -LiteralPath $file -Value 'hello' -Encoding UTF8
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    Assert-Equal -Expected $true -Actual (Test-FileChecksum -Path $file -ExpectedSha256 $hash) -Because '校验值一致时通过'
    Assert-Equal -Expected $true -Actual (Test-FileChecksum -Path $file -ExpectedSha256 $hash.ToLower()) -Because '校验值大小写不敏感'
    Assert-Equal -Expected $false -Actual (Test-FileChecksum -Path $file -ExpectedSha256 ('0' * 64)) -Because '校验值不一致时不通过'
    Assert-Equal -Expected $false -Actual (Test-FileChecksum -Path (Join-Path $root 'missing.bin') -ExpectedSha256 $hash) -Because '文件不存在时不通过'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}

Write-Host ""
Write-Host "通过 $script:Passed 项，失败 $script:Failed 项"
if ($script:Failed -gt 0) { exit 1 }
exit 0
