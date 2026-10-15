Add-Type -AssemblyName System.Drawing

$srcDir = "C:\Users\user\.gemini\antigravity\brain\e6daa294-78e8-4610-91cc-368f457d1121\.user_uploaded"
$dstDir = "C:\Users\user\TAIKO-TYPING\public\assets\buttons"

# 1-4 are already transparent PNGs! Copy them directly:
Copy-Item "$srcDir\media_1792027545918.png" "$dstDir\btn_official.png" -Force
Copy-Item "$srcDir\media_1792027562861.png" "$dstDir\btn_howtoplay.png" -Force
Copy-Item "$srcDir\media_1792027545880.png" "$dstDir\btn_pcmode.png" -Force
Copy-Item "$srcDir\media_1792027545953.png" "$dstDir\btn_character.png" -Force

Write-Output "Copied 4 transparent PNGs successfully."

# Function to convert black background to transparent PNG
function Convert-BlackToTransparent($sourcePath, $targetPath) {
    $img = [System.Drawing.Bitmap]::FromFile($sourcePath)
    $w = $img.Width
    $h = $img.Height
    $newBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $img.GetPixel($x, $y)
            # Threshold: if it's pure black or near black (< 18), make it transparent
            $brightness = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
            if ($brightness -lt 15) {
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } elseif ($brightness -lt 35) {
                # Smooth alpha transition
                $alpha = [int](($brightness - 15) / 20.0 * 255.0)
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
            } else {
                $newBmp.SetPixel($x, $y, $c)
            }
        }
    }

    $newBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    $newBmp.Dispose()
    Write-Output "Converted $sourcePath to transparent PNG $targetPath"
}

Convert-BlackToTransparent "$srcDir\media_1792027545974.jpg" "$dstDir\btn_settings.png"
Convert-BlackToTransparent "$srcDir\media_1792027580480.jpg" "$dstDir\btn_fullscreen.png"

Get-ChildItem $dstDir
