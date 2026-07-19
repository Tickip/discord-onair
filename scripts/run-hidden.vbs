' Launches run-forever.ps1 fully detached with no visible window.
' powershell.exe's own -WindowStyle Hidden is unreliable when launched via
' Task Scheduler; WScript.Shell.Run with window style 0 is the robust way
' to truly hide it.
Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Dev\bots\discord-onair\scripts\run-forever.ps1""", 0, False
