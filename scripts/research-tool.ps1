param([ValidateSet('Start','Stop')][string]$Mode='Start',[switch]$NoOpen,[switch]$NoDialog)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$origin='http://127.0.0.1:5199'
function Read-State {
 try { $state=Invoke-RestMethod "$origin/api/state" -TimeoutSec 8; if($state.application -ne 'instagram-research-library'){throw 'Port 5199 belongs to another application.'};return $state }
 catch { if($_.Exception.Message -like '*another application*'){throw};return $null }
}
$mutex=New-Object System.Threading.Mutex($false,'Local\ResearchToolDesktopLauncher')
$held=$false
try {
 $held=$mutex.WaitOne(90000);if(!$held){throw 'Another Research Tool launch is still working. Try again shortly.'}
 $state=Read-State
 if($Mode -eq 'Stop'){
  if(!$state){Write-Output 'Research Tool is already stopped.';exit 0}
  $headers=@{origin=$origin;'x-research-token'=$state.csrf}
  Invoke-RestMethod "$origin/api/stop" -Method Post -Headers $headers -ContentType application/json -Body '{}' -TimeoutSec 15 | Out-Null
  $until=(Get-Date).AddMinutes(5)
  do { $state=Read-State;if(!$state){break};if(!$state.queue.active -and !$state.rechecks.running -and !$state.combining.running -and !$state.savedSync.running -and !$state.wishlist.running -and !$state.referenceHandoff.running){break};Start-Sleep -Seconds 2 } while((Get-Date) -lt $until)
  if($state -and ($state.queue.active -or $state.rechecks.running -or $state.combining.running -or $state.savedSync.running -or $state.wishlist.running -or $state.referenceHandoff.running)){throw 'The current work is still finishing. Try Stop Research Tool again shortly.'}
  if($state){Invoke-RestMethod "$origin/api/shutdown" -Method Post -Headers @{origin=$origin;'x-research-token'=$state.csrf} -ContentType application/json -Body '{}' -TimeoutSec 30 | Out-Null}
  $until=(Get-Date).AddSeconds(30);while((Read-State) -and (Get-Date) -lt $until){Start-Sleep -Milliseconds 500}
  if(Read-State){throw 'Research Tool has not finished shutting down. Try again shortly.'}
  Write-Output 'Research Tool stopped cleanly.';exit 0
 }
 if(!$state){
  $node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source
  if(!$node){$node=Join-Path $env:ProgramFiles 'nodejs\node.exe'}
  if(!(Test-Path -LiteralPath $node)){throw 'Node.js was not found. Research Tool could not start.'}
  $data=Join-Path $projectRoot '.research-data';New-Item -ItemType Directory -Path $data -Force | Out-Null
  Start-Process -FilePath $node -ArgumentList '--env-file-if-exists=.env','--use-system-ca','--use-env-proxy','src/server.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'desktop-server.log') -RedirectStandardError (Join-Path $data 'desktop-server-error.log') | Out-Null
  $until=(Get-Date).AddSeconds(75)
  do {Start-Sleep -Milliseconds 750;$state=Read-State} while(!$state -and (Get-Date) -lt $until)
  if(!$state){throw 'Research Tool did not start within 75 seconds. Check .research-data\desktop-server-error.log in the Research Agent folder. No existing server was stopped.'}
 }
 if(!$NoOpen){Start-Process $origin}
 Write-Output 'Research Tool is ready.'
} catch {
 $plain='Research Tool: '+$_.Exception.Message
 if(!$NoDialog){Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.MessageBox]::Show($plain,'Research Tool') | Out-Null}
 Write-Error $plain;exit 1
} finally {if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
