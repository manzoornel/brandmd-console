@echo off
REM One-time setup on the office PC. Double-click, or run from this folder.
cd /d "%~dp0"
python -m venv .venv || (echo Install Python 3.11+ from python.org first & pause & exit /b 1)
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo Now open ".env" in Notepad and fill it in, then run:  .venv\Scripts\python.exe publisher.py check
schtasks /Create /F /SC MINUTE /MO 10 /TN "BrandMD Publisher" /TR "\"%~dp0run_publisher.bat\""
echo Scheduled task "BrandMD Publisher" created (every 10 minutes).
pause
