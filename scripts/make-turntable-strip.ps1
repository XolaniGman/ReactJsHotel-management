# Builds a 16-frame 360° turntable sprite strip from a car rotation video.
#
# Usage (PowerShell):
#   & .\scripts\make-turntable-strip.ps1 -InputVideo input_car_360.mp4 -Output public\fleet-strips\ec-101.png
#
# Optional: -Frames 16 -Width 800
#
# Requires ffmpeg + ffprobe on PATH. The strip is a single wide image of
# N frames edge-to-edge; drop it at public/fleet-strips/{unit}.png and
# the fleet detail page will show the draggable 360° viewer for that car.
#
# Frame order: frame 1 = front, then every (360 / frames) degrees clockwise,
# ending back at the front — matches how the viewer slices the strip.

param(
  [Parameter(Mandatory = $true)][string]$InputVideo,
  [Parameter(Mandatory = $true)][string]$Output,
  [int]$Frames = 16,
  [int]$Width = 800
)

$ErrorActionPreference = 'Stop'
if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg is not on PATH' }
if (!(Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'ffprobe is not on PATH' }

$tmp = Join-Path $env:TEMP ("turntable-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
  $outDir = Split-Path -Parent $Output
  if ($outDir) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

  # 1. Probe duration so frames can be spread evenly across the full rotation.
  $dur = & ffprobe -v error -show_entries format=duration -of csv=p=0 $InputVideo
  $dur = [double]$dur.Trim()
  $step = $dur / $Frames

  # 2. Extract exactly $Frames evenly-spaced frames, one per cycle step.
  $framePat = Join-Path $tmp 'frame_%02d.png'
  & ffmpeg -y -i $InputVideo -vf "fps=${step},scale=${Width}:-1" -vsync vfr -vframes $Frames -q:v 2 $framePat
  if ($LASTEXITCODE -ne 0) { throw 'ffmpeg frame extraction failed' }

  # 3. Stitch the frames into one horizontal sprite strip.
  & ffmpeg -y -i (Join-Path $tmp 'frame_%02d.png') -filter_complex "hstack=inputs=$Frames,pad=ceil(iw/2)*2:ceil(ih/2)*2" -frames:v 1 $Output
  if ($LASTEXITCODE -ne 0) { throw 'ffmpeg strip stitching failed' }

  Write-Host "Wrote $Output ($Frames frames, ${Width}px wide)"
  Write-Host 'Place it at public\fleet-strips\{unit}.png to enable the 360 viewer.'
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}