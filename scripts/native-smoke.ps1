$ErrorActionPreference='Stop'
$dir=Join-Path $PSScriptRoot '../.test-artifacts/native-smoke'
$wav=Join-Path $dir 'speech.wav'
$png=Join-Path $dir 'ocr.png'
try {
 Add-Type -AssemblyName System.Speech
 $s=New-Object System.Speech.Synthesis.SpeechSynthesizer
 $s.SetOutputToWaveFile($wav)
 $s.Speak('Research helps people learn new ideas.')
 $s.Dispose()
 Add-Type -AssemblyName System.Drawing
 $image=New-Object Drawing.Bitmap(900,150)
 $g=[Drawing.Graphics]::FromImage($image)
 $g.Clear([Drawing.Color]::White)
 $font=New-Object Drawing.Font('Arial',36)
 $g.DrawString('RESEARCH LIBRARY 123',$font,[Drawing.Brushes]::Black,10,30)
 $image.Save($png,[Drawing.Imaging.ImageFormat]::Png)
 $g.Dispose();$font.Dispose();$image.Dispose()
 $speech = (& (Join-Path $PSScriptRoot 'windows-extract.ps1') -Mode speech -InputPath ([IO.Path]::GetFullPath($wav))) | ConvertFrom-Json
 if ($speech.text -notmatch '(?i)Research helps people learn new ideas') {throw 'Synthetic speech assertion failed'}
 $speech | ConvertTo-Json -Depth 5 -Compress
 $ocr = (& (Join-Path $PSScriptRoot 'windows-extract.ps1') -Mode ocr -InputPath ([IO.Path]::GetFullPath($png))) | ConvertFrom-Json
 if ($ocr.text -notmatch 'RESEARCH LIBRARY 123') {throw 'Synthetic OCR assertion failed'}
 $ocr | ConvertTo-Json -Compress
 if ($env:RESEARCH_NATIVE_PIPELINE_TEST -eq '1') {
  & ffmpeg -nostdin -v error -loop 1 -i $png -i $wav -t 5 -r 5 -c:v libx264 -pix_fmt yuv420p -c:a aac -y (Join-Path $dir 'clip.mp4')
  if ($LASTEXITCODE -ne 0) {throw 'Synthetic clip encoding failed'}
 }
} finally {
 foreach($file in @($wav,$png)) {if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file}}
}
