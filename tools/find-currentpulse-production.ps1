param(
  [string]$Root = "C:\\Users\\prana\\CurrentPulse-Original-Multi",
  [string]$RepositoryNeedle = "currentpulse-ai"
)

$ErrorActionPreference = "Stop"

function Inspect-Repo([string]$Path) {
  if(!(Test-Path $Path)){ return $null }
  try {
    $remote = (& git -C $Path remote get-url origin 2>$null | Out-String).Trim()
    if([string]::IsNullOrWhiteSpace($remote) -or $remote -notmatch $RepositoryNeedle){
      return $null
    }

    & git -C $Path fetch origin main --quiet 2>$null

    $head = (& git -C $Path rev-parse HEAD 2>$null | Out-String).Trim()
    $origin = (& git -C $Path rev-parse origin/main 2>$null | Out-String).Trim()
    $branch = (& git -C $Path branch --show-current 2>$null | Out-String).Trim()
    $dirty = (& git -C $Path status --porcelain 2>$null | Out-String).Trim()

    [pscustomobject]@{
      Path = $Path
      Remote = $remote
      Branch = $branch
      Head = $head
      OriginMain = $origin
      Clean = [string]::IsNullOrWhiteSpace($dirty)
      ExactCurrentMain = ($head -eq $origin)
    }
  } catch {
    return $null
  }
}

$candidates = @()
if(Test-Path $Root){
  $candidates += $Root
  $candidates += Get-ChildItem $Root -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
}

$repos = @()
foreach($candidate in ($candidates | Select-Object -Unique)){
  $info = Inspect-Repo $candidate
  if($null -ne $info){ $repos += $info }
}

if(!$repos.Count){
  throw "No CurrentPulse checkout was found under $Root."
}

$repos | Sort-Object Path |
  Format-Table Path,Branch,Clean,ExactCurrentMain,Head,OriginMain -AutoSize |
  Out-Host

$eligible = @(
  $repos | Where-Object {
    $_.Clean -and $_.ExactCurrentMain
  }
)

if(!$eligible.Count){
  throw "No clean local checkout exactly matches its current GitHub origin/main."
}

$selected = $eligible |
  Sort-Object @{
    Expression = {
      if($_.Path -like "*CurrentPulse-LIVE-MAIN"){ 0 } else { 1 }
    }
  }, Path |
  Select-Object -First 1

Write-Output $selected.Path
