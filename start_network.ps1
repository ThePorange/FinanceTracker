$ipInfo = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notmatch '^169.254' } | Select-Object -First 1
$ip = $ipInfo.IPAddress

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " Starting FinanceTracker for Network Access          " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Local IP Address is: $ip" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting Backend Service on port 3000..." -ForegroundColor Green
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start:dev" -WindowStyle Normal -WorkingDirectory .

Write-Host "Starting Frontend Service on port 5173..." -ForegroundColor Green
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev", "--", "--host" -WindowStyle Normal -WorkingDirectory ".\frontend"

Write-Host ""
Write-Host "Services are starting in separate windows." -ForegroundColor Cyan
Write-Host "Once they are running, you can access the app from other devices on your wifi network at:" -ForegroundColor Cyan
Write-Host "http://$($ip):5173" -ForegroundColor Green
Write-Host ""
Write-Host "Note: If you cannot connect from another device, Windows Firewall might be blocking the connection." -ForegroundColor Yellow
Write-Host "To allow it, run this command in an Administrator PowerShell window:" -ForegroundColor Yellow
Write-Host "New-NetFirewallRule -DisplayName `"Node.js Dev Server`" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,3000" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
