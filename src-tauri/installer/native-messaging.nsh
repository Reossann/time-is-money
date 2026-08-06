!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToStack 'taskkill /F /IM native-messaging-host.exe /T'
  Pop $R0
  Pop $R1
  Sleep 500
  Delete "$INSTDIR\native-messaging-host.exe"
  Delete "$INSTDIR\native-messaging-setup.exe"
  Delete "$INSTDIR\com.timeismoney.app.json"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToStack '"$INSTDIR\native-messaging-setup.exe" install "$INSTDIR"'
  Pop $R9
  Pop $R8
  ${If} $R9 != 0
    DetailPrint "Native Messaging Host registration failed (exit $R9): $R8"
    MessageBox MB_ICONEXCLAMATION|MB_OK "Chrome 拡張機能連携の自動設定に失敗しました。アプリ起動時に再試行されます。$\n$\n詳細: $R8"
  ${Else}
    DetailPrint "Native Messaging Host registration succeeded."
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToStack '"$INSTDIR\native-messaging-setup.exe" uninstall "$INSTDIR"'
  Pop $R9
  Pop $R8
  ${If} $R9 != 0
    DetailPrint "Native Messaging Host cleanup failed (exit $R9): $R8"
  ${Else}
    DetailPrint "Native Messaging Host cleanup succeeded."
  ${EndIf}

  nsExec::ExecToStack 'taskkill /F /IM native-messaging-host.exe /T'
  Pop $R0
  Pop $R1
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$INSTDIR\com.timeismoney.app.json"
!macroend
