@echo off
REM Called by Windows Task Scheduler (or Hermes) every 10 minutes.
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (set PY=.venv\Scripts\python.exe) else (set PY=python)
%PY% publisher.py run --json >> last_run.txt 2>&1
