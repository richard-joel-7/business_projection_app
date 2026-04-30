@echo off
echo Starting full build process...

cd frontend
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

cd ..
echo Build complete! backend/index.html has been updated.
echo backend/Code.gs is already up to date.
pause
