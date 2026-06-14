$ErrorActionPreference = "Stop"

$drive = "X:"
$projectPath = (Get-Location).Path

if (Test-Path "$drive\") {
  cmd /c "subst $drive /D" | Out-Null
}

cmd /c "subst $drive `"$projectPath`"" | Out-Null
Set-Location "$drive\"
node scripts\next-build.cjs
