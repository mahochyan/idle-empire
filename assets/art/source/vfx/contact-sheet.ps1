# QA preview for every configured unit attack effect. Run after generate-unit-vfx.mjs.
Add-Type -AssemblyName System.Drawing
$artRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$files = @(Get-ChildItem -File (Join-Path $artRoot 'vfx\units\*.png') | Sort-Object Name)
$profiles = Get-Content -LiteralPath (Join-Path $artRoot 'vfx\unit-vfx-profiles.json') -Raw | ConvertFrom-Json
$expected = @($profiles.PSObject.Properties).Count
if ($files.Count -ne $expected) { throw ('Expected ' + $expected + ' unit effects, got ' + $files.Count) }
$cellWidth = 150
$cellHeight = 148
$columns = 9
$rows = [Math]::Ceiling($files.Count / $columns)
$canvas = New-Object System.Drawing.Bitmap(($cellWidth * $columns), ($cellHeight * $rows))
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(246,240,224))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48,57,61))
$font = [System.Drawing.Font]::new('Arial',8)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  for ($i = 0; $i -lt $files.Count; $i++) {
    $x = ($i % $columns) * $cellWidth
    $y = [Math]::Floor($i / $columns) * $cellHeight
    $graphics.FillRectangle($background,$x,$y,$cellWidth - 2,$cellHeight - 2)
    $sprite = [System.Drawing.Image]::FromFile($files[$i].FullName)
    try { $graphics.DrawImage($sprite,$x + 17,$y + 4,116,116) }
    finally { $sprite.Dispose() }
    $graphics.DrawString($files[$i].BaseName,$font,$ink,$x + 4,$y + 123)
  }
  $previewDir = Join-Path $artRoot '..\..\hd2d-previews'
  $canvas.Save((Join-Path $previewDir 'qa-unit-vfx-gallery.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $canvas.Dispose()
  $background.Dispose()
  $ink.Dispose()
  $font.Dispose()
}
