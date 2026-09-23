<#
.SYNOPSIS
  Pull every master course out of Canvas as a Common Cartridge (.imscc) so the
  Curriculum Studio catalog can be rebuilt from all of them at once.

.DESCRIPTION
  Uses the Canvas REST API with an access token that inherits the permissions of
  the account that created it (an account admin can export courses they do not
  teach). The token is read from the CANVAS_TOKEN environment variable or the
  -Token parameter and is never written to disk by this script.

  Three phases:
    1. List courses in the account and keep the ones whose name matches -SearchTerm.
    2. Request a content export for each (a few at a time), poll until Canvas has
       built the cartridge, and download it to -OutDir.
    3. Unzip each cartridge into -ExportsDir\<slug>\ so tools\build-catalog.pl can
       read it (that is the OCS_EXPORTS folder).

.EXAMPLE
  $env:CANVAS_TOKEN = '<paste token here, this session only>'
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\canvas-pull.ps1 -DryRun
      Lists the courses the filter would pull and writes them to canvas-courses.csv.

  powershell -NoProfile -ExecutionPolicy Bypass -File tools\canvas-pull.ps1
      Exports and unzips everything the dry run listed.

  powershell ... -File tools\canvas-pull.ps1 -CourseIds 3411,3412
      Only these Canvas course ids (ignores -SearchTerm).

.NOTES
  Windows PowerShell 5.1 compatible. Exports typically take 30 s to 3 min each;
  Canvas queues them, so 100 courses is roughly an hour. Re-running skips
  cartridges downloaded in the last -MaxAgeHours hours.
#>
[CmdletBinding()]
param(
  [string]$Domain = 'optimadomi.instructure.com',
  [string]$Token = $env:CANVAS_TOKEN,
  [string]$AccountId = 'self',
  [string]$SearchTerm = 'On-Demand',
  [int[]]$CourseIds = @(),
  [string]$OutDir = '',
  [string]$ExportsDir = '',
  [int]$Concurrency = 4,
  [int]$PollSeconds = 8,
  [int]$MaxAgeHours = 24,
  [switch]$DryRun,
  [switch]$IncludeUnpublished
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# repo root = parent of tools\ (resolved here rather than in param defaults, which run before $PSScriptRoot is reliable in 5.1)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $OutDir) { $OutDir = Join-Path $root 'exports\imscc' }
if (-not $ExportsDir) { $ExportsDir = Join-Path $root 'exports\extracted' }

if (-not $Token) { throw 'No token. Set $env:CANVAS_TOKEN (for this PowerShell session only) or pass -Token. Never commit it.' }
$base = "https://$Domain/api/v1"
$headers = @{ Authorization = "Bearer $Token" }

function Slug([string]$s) {
  $t = $s.ToLower() -replace '&', ' and ' -replace '[^a-z0-9]+', '-' -replace '^-|-$', ''
  if ($t.Length -gt 80) { $t = $t.Substring(0, 80) }
  return $t
}

# Follows Canvas pagination (Link: <...>; rel="next") and returns every item.
function Get-AllPages([string]$url) {
  $items = @()
  $next = $url
  while ($next) {
    $resp = Invoke-WebRequest -Uri $next -Headers $headers -UseBasicParsing
    $page = $resp.Content | ConvertFrom-Json
    if ($page -is [array]) { $items += $page } else { $items += @($page) }
    $next = $null
    $link = $resp.Headers['Link']
    if ($link) {
      foreach ($part in ($link -split ',')) {
        if ($part -match '<([^>]+)>;\s*rel="next"') { $next = $matches[1] }
      }
    }
  }
  return $items
}

# ---------------------------------------------------------------- 1. list courses
Write-Host "Canvas: $Domain  account: $AccountId"
try {
  $me = Invoke-RestMethod -Uri "$base/users/self" -Headers $headers
} catch {
  $detail = ''
  try { $stream = $_.Exception.Response.GetResponseStream(); $detail = (New-Object IO.StreamReader($stream)).ReadToEnd() } catch {}
  Write-Host ''
  Write-Host "Canvas at $Domain refused the token." -ForegroundColor Red
  if ($detail) { Write-Host "Canvas said: $detail" -ForegroundColor Yellow }
  Write-Host 'What this usually means:'
  Write-Host '  "Invalid access token"        the token was created on a different Canvas address, or was deleted/expired.'
  Write-Host '                                 Use the address from your browser while signed in:  -Domain your.canvas.address'
  Write-Host '  "user authorization required"  no token reached Canvas; check $env:CANVAS_TOKEN is set in THIS window.'
  Write-Host "  Token in this window: length $($Token.Length), starts with $($Token.Substring(0, [Math]::Min(6, $Token.Length)))"
  exit 1
}
Write-Host "Token belongs to: $($me.name) ($($me.login_id))"

$courses = @()
if ($CourseIds.Count -gt 0) {
  foreach ($id in $CourseIds) { $courses += Invoke-RestMethod -Uri "$base/courses/$id" -Headers $headers }
} else {
  $q = "$base/accounts/$AccountId/courses?per_page=100&include[]=term"
  if ($SearchTerm) { $q += "&search_term=$([Uri]::EscapeDataString($SearchTerm))" }   # empty -SearchTerm '' lists every course
  if (-not $IncludeUnpublished) { $q += '&published=true' }
  $courses = Get-AllPages $q
}
$courses = $courses | Sort-Object name
if ($SearchTerm) { Write-Host "Matched $($courses.Count) course(s) for '$SearchTerm'" } else { Write-Host "Listed $($courses.Count) course(s) (no name filter)" }
if ($courses.Count -eq 0 -and -not $IncludeUnpublished) { Write-Host 'Tip: master courses are often unpublished; add -IncludeUnpublished.' -ForegroundColor Yellow }

$listing = $courses | ForEach-Object {
  $termName = ''
  if ($_.term) { $termName = $_.term.name }
  [pscustomobject]@{ id = $_.id; name = $_.name; course_code = $_.course_code; term = $termName; state = $_.workflow_state; slug = (Slug $_.name) }
}
$csv = Join-Path $root 'exports\canvas-courses.csv'
New-Item -ItemType Directory -Force (Split-Path -Parent $csv) | Out-Null
$listing | Export-Csv -Path $csv -NoTypeInformation -Encoding UTF8
$listing | Format-Table id, name, term, state -AutoSize | Out-String -Width 200 | Write-Host
Write-Host "Course list saved to $csv"
if ($DryRun) { Write-Host 'Dry run: nothing exported. Adjust -SearchTerm or pass -CourseIds, then run again without -DryRun.'; exit 0 }

# ---------------------------------------------------------------- 2. export + download
New-Item -ItemType Directory -Force $OutDir | Out-Null
New-Item -ItemType Directory -Force $ExportsDir | Out-Null
$pending = @{}
$queue = New-Object System.Collections.Queue
$done = @(); $failed = @(); $skipped = @()

foreach ($c in $listing) {
  $target = Join-Path $OutDir ("$($c.slug)-$($c.id).imscc")
  if ((Test-Path $target) -and ((Get-Item $target).LastWriteTime -gt (Get-Date).AddHours(-$MaxAgeHours))) {
    $skipped += $c; continue
  }
  $queue.Enqueue($c)
}
Write-Host "Exporting $($queue.Count) course(s); $($skipped.Count) fresh cartridge(s) skipped."

function Start-Export($c) {
  $body = @{ export_type = 'common_cartridge'; skip_notifications = 'true' }
  $ex = Invoke-RestMethod -Method Post -Uri "$base/courses/$($c.id)/content_exports" -Headers $headers -Body $body
  return @{ course = $c; exportId = $ex.id; started = Get-Date }
}

while ($queue.Count -gt 0 -or $pending.Count -gt 0) {
  while ($queue.Count -gt 0 -and $pending.Count -lt $Concurrency) {
    $c = $queue.Dequeue()
    try {
      $job = Start-Export $c
      $pending[$c.id] = $job
      Write-Host ("  started  {0,-60} export {1}" -f $c.name, $job.exportId)
    } catch {
      Write-Warning "  could not start export for $($c.name): $($_.Exception.Message)"
      $failed += [pscustomobject]@{ id = $c.id; name = $c.name; reason = $_.Exception.Message }
    }
  }
  if ($pending.Count -eq 0) { break }
  Start-Sleep -Seconds $PollSeconds
  foreach ($key in @($pending.Keys)) {
    $job = $pending[$key]; $c = $job.course
    try {
      $st = Invoke-RestMethod -Uri "$base/courses/$($c.id)/content_exports/$($job.exportId)" -Headers $headers
    } catch { Write-Warning "  poll failed for $($c.name): $($_.Exception.Message)"; continue }
    switch ($st.workflow_state) {
      'exported' {
        $target = Join-Path $OutDir ("$($c.slug)-$($c.id).imscc")
        # The attachment URL carries its own verifier; send it without the bearer header.
        Invoke-WebRequest -Uri $st.attachment.url -OutFile $target -UseBasicParsing
        $mb = [math]::Round((Get-Item $target).Length / 1MB, 1)
        Write-Host ("  saved    {0,-60} {1} MB" -f $c.name, $mb)
        $done += $c
        $pending.Remove($key)
      }
      'failed' {
        Write-Warning "  Canvas reported a failed export for $($c.name)"
        $failed += [pscustomobject]@{ id = $c.id; name = $c.name; reason = 'canvas export failed' }
        $pending.Remove($key)
      }
      default {
        if (((Get-Date) - $job.started).TotalMinutes -gt 20) {
          Write-Warning "  gave up waiting on $($c.name) after 20 minutes"
          $failed += [pscustomobject]@{ id = $c.id; name = $c.name; reason = 'timeout' }
          $pending.Remove($key)
        }
      }
    }
  }
}

# ---------------------------------------------------------------- 3. unzip for the catalog builder
Write-Host 'Extracting cartridges for tools\build-catalog.pl ...'
$extracted = 0
Get-ChildItem $OutDir -Filter *.imscc | ForEach-Object {
  $slug = [IO.Path]::GetFileNameWithoutExtension($_.Name)
  $dest = Join-Path $ExportsDir $slug
  $stamp = Join-Path $dest '.extracted-from'
  if ((Test-Path $stamp) -and ((Get-Item $stamp).LastWriteTime -ge $_.LastWriteTime)) { return }
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  $tmpZip = Join-Path $env:TEMP ("$slug.zip")
  Copy-Item $_.FullName $tmpZip -Force
  Expand-Archive -Path $tmpZip -DestinationPath $dest -Force
  Remove-Item $tmpZip -Force
  Set-Content -Path $stamp -Value $_.Name -Encoding UTF8
  $extracted++
}

Write-Host ''
Write-Host ("Done. exported {0}, skipped (fresh) {1}, failed {2}, extracted {3}" -f $done.Count, $skipped.Count, $failed.Count, $extracted)
if ($failed.Count) { $failed | Format-Table -AutoSize | Out-String | Write-Host }
Write-Host "Cartridges: $OutDir"
Write-Host "Extracted:  $ExportsDir   (use this as OCS_EXPORTS for tools/build-catalog.pl)"
