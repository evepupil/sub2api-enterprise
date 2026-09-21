<#
.SYNOPSIS
    把数据库同步注册成 Windows 计划任务，默认每小时跑一次。

.DESCRIPTION
    任务以当前用户身份运行，不需要保存密码，注销状态下也会执行。
    上一轮没跑完时新一轮会被忽略，不会出现两个进程同时动同一批目录。

.EXAMPLE
    pwsh -File install-task.ps1
    pwsh -File install-task.ps1 -IntervalHours 2
    pwsh -File install-task.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$TaskName = 'Sub2API DB Sync',
    [int]$IntervalHours = 1,
    [string]$ConfigPath,
    [switch]$RunWhenLoggedOff,
    [switch]$Remove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "已删除计划任务：$TaskName"
    } else {
        Write-Host "计划任务不存在，无需删除：$TaskName"
    }
    return
}

if ($IntervalHours -lt 1 -or $IntervalHours -gt 24) {
    throw "间隔小时数需要在 1 到 24 之间，当前是 $IntervalHours"
}

$pwshPath = (Get-Command pwsh -ErrorAction SilentlyContinue)?.Source
if (-not $pwshPath) { $pwshPath = (Get-Command powershell).Source }

$scriptPath = Join-Path $PSScriptRoot 'sync-db.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) { throw "找不到同步脚本：$scriptPath" }

$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$scriptPath`"")
if ($ConfigPath) { $arguments += @('-ConfigPath', "`"$ConfigPath`"") }

$action = New-ScheduledTaskAction -Execute $pwshPath -Argument ($arguments -join ' ') -WorkingDirectory $PSScriptRoot

# 从下一个整点开始，之后按间隔无限重复。
$firstRun = (Get-Date).Date.AddHours((Get-Date).Hour + 1)
$trigger = New-ScheduledTaskTrigger -Once -At $firstRun -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -RestartCount 2

# 默认跟随登录态运行，普通权限就能注册。
# 想让注销后也继续跑，加 -RunWhenLoggedOff，但注册时需要管理员身份的终端。
$logonType = if ($RunWhenLoggedOff) { 'S4U' } else { 'Interactive' }
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType $logonType -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description '每小时把 sub2api 各环境的数据库同步到本机，只保留本次和上次两份' | Out-Null

Write-Host "已注册计划任务：$TaskName"
Write-Host "首次运行：$firstRun，之后每 $IntervalHours 小时一次"
Write-Host "立即试跑：Start-ScheduledTask -TaskName '$TaskName'"
