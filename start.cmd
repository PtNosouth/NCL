@echo off
setlocal
cd /d "%~dp0"
start "" "http://127.0.0.1:5174/index.html"
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 5174 --bind 127.0.0.1
) else (
  py -3 -m http.server 5174 --bind 127.0.0.1
)
