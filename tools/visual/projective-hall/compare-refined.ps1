param([switch]$Edge)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$oldName = if ($Edge) { 'qa-projective-hall-refined-360x200.png' } else { 'qa-projective-hall-textured-360x200.png' }
$newName = if ($Edge) { 'qa-projective-hall-edge-360x200.png' } else { 'qa-projective-hall-refined-360x200.png' }
$old = [System.Drawing.Bitmap]::FromFile((Join-Path $root ('hd2d-previews\' + $oldName)))
$new = [System.Drawing.Bitmap]::FromFile((Join-Path $root ('hd2d-previews\' + $newName)))
$scale = 3
$tileW = 130 * $scale
$tileH = 100 * $scale
$newLabel = if ($Edge) { 'Edge' } else { 'Refined' }
$oldLabel = if ($Edge) { 'Refined' } else { 'Before' }
$labels = @('Original', "$oldLabel 0 deg", "$newLabel 0 deg", "$oldLabel -8 deg", "$newLabel -8 deg", "$oldLabel +8 deg", "$newLabel +8 deg")
$sources = @(
  @($old, 8), @($old, 376), @($new, 376),
  @($old, 744), @($new, 744), @($old, 1112), @($new, 1112)
)
$canvas = New-Object System.Drawing.Bitmap ($tileW * $labels.Count), ($tileH + 28), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232,236,226))
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(33,42,38))
$font = New-Object System.Drawing.Font 'Segoe UI', 11
try {
  $g.FillRectangle($background, 0, 0, $canvas.Width, $canvas.Height)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  for ($i = 0; $i -lt $sources.Count; $i++) {
    $g.DrawString($labels[$i], $font, $ink, ($i * $tileW + 5), 4)
    $src = New-Object System.Drawing.Rectangle ($sources[$i][1] + 115), 57, 130, 100
    $dst = New-Object System.Drawing.Rectangle ($i * $tileW), 28, $tileW, $tileH
    $g.DrawImage($sources[$i][0], $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  }
  $outputName = if ($Edge) { 'hd2d-previews\qa-projective-hall-edge-central-crop.png' } else { 'hd2d-previews\qa-projective-hall-refined-central-crop.png' }
  $out = Join-Path $root $outputName
  $canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  Get-Item -LiteralPath $out | Select-Object FullName, Length
} finally {
  $font.Dispose(); $ink.Dispose(); $background.Dispose(); $g.Dispose(); $canvas.Dispose()
  $new.Dispose(); $old.Dispose()
}
