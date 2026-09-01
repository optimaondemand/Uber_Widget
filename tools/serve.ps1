# Tiny static file server for previewing Optima Curriculum Studio locally.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 8765
# Serves the repo root (parent of tools\). No dependencies beyond Windows PowerShell 5.1.
param([int]$Port = 8765, [string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = [IO.Path]::GetFullPath($Root)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Optima Curriculum Studio preview: http://localhost:$Port/  (serving $Root)"
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8";
           ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".webp"="image/webp";
           ".woff"="font/woff"; ".woff2"="font/woff2"; ".md"="text/markdown; charset=utf-8"; ".txt"="text/plain; charset=utf-8"; ".imscc"="application/zip"; ".zip"="application/zip" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith("/")) { $path += "index.html" }
    $file = [IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart("/") -replace "/", "\")))
    if ((Test-Path -LiteralPath $file -PathType Leaf) -and $file.StartsWith($Root)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] } else { $ctx.Response.ContentType = "application/octet-stream" }
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
  } catch { try { $ctx.Response.StatusCode = 500 } catch {} }
  finally { try { $ctx.Response.OutputStream.Close() } catch {} }
}
