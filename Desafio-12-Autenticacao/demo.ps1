# Demonstração do fluxo de autenticação. Com a API rodando (npm run start:dev) usando
# ADMIN_EMAIL=admin@example.com e ADMIN_PASSWORD=troque-esta-senha, execute:  .\demo.ps1
$base = 'http://localhost:3000'

function Call($method, $path, $body = $null, $token = $null) {
  $h = @{}
  if ($token) { $h.Authorization = "Bearer $token" }
  try {
    $args = @{ Uri = "$base$path"; Method = $method; Headers = $h; ContentType = 'application/json' }
    if ($body) { $args.Body = ($body | ConvertTo-Json) }
    $r = Invoke-RestMethod @args
    Write-Host "$method $path -> OK" -ForegroundColor Green
    return $r
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host "$method $path -> $code" -ForegroundColor Yellow
  }
}

$email = "aluno$(Get-Random)@example.com"

Write-Host "`n1) Registro (sempre member)"
(Call POST '/auth/register' @{ name = 'Aluno'; email = $email; password = 'senha-forte-1' }).data | Format-List

Write-Host "`n2) Login com senha errada (esperado 401)"
Call POST '/auth/login' @{ email = $email; password = 'senha-errada' } | Out-Null

Write-Host "`n3) Login correto"
$tokens = Call POST '/auth/login' @{ email = $email; password = 'senha-forte-1' }

Write-Host "`n4) /me sem token (esperado 401) e com token"
Call GET '/me' | Out-Null
(Call GET '/me' $null $tokens.accessToken).data | Format-List

Write-Host "`n5) member em rota de admin (esperado 403)"
Call GET '/admin/users' $null $tokens.accessToken | Out-Null

Write-Host "`n6) Admin lista usuarios (200)"
$admin = Call POST '/auth/login' @{ email = 'admin@example.com'; password = 'troque-esta-senha' }
(Call GET '/admin/users' $null $admin.accessToken).data | Format-Table id, name, email, role

Write-Host "`n7) Refresh token: 1o uso OK, reuso do mesmo token (esperado 401)"
Call POST '/auth/refresh' @{ refreshToken = $tokens.refreshToken } | Out-Null
Call POST '/auth/refresh' @{ refreshToken = $tokens.refreshToken } | Out-Null
