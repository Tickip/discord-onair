# Restart loop for discord-onair. Registered as a scheduled task that runs
# at logon (see README) so the bot survives crashes without needing a
# separate service manager installed.

$ErrorActionPreference = "Continue"
$projectDir = Split-Path -Parent $PSScriptRoot
$node = "C:\Program Files\nodejs\node.exe"

Set-Location $projectDir

while ($true) {
    & $node "dist\index.js"
    Start-Sleep -Seconds 10
}
