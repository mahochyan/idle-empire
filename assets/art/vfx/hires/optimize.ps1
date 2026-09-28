# Package the original generated VFX masters as 512x512 transparent textures.
# Run from the repository root: pwsh -File assets/art/vfx/hires/optimize.ps1
Add-Type -AssemblyName System.Drawing
$artRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceDir = Join-Path $artRoot 'source\generated\vfx'
$targetDir = $PSScriptRoot
$masters = @(Get-ChildItem -LiteralPath $sourceDir -Filter '*-master.png' -File)
if ($masters.Count -eq 0) { throw ('No VFX masters found in ' + $sourceDir) }
foreach ($master in $masters) {
  $key = $master.Name -replace '-master\.png$', ''
  if ($key -notmatch '^[a-z0-9-]+$') { throw ('Invalid VFX master name: ' + $master.Name) }
  $targetPath = Join-Path $targetDir ($key + '.png')
  $source = [System.Drawing.Image]::FromFile($master.FullName)
  $target = New-Object System.Drawing.Bitmap(512,512,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage($source,0,0,512,512)
    $target.Save($targetPath,[System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ($key + ': ' + $source.Width + 'x' + $source.Height + ' -> 512x512')
  } finally {
    $graphics.Dispose()
    $target.Dispose()
    $source.Dispose()
  }
}
