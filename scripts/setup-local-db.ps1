# Creates medicronis user/database on local PostgreSQL, then migrates and seeds.
# Usage:
#   .\scripts\setup-local-db.ps1
#   .\scripts\setup-local-db.ps1 -PostgresPassword "your-postgres-password"
#   $env:PGPASSWORD="your-postgres-password"; .\scripts\setup-local-db.ps1

param(
  [string]$PostgresPassword = $env:PGPASSWORD,
  [string]$PostgresUser = "postgres",
  [string]$DbHost = "localhost",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PsqlCandidates = @(
  "C:\Program Files\PostgreSQL\17\bin\psql.exe",
  "C:\Program Files\PostgreSQL\16\bin\psql.exe",
  "C:\Program Files\PostgreSQL\15\bin\psql.exe",
  "psql"
)

$Psql = $PsqlCandidates | Where-Object { $_ -eq "psql" -or (Test-Path $_) } | Select-Object -First 1
if (-not $Psql) {
  Write-Error "psql not found. Install PostgreSQL or add psql to PATH."
}

if (-not $PostgresPassword) {
  $secure = Read-Host "Enter PostgreSQL password for user '$PostgresUser'" -AsSecureString
  $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "Creating medicronis user..."
& $Psql -U $PostgresUser -h $DbHost -p $Port -d postgres -v ON_ERROR_STOP=1 -f (Join-Path $Root "scripts\setup-local-db.sql")
if ($LASTEXITCODE -ne 0) {
  Write-Error "Database setup failed. Check your postgres superuser password."
}

$dbExists = & $Psql -U $PostgresUser -h $DbHost -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'medicronis'"
if ($dbExists -ne "1") {
  Write-Host "Creating medicronis database..."
  & $Psql -U $PostgresUser -h $DbHost -p $Port -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE medicronis OWNER medicronis"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create medicronis database."
  }
} else {
  Write-Host "Database medicronis already exists."
}

Write-Host "Ensuring medicronis owns database and public schema..."
& $Psql -U $PostgresUser -h $DbHost -p $Port -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE medicronis OWNER TO medicronis"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to set database owner."
}
& $Psql -U $PostgresUser -h $DbHost -p $Port -d medicronis -v ON_ERROR_STOP=1 -f (Join-Path $Root "scripts\setup-local-db-grants.sql")
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to grant schema permissions."
}

Write-Host "Running Prisma migrations..."
Push-Location $Root
try {
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "Seeding demo data..."
  npx prisma db seed
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Start the app with: npm run dev"
Write-Host "Login password: demo"
