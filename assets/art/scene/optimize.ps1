# Package original era-town illustrations for the mobile map plate.
# Run from the repository root: pwsh -File assets/art/scene/optimize.ps1
Add-Type -AssemblyName System.Drawing
$artRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceDir = Join-Path $artRoot 'source\generated'
$eras = @('base','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age','sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age')
$targetWidth = 1024
$targetHeight = 525
foreach ($era in $eras) {
  $sourcePath = Join-Path $sourceDir ('town-' + $era + '-master.png')
  if (-not (Test-Path -LiteralPath $sourcePath)) { throw ('Missing town art: ' + $sourcePath) }
  $targetPath = Join-Path $PSScriptRoot ('town-' + $era + '.png')
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $target = New-Object System.Drawing.Bitmap($targetWidth,$targetHeight,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  try {
    # Preserve all landmarks horizontally and crop only the thin top/bottom margins.
    $cropHeight = [Math]::Min($source.Height,[int][Math]::Round($source.Width * $targetHeight / $targetWidth))
    $cropY = [int][Math]::Floor(($source.Height - $cropHeight) / 2)
    $sourceRect = New-Object System.Drawing.Rectangle(0,$cropY,$source.Width,$cropHeight)
    $targetRect = New-Object System.Drawing.Rectangle(0,0,$targetWidth,$targetHeight)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source,$targetRect,$sourceRect,[System.Drawing.GraphicsUnit]::Pixel)
    $target.Save($targetPath,[System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ($era + ': ' + $source.Width + 'x' + $source.Height + ' -> 1024x525')
  } finally {
    $graphics.Dispose()
    $target.Dispose()
    $source.Dispose()
  }
}
