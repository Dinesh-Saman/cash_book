@echo off
echo Starting Cash Book Management System...
start "CashBook Backend" cmd /k "cd /d d:\Uvexzon\Cash_Book_Management_System\backend && npm run dev"
start "CashBook Frontend" cmd /k "cd /d d:\Uvexzon\Cash_Book_Management_System\frontend && npm run dev"
echo Servers launched in separate windows!
