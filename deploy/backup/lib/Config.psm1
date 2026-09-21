# 配置加载：从仓库外的 JSON 文件读取同步目标，校验必填项并规范成哈希表。
# 放在仓库外是为了不把服务器地址、端口、密钥路径写进代码库。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-DefaultConfigPath {
    Join-Path $env:USERPROFILE '.sub2api\db-sync.config.json'
}

function ConvertTo-HashtableValue {
    param($InputObject)
    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
        $result = @{}
        foreach ($property in $InputObject.PSObject.Properties) {
            $result[$property.Name] = ConvertTo-HashtableValue -InputObject $property.Value
        }
        return $result
    }
    if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
        return @($InputObject | ForEach-Object { ConvertTo-HashtableValue -InputObject $_ })
    }
    return $InputObject
}

function Get-OptionalValue {
    param(
        [Parameter(Mandatory)][hashtable]$Table,
        [Parameter(Mandatory)][string]$Key,
        $Default = $null
    )
    if ($Table.ContainsKey($Key) -and $null -ne $Table[$Key] -and "$($Table[$Key])".Trim() -ne '') {
        return $Table[$Key]
    }
    return $Default
}

function Import-SyncConfig {
    param([string]$Path)

    if (-not $Path) { $Path = Get-DefaultConfigPath }
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "找不到配置文件：$Path（可复制 db-sync.config.example.json 修改后放到这个位置）"
    }

    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $config = ConvertTo-HashtableValue -InputObject ($raw | ConvertFrom-Json)

    $destinationRoot = Get-OptionalValue -Table $config -Key 'destinationRoot'
    if (-not $destinationRoot) { throw "配置缺少 destinationRoot（本地存放目录）" }
    $config['destinationRoot'] = [Environment]::ExpandEnvironmentVariables($destinationRoot)

    $retain = [int](Get-OptionalValue -Table $config -Key 'retainSnapshots' -Default 2)
    if ($retain -lt 1) { throw "retainSnapshots 至少为 1，当前是 $retain" }
    $config['retainSnapshots'] = $retain

    $sources = @(Get-OptionalValue -Table $config -Key 'sources' -Default @())
    if ($sources.Count -eq 0) { throw "配置里没有任何同步来源（sources 为空）" }

    $normalized = @()
    foreach ($source in $sources) {
        foreach ($required in @('name', 'sshHost', 'containerName', 'databaseUser', 'databaseName')) {
            if (-not (Get-OptionalValue -Table $source -Key $required)) {
                throw "同步来源缺少必填项 $required：$($source | ConvertTo-Json -Compress)"
            }
        }
        $source['enabled'] = [bool](Get-OptionalValue -Table $source -Key 'enabled' -Default $true)
        $source['port'] = Get-OptionalValue -Table $source -Key 'port'
        $source['sshUser'] = Get-OptionalValue -Table $source -Key 'sshUser'
        $source['identityFile'] = Get-OptionalValue -Table $source -Key 'identityFile'
        $normalized += $source
    }
    $config['sources'] = $normalized

    $duplicates = @($normalized | Group-Object -Property { $_['name'] } | Where-Object { $_.Count -gt 1 })
    if ($duplicates.Count -gt 0) {
        throw "同步来源名称重复：$(($duplicates | ForEach-Object { $_.Name }) -join ', ')"
    }

    return $config
}

Export-ModuleMember -Function Import-SyncConfig, Get-DefaultConfigPath, Get-OptionalValue
