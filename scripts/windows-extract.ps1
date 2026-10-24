param([ValidateSet('speech','ocr')][string]$Mode,[Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference='Stop'
if (-not [IO.Path]::IsPathRooted($InputPath)) { throw 'Absolute local input required' }
if ($Mode -eq 'speech') {
  Add-Type -AssemblyName System.Speech
  $recognizers=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
  if (-not $recognizers.Count) { throw 'No installed Windows speech recognizer' }
  $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizers[0])
  try {
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $engine.SetInputToWaveFile($InputPath)
    $segments=@()
    while ($true) {
      try {$result=$engine.Recognize()} catch {
        if ($segments.Count -gt 0 -and $_.Exception.InnerException -is [InvalidOperationException]) {break}
        throw
      }
      if (-not $result) {break}
      $segments+=@{text=$result.Text;confidence=$result.Confidence}
    }
    @{text=($segments.text -join ' ');segments=$segments;provider='Windows System.Speech'} | ConvertTo-Json -Depth 5 -Compress
  } finally {$engine.Dispose()}
} else {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
  $null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
  $null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
  $asTask=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1)
  function Await-Ocr($operation,[Type]$type) { $task=$asTask.MakeGenericMethod($type).Invoke($null,@($operation));$task.Wait();$task.Result }
  $file=Await-Ocr ([Windows.Storage.StorageFile]::GetFileFromPathAsync($InputPath)) ([Windows.Storage.StorageFile])
  $stream=Await-Ocr ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder=Await-Ocr ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap=Await-Ocr ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
      $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
      if (-not $engine) {throw 'No installed Windows OCR language'}
      $result=Await-Ocr ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      @{text=$result.Text;provider='Windows.Media.Ocr'} | ConvertTo-Json -Compress
    } finally {$bitmap.Dispose()}
  } finally {$stream.Dispose()}
}
