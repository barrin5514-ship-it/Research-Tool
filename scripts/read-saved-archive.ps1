param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($Archive)
try {
  $files=@()
  foreach($name in @('saved_posts.json','saved_collections.json')) {
    $matches=@($zip.Entries | Where-Object { $_.FullName.Replace('\','/') -eq "your_instagram_activity/saved/$name" })
    if($matches.Count -ne 1 -or $matches[0].Length -gt 10485760){throw 'Expected exactly one bounded saved JSON entry.'}
    $reader=[IO.StreamReader]::new($matches[0].Open())
    try {$files+=@{name=$name;content=$reader.ReadToEnd()}}finally{$reader.Dispose()}
  }
  [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
  ConvertTo-Json -InputObject $files -Depth 4 -Compress
}finally{$zip.Dispose()}
