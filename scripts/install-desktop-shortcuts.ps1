$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$desktop=[Environment]::GetFolderPath('Desktop')
$shell=New-Object -ComObject WScript.Shell
foreach($entry in @(@('Research Tool','Start',23),@('Stop Research Tool','Stop',27))){
 $shortcut=$shell.CreateShortcut((Join-Path $desktop ($entry[0]+'.lnk')))
 $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\wscript.exe'
 $shortcut.Arguments='"'+(Join-Path $PSScriptRoot 'research-tool.vbs')+'" '+$entry[1]
 $shortcut.WorkingDirectory=$projectRoot
 $shortcut.IconLocation=(Join-Path $env:WINDIR 'System32\shell32.dll')+','+$entry[2]
 $shortcut.Description=$entry[0]+' — local Research Agent'
 $shortcut.WindowStyle=7
 $shortcut.Save()
}
Write-Output ('Created Research Tool and Stop Research Tool shortcuts on '+$desktop)
