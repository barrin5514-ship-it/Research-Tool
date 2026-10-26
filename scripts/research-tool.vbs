Option Explicit
Dim shell, fso, script, mode, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
script = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "research-tool.ps1")
mode = "Start"
If WScript.Arguments.Count > 0 Then mode = WScript.Arguments(0)
If mode <> "Start" And mode <> "Stop" Then WScript.Quit 1
command = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & script & """ -Mode " & mode
shell.Run command, 0, True
