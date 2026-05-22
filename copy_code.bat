@echo off
chcp 65001 > nul
echo Copying backend/Code.gs content to clipboard...
type backend\Code.gs | clip
echo Done! Code.gs content is now in your clipboard.
echo You can paste it directly into the Google Apps Script editor.
pause
