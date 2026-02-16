@echo off
setlocal

if exist "%~dp0.venv\Scripts\tmq.exe" (
  "%~dp0.venv\Scripts\tmq.exe" %*
  exit /b %errorlevel%
)

for /f "delims=" %%I in ('where tmq.exe 2^>nul') do (
  "%%I" %*
  exit /b %errorlevel%
)

echo [tmq] Error: could not find tmq.exe.
echo [tmq] Create/activate a venv and install backend:
echo         py -3.11 -m venv .venv
echo         .\.venv\Scripts\activate
echo         pip install -e ".\core"
echo         pip install -e ".\backend[dev]"
exit /b 1
