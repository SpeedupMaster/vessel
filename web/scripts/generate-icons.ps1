$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    Write-Error "Edge not found at $edgePath"
    exit 1
}

$tempHtml = "$PSScriptRoot\temp-icon-renderer.html"

function Render-Icon {
    param(
        [int]$Size,
        [string]$OutFile,
        [int]$AnchorPercent = 60
    )

    $html = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${Size}px;
    height: ${Size}px;
    overflow: hidden;
    background: #09090b;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: ${AnchorPercent}%;
    height: ${AnchorPercent}%;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
  }
</style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="8 12 240 240">
    <path fill="#ffffff" opacity="0.3" d="M152,56a24,24,0,1,1-24-24A24,24,0,0,1,152,56Z"/>
    <path fill="#ffffff" d="M216,136a8,8,0,0,0-8,8c0,24.69-13.77,29.64-38.1,36.28-11.36,3.1-24.12,6.6-33.9,14.34V128h32a8,8,0,0,0,0-16H136V87a32,32,0,1,0-16,0v25H88a8,8,0,0,0,0,16h32v66.62c-9.78-7.74-22.54-11.24-33.9-14.34C61.77,173.64,48,168.69,48,144a8,8,0,0,0-16,0c0,38.11,27.67,45.66,49.9,51.72C106.23,202.36,120,207.31,120,232a8,8,0,0,0,16,0c0-24.69,13.77-29.64,38.1-36.28C196.33,189.66,224,182.11,224,144A8,8,0,0,0,216,136ZM112,56a16,16,0,1,1,16,16A16,16,0,0,1,112,56Z"/>
  </svg>
</body>
</html>
"@

    Set-Content -Path $tempHtml -Value $html -Encoding utf8

    $uri = "file:///" + (Resolve-Path $tempHtml).Path.Replace("\", "/")
    
    Start-Process -FilePath $edgePath -ArgumentList @(
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=$Size,$Size",
        "--screenshot=$OutFile",
        $uri
    ) -Wait -NoNewWindow

    if (Test-Path $OutFile) {
        Write-Host "Generated: $OutFile ($Size x $Size, size: $((Get-Item $OutFile).Length) bytes)"
    } else {
        Write-Warning "Failed: $OutFile"
    }
}

$iconsDir = "$PSScriptRoot\..\public\icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null }

# Standard PWA icons (60% scale anchor)
Render-Icon -Size 192 -OutFile "$iconsDir\icon-192.png" -AnchorPercent 62
Render-Icon -Size 512 -OutFile "$iconsDir\icon-512.png" -AnchorPercent 62

# Maskable icons (52% scale anchor, strictly inside 80% safe zone)
Render-Icon -Size 192 -OutFile "$iconsDir\icon-maskable-192.png" -AnchorPercent 52
Render-Icon -Size 512 -OutFile "$iconsDir\icon-maskable-512.png" -AnchorPercent 52

# Apple Touch Icon (180x180, 60% scale)
Render-Icon -Size 180 -OutFile "$iconsDir\apple-touch-icon.png" -AnchorPercent 60
Render-Icon -Size 180 -OutFile "$PSScriptRoot\..\public\apple-touch-icon.png" -AnchorPercent 60

if (Test-Path $tempHtml) { Remove-Item -Force $tempHtml }
Write-Host "All PWA icons generated successfully!"
