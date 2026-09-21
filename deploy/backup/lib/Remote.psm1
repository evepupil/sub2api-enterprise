# 远程执行：封装 ssh / scp，带重试和硬超时。
#
# 两个坑都踩过，所以这里的写法是必须的：
# 1. 生产服务器那条线经常握手超时，每一步都要能重试，而不是一失败就整轮作废。
# 2. 走 Cloudflare 隧道时 ssh 会拉起 cloudflared 子进程。计划任务里没有交互式
#    输入，ssh 偶尔会一直挂着不退，子进程也跟着占住管道，整个任务卡在「运行中」，
#    下一轮就被跳过了。所以统一用带超时的启动方式，超时后连子进程一起结束。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 这里不加 -Force：入口脚本已经加载过日志模块，复用同一个实例才能写进同一个日志文件。
Import-Module (Join-Path $PSScriptRoot 'Log.psm1')

function Get-SshTarget {
    param([Parameter(Mandatory)][hashtable]$Source)
    if ($Source['sshUser']) { return "$($Source['sshUser'])@$($Source['sshHost'])" }
    return [string]$Source['sshHost']
}

function Get-CommonSshOption {
    # -n 让 ssh 不去读标准输入。计划任务里没有可用的输入句柄，不加这个会卡住。
    @(
        '-n',
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=20',
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=4',
        '-o', 'StrictHostKeyChecking=accept-new'
    )
}

function ConvertTo-CommandLine {
    # 含空格的参数加引号，其余原样拼接。
    param([Parameter(Mandatory)][string[]]$ArgumentList)
    $parts = foreach ($argument in $ArgumentList) {
        if ($argument -match '[\s"]') { '"' + ($argument -replace '"', '\"') + '"' } else { $argument }
    }
    return ($parts -join ' ')
}

function Invoke-ExternalProcess {
    <#
        启动外部程序并等待，超时就把整棵进程树结束掉。
        输出走临时文件，避免管道被子进程占住导致读取阻塞。
    #>
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$ArgumentList,
        [int]$TimeoutSeconds = 300
    )

    $outFile = [IO.Path]::GetTempFileName()
    $errFile = [IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $FilePath -ArgumentList (ConvertTo-CommandLine -ArgumentList $ArgumentList) `
            -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile

        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            # /T 连子进程一起结束，否则 cloudflared 会继续占着句柄。
            & taskkill.exe /T /F /PID $process.Id 2>&1 | Out-Null
            [void]$process.WaitForExit(10000)
            return @{ ExitCode = -1; StdOut = ''; StdErr = "执行超过 $TimeoutSeconds 秒，已强制结束"; TimedOut = $true }
        }

        return @{
            ExitCode = $process.ExitCode
            StdOut   = [string](Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue)
            StdErr   = [string](Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue)
            TimedOut = $false
        }
    }
    finally {
        Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-RemoteBash {
    <#
        把一段 bash 脚本送到远端执行。脚本用 base64 传输，彻底绕开引号转义
        和 Windows 换行符的问题。返回远端标准输出。
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Source,
        [Parameter(Mandatory)][string]$Script,
        [int]$Retries = 4,
        [int]$RetryDelaySeconds = 10,
        [int]$TimeoutSeconds = 300
    )

    $normalized = $Script -replace "`r`n", "`n"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalized))

    $sshArgs = @(Get-CommonSshOption)
    if ($Source['port']) { $sshArgs += @('-p', [string]$Source['port']) }
    if ($Source['identityFile']) { $sshArgs += @('-i', [string]$Source['identityFile']) }
    $sshArgs += (Get-SshTarget -Source $Source)
    $sshArgs += "echo $encoded | base64 -d | bash -s"

    $lastError = ''
    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        $result = Invoke-ExternalProcess -FilePath 'ssh' -ArgumentList $sshArgs -TimeoutSeconds $TimeoutSeconds
        if ($result.ExitCode -eq 0) { return $result.StdOut }

        $lastError = if ($result.StdErr) { $result.StdErr.Trim() } else { $result.StdOut.Trim() }
        Write-SyncLog -Level 'WARN' -Scope $Source['name'] -Message "远程命令第 $attempt 次失败（exit=$($result.ExitCode)）：$($lastError -replace "`r?`n", ' | ')"
        if ($attempt -lt $Retries) { Start-Sleep -Seconds ($RetryDelaySeconds * $attempt) }
    }
    throw "远程命令重试 $Retries 次仍失败：$lastError"
}

function Copy-RemoteFile {
    param(
        [Parameter(Mandatory)][hashtable]$Source,
        [Parameter(Mandatory)][string]$RemotePath,
        [Parameter(Mandatory)][string]$LocalPath,
        [int]$Retries = 4,
        [int]$RetryDelaySeconds = 10,
        [int]$TimeoutSeconds = 900
    )

    # scp 的端口参数是大写 -P，和 ssh 不一样；-n 对 scp 无意义，这里去掉。
    $scpArgs = @(Get-CommonSshOption | Where-Object { $_ -ne '-n' })
    if ($Source['port']) { $scpArgs += @('-P', [string]$Source['port']) }
    if ($Source['identityFile']) { $scpArgs += @('-i', [string]$Source['identityFile']) }
    $scpArgs += @("$(Get-SshTarget -Source $Source):$RemotePath", $LocalPath)

    $lastError = ''
    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        if (Test-Path -LiteralPath $LocalPath) { Remove-Item -LiteralPath $LocalPath -Force }
        $result = Invoke-ExternalProcess -FilePath 'scp' -ArgumentList $scpArgs -TimeoutSeconds $TimeoutSeconds
        if ($result.ExitCode -eq 0 -and (Test-Path -LiteralPath $LocalPath)) { return }

        $lastError = if ($result.StdErr) { $result.StdErr.Trim() } else { $result.StdOut.Trim() }
        Write-SyncLog -Level 'WARN' -Scope $Source['name'] -Message "下载 $RemotePath 第 $attempt 次失败（exit=$($result.ExitCode)）：$($lastError -replace "`r?`n", ' | ')"
        if ($attempt -lt $Retries) { Start-Sleep -Seconds ($RetryDelaySeconds * $attempt) }
    }
    throw "下载 $RemotePath 重试 $Retries 次仍失败：$lastError"
}

Export-ModuleMember -Function Invoke-RemoteBash, Copy-RemoteFile, Get-SshTarget, Invoke-ExternalProcess
