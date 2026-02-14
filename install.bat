@echo off
echo ============================================
echo  ComfyUI Photoshop Plugin - Installer
echo ============================================
echo.

:: Check for admin rights (needed for Program Files path)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Not running as Administrator.
    echo [!] Will install to user-level CEP extensions folder instead.
    echo.
    set "INSTALL_DIR=%APPDATA%\Adobe\CEP\extensions\com.comfyui.photoshop"
) else (
    set "INSTALL_DIR=%CommonProgramFiles(x86)%\Adobe\CEP\extensions\com.comfyui.photoshop"
)

:: Step 1: Enable unsigned CEP extensions (required for non-packaged extensions)
echo [1/3] Enabling unsigned CEP extensions...
reg add "HKCU\SOFTWARE\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\SOFTWARE\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\SOFTWARE\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\SOFTWARE\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo       Done.
echo.

:: Step 2: Copy extension files
echo [2/3] Installing to: %INSTALL_DIR%

:: Remove old plugin code (preserve workflows folder with user data)
if exist "%INSTALL_DIR%\CSXS" rmdir /s /q "%INSTALL_DIR%\CSXS" 2>nul
if exist "%INSTALL_DIR%\client" rmdir /s /q "%INSTALL_DIR%\client" 2>nul
if exist "%INSTALL_DIR%\host" rmdir /s /q "%INSTALL_DIR%\host" 2>nul
if exist "%INSTALL_DIR%\.debug" del /q "%INSTALL_DIR%\.debug" 2>nul
if exist "%INSTALL_DIR%\config.json" del /q "%INSTALL_DIR%\config.json" 2>nul

:: Create the target directory
mkdir "%INSTALL_DIR%" 2>nul

:: Copy the extension files
echo       Copying files...
xcopy "%~dp0CSXS" "%INSTALL_DIR%\CSXS\" /E /I /Q /Y >nul
xcopy "%~dp0client" "%INSTALL_DIR%\client\" /E /I /Q /Y >nul
xcopy "%~dp0host" "%INSTALL_DIR%\host\" /E /I /Q /Y >nul
if exist "%~dp0workflows" xcopy "%~dp0workflows" "%INSTALL_DIR%\workflows\" /E /I /Q /Y >nul
if not exist "%INSTALL_DIR%\workflows" mkdir "%INSTALL_DIR%\workflows" 2>nul
if exist "%~dp0.debug" copy "%~dp0.debug" "%INSTALL_DIR%\" /Y >nul
if exist "%~dp0config.json" copy "%~dp0config.json" "%INSTALL_DIR%\" /Y >nul

echo       Done.
echo.

:: Step 3: Verify
echo [3/3] Verifying installation...
if exist "%INSTALL_DIR%\CSXS\manifest.xml" (
    echo       manifest.xml found - OK
) else (
    echo       [ERROR] manifest.xml not found!
    goto :error
)
if exist "%INSTALL_DIR%\client\index.html" (
    echo       index.html found - OK
) else (
    echo       [ERROR] index.html not found!
    goto :error
)
if exist "%INSTALL_DIR%\host\index.jsx" (
    echo       index.jsx found - OK
) else (
    echo       [ERROR] index.jsx not found!
    goto :error
)

echo.
echo ============================================
echo  Installation complete!
echo ============================================
echo.
echo  Installed to: %INSTALL_DIR%
echo.
echo  Next steps:
echo    1. Close Photoshop if it's running
echo    2. Open Photoshop
echo    3. Go to: Window ^> Extensions ^> ComfyUI Integration
echo.
echo  Make sure ComfyUI is running at http://127.0.0.1:8188
echo.
echo  Workflows folder: %INSTALL_DIR%\workflows\
echo  Export workflows from ComfyUI with "Save (API Format)"
echo  and place the .json files in the workflows folder above.
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Installation failed! Some files are missing.
echo Please make sure you're running this from the plugin folder.
pause
exit /b 1
