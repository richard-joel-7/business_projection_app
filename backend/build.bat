@echo off
echo Starting full build process...

cd ..\frontend
echo Running npm run build...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo Running inline-assets.js...
node inline-assets.js
if %errorlevel% neq 0 (
    echo Inline assets failed!
    pause
    exit /b %errorlevel%
)

cd ..\backend
echo Build complete! backend/index.html has been updated.
echo.
echo Copying backend/index.html content to clipboard...
chcp 65001 > nul
type index.html | clip
echo Done! index.html content is now in your clipboard.
echo Go to Google Apps Script, select index.html, select all (Ctrl+A), and paste (Ctrl+V).
pause