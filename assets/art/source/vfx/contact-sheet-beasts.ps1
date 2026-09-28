# Render the six per-ID beast attack textures at a compact battle size on both themes.
Add-Type -AssemblyName System.Drawing
$artRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ids = @('wild_boar','wild_bull','wild_snake','wild_tiger','wild_turtle','wild_wyrm')
$cellWidth = 136
$cellHeight = 112
$canvas = [System.Drawing.Bitmap]::new(($cellWidth * $ids.Count),($cellHeight * 2))
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$font = [System.Drawing.Font]::new('Arial',9)
$light = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(246,240,224))
$dark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23,35,43))
$lightInk = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48,57,61))
$darkInk = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230,232,221))
try {
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  for ($row = 0; $row -lt 2; $row++) {
    for ($i = 0; $i -lt $ids.Count; $i++) {
      $x = $i * $cellWidth
      $y = $row * $cellHeight
      $brush = if ($row -eq 0) { $light } else { $dark }
      $ink = if ($row -eq 0) { $lightInk } else { $darkInk }
      $graphics.FillRectangle($brush,$x,$y,$cellWidth - 2,$cellHeight - 2)
      $file = Join-Path $artRoot ('vfx\units\' + $ids[$i] + '.png')
      $sprite = [System.Drawing.Image]::FromFile($file)
      try { $graphics.DrawImage($sprite,$x + 36,$y + 8,64,64) }
      finally { $sprite.Dispose() }
      $graphics.DrawString($ids[$i],$font,$ink,$x + 7,$y + 85)
    }
  }
  $previewDir = Join-Path $artRoot '..\..\hd2d-previews'
  $canvas.Save((Join-Path $previewDir 'qa-beast-vfx-64-light-dark.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $canvas.Dispose(); $font.Dispose()
  $light.Dispose(); $dark.Dispose(); $lightInk.Dispose(); $darkInk.Dispose()
}
