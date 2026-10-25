<#
    配置加载的单元测试：必填项校验、可选项的默认值（含 useSudo）、来源重名。
    直接运行：pwsh -File tests\Config.Tests.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\lib\Config.psm1') -Force

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

function New-ConfigFile {
    # 把来源列表写成一份临时配置文件，返回路径。
    param([object[]]$Sources)
    $path = Join-Path ([IO.Path]::GetTempPath()) ("db-sync-config-test-" + [Guid]::NewGuid().ToString('N') + '.json')
    $config = @{ destinationRoot = '%TEMP%\db-sync-test'; retainSnapshots = 2; sources = $Sources }
    Set-Content -LiteralPath $path -Value ($config | ConvertTo-Json -Depth 5) -Encoding UTF8
    return $path
}

function New-Source {
    param([string]$Name, [hashtable]$Extra = @{})
    $source = @{ name = $Name; sshHost = 'host-alias'; containerName = 'pg'; databaseUser = 'sub2api'; databaseName = 'sub2api' }
    foreach ($key in $Extra.Keys) { $source[$key] = $Extra[$key] }
    return $source
}

Write-Host "可选项的默认值"
$path = New-ConfigFile -Sources @(
    (New-Source -Name 'plain'),
    (New-Source -Name 'with-sudo' -Extra @{ useSudo = $true }),
    (New-Source -Name 'sudo-off' -Extra @{ useSudo = $false; enabled = $false })
)
try {
    $config = Import-SyncConfig -Path $path
    $byName = @{}
    foreach ($source in $config['sources']) { $byName[$source['name']] = $source }
    Assert-Equal -Expected $false -Actual $byName['plain']['useSudo'] -Because '没写 useSudo 时默认不用 sudo'
    Assert-Equal -Expected $true -Actual $byName['with-sudo']['useSudo'] -Because 'useSudo 为 true 时用 sudo 调 docker'
    Assert-Equal -Expected $false -Actual $byName['sudo-off']['useSudo'] -Because 'useSudo 为 false 时不用 sudo'
    Assert-Equal -Expected $true -Actual $byName['plain']['enabled'] -Because '没写 enabled 时默认启用'
    Assert-Equal -Expected $false -Actual $byName['sudo-off']['enabled'] -Because 'enabled 为 false 时停用'
    Assert-Equal -Expected 2 -Actual $config['retainSnapshots'] -Because '保留份数按配置读取'
    Assert-Equal -Expected $false -Actual ($config['destinationRoot'] -like '*%TEMP%*') -Because '本地目录里的环境变量会展开'
}
finally {
    Remove-Item -LiteralPath $path -Force
}

Write-Host "校验"
$path = New-ConfigFile -Sources @(@{ name = 'broken'; sshHost = 'host-alias' })
try {
    Assert-Throws -Action { Import-SyncConfig -Path $path } -Because '缺必填项时报错'
}
finally {
    Remove-Item -LiteralPath $path -Force
}

$path = New-ConfigFile -Sources @((New-Source -Name 'dup'), (New-Source -Name 'dup'))
try {
    Assert-Throws -Action { Import-SyncConfig -Path $path } -Because '来源重名时报错'
}
finally {
    Remove-Item -LiteralPath $path -Force
}

Write-Host ""
Write-Host "通过 $script:Passed 项，失败 $script:Failed 项"
if ($script:Failed -gt 0) { exit 1 }
exit 0
