Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$blue = [System.Drawing.Color]::FromArgb(255, 0, 0, 139) # DarkBlue
$brush = New-Object System.Drawing.SolidBrush $blue
$g.FillRectangle($brush, 0, 0, 256, 256)
# Draw a simple shape to make it look like something
$gold = [System.Drawing.Color]::Gold
$pen = New-Object System.Drawing.Pen $gold, 10
$g.DrawEllipse($pen, 50, 50, 156, 156)
$bmp.Save('c:\my-lol-tool\build\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$g.Dispose()
