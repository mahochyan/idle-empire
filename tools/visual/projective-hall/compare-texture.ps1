$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$beforePath = Join-Path $root 'hd2d-previews\qa-projective-hall-360x200.png'
$afterPath = Join-Path $root 'hd2d-previews\qa-projective-hall-textured-360x200.png'
$outputPath = Join-Path $root 'hd2d-previews\qa-projective-hall-textured-local-diff.png'
$before = [System.Drawing.Bitmap]::FromFile($beforePath)
$after = [System.Drawing.Bitmap]::FromFile($afterPath)
$cropSize = New-Object System.Drawing.Size 130, 100
$scale = 3
$tileW = $cropSize.Width * $scale
$tileH = $cropSize.Height * $scale
$canvas = New-Object System.Drawing.Bitmap ($tileW * 5), ($tileH + 28), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232,236,226))
$font = New-Object System.Drawing.Font 'Segoe UI', 11
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(33,42,38))
try {
  $graphics.FillRectangle($brush, 0, 0, $canvas.Width, $canvas.Height)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $paneX = @(8, 376, 744, 1112)
  $cropX = 115
  $cropY = 28
  $sourceRects = @(
    (New-Object System.Drawing.Rectangle ($paneX[0]+$cropX), (29+$cropY), $cropSize.Width, $cropSize.Height),
    (New-Object System.Drawing.Rectangle ($paneX[2]+$cropX), (29+$cropY), $cropSize.Width, $cropSize.Height),
    (New-Object System.Drawing.Rectangle ($paneX[2]+$cropX), (29+$cropY), $cropSize.Width, $cropSize.Height),
    (New-Object System.Drawing.Rectangle ($paneX[3]+$cropX), (29+$cropY), $cropSize.Width, $cropSize.Height),
    (New-Object System.Drawing.Rectangle ($paneX[3]+$cropX), (29+$cropY), $cropSize.Width, $cropSize.Height)
  )
  $pictures = @($before, $before, $after, $before, $after)
  $captions = @('Original', 'Old -8 deg', 'Textured -8 deg', 'Old +8 deg', 'Textured +8 deg')
  for ($index=0; $index -lt $pictures.Count; $index++) {
    $graphics.DrawString($captions[$index], $font, $ink, ($index*$tileW+5), 4)
    $destination = New-Object System.Drawing.Rectangle ($index*$tileW), 28, $tileW, $tileH
    $graphics.DrawImage($pictures[$index], $destination, $sourceRects[$index], [System.Drawing.GraphicsUnit]::Pixel)
  }
  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $metrics = @()
  foreach ($pane in @(1,2,3)) {
    $sum = 0.0
    $count = 0
    for ($y=0; $y -lt $cropSize.Height; $y++) {
      for ($x=0; $x -lt $cropSize.Width; $x++) {
        $pixelBefore = $before.GetPixel(($paneX[$pane]+$cropX+$x), (29+$cropY+$y))
        $pixelAfter = $after.GetPixel(($paneX[$pane]+$cropX+$x), (29+$cropY+$y))
        $sum += ([math]::Abs($pixelBefore.R-$pixelAfter.R) +
          [math]::Abs($pixelBefore.G-$pixelAfter.G) +
          [math]::Abs($pixelBefore.B-$pixelAfter.B)) / 3.0
        $count++
      }
    }
    $metrics += @{ Yaw = @('0', '-8', '+8')[$pane-1]; ChangedPixelMeanRGB = [math]::Round($sum/$count,3) }
  }
  $metrics | ConvertTo-Json
  Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
} finally {
  $ink.Dispose()
  $font.Dispose()
  $brush.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
  $after.Dispose()
  $before.Dispose()
}
