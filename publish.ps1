$ErrorActionPreference = "Stop"

Write-Host "Changes:"
git status --short

$commitMessage = Read-Host "Commit message"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    Write-Error "Commit message is required."
}

npm exec vite build

git add .
git commit -m $commitMessage
git push origin main

Write-Host "Push completed."
