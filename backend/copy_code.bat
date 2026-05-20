@echo off
echo Copying Code.gs content to clipboard...
chcp 65001 > nul
type Code.gs | clip
echo Done! Code.gs content is now in your clipboard.
echo Go to Google Apps Script, select Code.gs, select all (Ctrl+A), and paste (Ctrl+V).
pause