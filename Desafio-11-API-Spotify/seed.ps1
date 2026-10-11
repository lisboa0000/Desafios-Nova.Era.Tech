param([int]$Port = 3111)

# Popula a API (ja rodando) com dados de exemplo para teste/print.
$b = "http://localhost:$Port"
function Post($path, $body) {
  Invoke-RestMethod -Method Post -Uri "$b/$path" -ContentType 'application/json' -Body ($body | ConvertTo-Json) | Out-Null
}

Post 'artists' @{ name = 'Queen'; country = 'UK' }
Post 'artists' @{ name = 'Daft Punk'; country = 'France' }
Post 'albums' @{ title = 'A Night at the Opera'; releaseYear = 1975; artistId = 1 }
Post 'albums' @{ title = 'Discovery'; releaseYear = 2001; artistId = 2 }
Post 'tracks' @{ title = 'Bohemian Rhapsody'; durationSeconds = 355; genre = 'Rock'; albumId = 1 }
Post 'tracks' @{ title = 'Love of My Life'; durationSeconds = 219; genre = 'Rock'; albumId = 1 }
Post 'tracks' @{ title = 'One More Time'; durationSeconds = 320; genre = 'Electronic'; albumId = 2 }
Post 'tracks' @{ title = 'Digital Love'; durationSeconds = 301; genre = 'Electronic'; albumId = 2 }
Post 'playlists' @{ name = 'Favoritas'; description = 'Minhas preferidas' }
foreach ($t in 1, 3, 2, 4) { Post 'playlists/1/tracks' @{ trackId = $t } }

Invoke-RestMethod "$b/playlists/1" | ConvertTo-Json -Depth 6
