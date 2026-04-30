@echo off
REM Build the frontend
cd frontend
call npm run build

REM Inline assets manually
call node inline-assets.js

echo "Build complete. Files ready in backend/ folder."
