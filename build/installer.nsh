!include "MUI2.nsh"

; --- Design & Styling ---
; Verwende System-Look für Controls (Buttons, Bars)
XPStyle on

; Moderne Schriftart in passender Größe
!define MUI_FONT "Segoe UI"
!define MUI_FONTSIZE 11

; Verhindere das Verzerren von Bildern (hilft gegen "pixelig")
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH
!define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH

; --- Seitenkonfiguration ---
; (Wir definieren nur das Aussehen, Electron-Builder erstellt die Seiten selbst)

; Willkommensseite mit modernem Titel
!define MUI_WELCOMEPAGE_TITLE "Willkommen beim Setup von ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT "Dieser Assistent wird Sie durch die Installation von ${PRODUCT_NAME} begleiten.$\r$\n$\r$\nEs wird empfohlen, alle anderen Programme zu schließen, bevor Sie fortfahren."

; Abschlussseite Konfiguration
; (Ueberschreibe Standardwerte sicher)
; MUI_FINISHPAGE_RUN wird von electron-builder automatisch gesetzt, nicht neu definieren!

!ifdef MUI_FINISHPAGE_RUN_TEXT
  !undef MUI_FINISHPAGE_RUN_TEXT
!endif
!define MUI_FINISHPAGE_RUN_TEXT "Starte ${PRODUCT_NAME} jetzt"

; --- Callback Funktionen ---
; (Keine speziellen Callbacks mehr benötigt)

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Möchten Sie auch alle gespeicherten Server und Einstellungen löschen?$\r$\n(Der Ordner wird unwiderruflich gelöscht)" /SD IDNO IDNO +2
  RMDir /r "$APPDATA\Catalyst"
!macroend
