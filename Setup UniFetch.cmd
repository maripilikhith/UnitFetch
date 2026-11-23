@echo off
cd /d "%~dp0"
python helper\setup-tools.py
if errorlevel 1 goto failed
python helper\register.py
if errorlevel 1 goto failed
echo.
echo Setup complete. Open chrome://extensions, enable Developer mode,
echo click Load unpacked, and select the UniFetch folder beside this file.
pause
exit /b 0
:failed
echo Setup failed. See the message above. Python 3.11 or newer is required.
pause
exit /b 1
