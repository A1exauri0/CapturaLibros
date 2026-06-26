@echo off
chcp 65001 > nul
title Publicador de Actualización - Captura de Libros
powershell -NoProfile -ExecutionPolicy Bypass -File publicar.ps1
pause
